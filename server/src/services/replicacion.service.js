'use strict';

/**
 * Motor de Replicación de usuarios a las BD de las sucursales destino.
 * Reemplaza el mecanismo legacy `PCD_OPERACIONES` (op.10) + `PCD_GENERA_REPLICA`:
 *   - Lee de la BD central con los pools (system/server/master).
 *   - Escribe a cada BD destino por conexión Firebird AD-HOC (host/credenciales de
 *     CONFIGURACION_USUARIO_REPLICA), en transacción por BD (rollback si algo falla).
 *   - Ratifica dependencias FK antes de escribir (nunca INSERT/UPDATE a ciegas).
 *   - Transforma: ORDEN (sucursal/depósito propios del destino = orden 1) y
 *     GG_MESERO.IDSUCURSAL = IDSUCURSAL del destino (offset por local).
 *
 * Ruteo de tablas por BD destino:
 *   SYSTEM_BD → usuario, usuarioempresa, menu_general
 *   SERVER_BD → usuario_sucursal/deposito/deposito1/concepto, gg_mesero
 *   MASTER_BD → usuario, usuarioempresa (RRHH/Contab)   [pendiente: etapa 2b]
 */

const { query, attachExternal } = require('../config/firebird');
const logger = require('../utils/logger');

const BLOB = 261; // rdb$field_type de BLOB

// ── Introspección (cacheada por proceso) ───────────────────────────────────
const _colsCache = new Map();

async function nonBlobCols(scope, tabla) {
  const key = `${scope}.${tabla}`;
  if (_colsCache.has(key)) return _colsCache.get(key);
  const rows = await query(
    scope,
    `SELECT TRIM(rf.rdb$field_name) AS name, f.rdb$field_type AS type
       FROM rdb$relation_fields rf
       JOIN rdb$fields f ON f.rdb$field_name = rf.rdb$field_source
      WHERE rf.rdb$relation_name = ?
        AND f.rdb$computed_blr IS NULL`,
    [tabla.toUpperCase()],
  );
  const cols = rows.filter((r) => Number(r.type) !== BLOB).map((r) => String(r.name).trim());
  _colsCache.set(key, cols);
  return cols;
}

/** Lee una fila de central (pool) por igualdad simple. Devuelve objeto o null. */
async function leerFila(scope, tabla, whereCol, whereVal) {
  const cols = await nonBlobCols(scope, tabla);
  const rows = await query(
    scope,
    `SELECT FIRST 1 ${cols.join(', ')} FROM ${tabla} WHERE ${whereCol} = ?`,
    [whereVal],
  );
  return rows[0] || null;
}

async function leerFilas(scope, sql, params = []) {
  return query(scope, sql, params);
}

// ── Escritura genérica en destino (dentro de una tx ad-hoc) ─────────────────

/** ¿Existe una fila con esa PK en el destino? */
async function existe(tx, tabla, pkCols, row) {
  const where = pkCols.map((c) => `${c} = ?`).join(' AND ');
  const vals = pkCols.map((c) => row[c.toLowerCase()] ?? row[c]);
  const r = await tx.query(`SELECT 1 FROM ${tabla} WHERE ${where}`, vals);
  return r.length > 0;
}

/**
 * UPDATE-or-INSERT de `row` (objeto col→valor, claves en minúscula) en `tabla`.
 * `pkCols` en MAYÚSCULA. Devuelve 'inserted' | 'updated' | 'unchanged'.
 */
async function upsert(tx, tabla, row, pkCols) {
  const cols = Object.keys(row);
  const pkLower = new Set(pkCols.map((c) => c.toLowerCase()));
  const whereVals = pkCols.map((c) => row[c.toLowerCase()]);
  const where = pkCols.map((c) => `${c} = ?`).join(' AND ');

  const ex = await tx.query(`SELECT 1 FROM ${tabla} WHERE ${where}`, whereVals);
  if (ex.length) {
    const setCols = cols.filter((c) => !pkLower.has(c.toLowerCase()));
    if (!setCols.length) return 'unchanged';
    await tx.query(
      `UPDATE ${tabla} SET ${setCols.map((c) => `${c} = ?`).join(', ')} WHERE ${where}`,
      [...setCols.map((c) => row[c]), ...whereVals],
    );
    return 'updated';
  }
  await tx.query(
    `INSERT INTO ${tabla} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
    cols.map((c) => row[c]),
  );
  return 'inserted';
}

const TEXT_TYPES = new Set([37, 14, 40]); // VARCHAR, CHAR, CSTRING
const NUM_TYPES = new Set([7, 8, 16, 10, 11, 27, 9]); // SMALLINT/INT/BIGINT/FLOAT/DOUBLE

/**
 * Metadatos no-BLOB de una tabla del destino: Map(colLower → { type, notnull }).
 * `notnull` sale de RDB$NULL_FLAG (1 = NOT NULL).
 */
async function metaDeConn(conn, tabla) {
  const rows = await conn.query(
    `SELECT TRIM(rf.rdb$field_name) AS name, f.rdb$field_type AS type,
            COALESCE(rf.rdb$null_flag, 0) AS notnull
       FROM rdb$relation_fields rf
       JOIN rdb$fields f ON f.rdb$field_name = rf.rdb$field_source
      WHERE rf.rdb$relation_name = ?
        AND f.rdb$computed_blr IS NULL`, [tabla.toUpperCase()]);
  const map = new Map();
  for (const r of rows) {
    if (Number(r.type) === BLOB) continue;
    map.set(String(r.name).trim().toLowerCase(), { type: Number(r.type), notnull: Number(r.notnull) === 1 });
  }
  return map;
}

/**
 * Ajusta `row` al destino: (1) intersección de columnas origen ∩ destino;
 * (2) coacción de NOT NULL con valor null a un default por tipo (texto '' / numérico 0),
 * para tolerar constraints que la central no tiene. Los NOT NULL de fecha se dejan
 * como están (que falle explícito antes que insertar un default inválido).
 */
function prepararFila(row, meta) {
  const out = {};
  for (const k of Object.keys(row)) {
    const m = meta.get(k.toLowerCase());
    if (!m) continue; // columna no existe en destino
    let v = row[k];
    if ((v === null || v === undefined) && m.notnull) {
      if (TEXT_TYPES.has(m.type)) v = '';
      else if (NUM_TYPES.has(m.type)) v = 0;
    }
    out[k] = v;
  }
  return out;
}

function optsDestino(destino, database) {
  return {
    host: (destino.host_server || '').trim(),
    port: 3050,
    database: (database || '').trim(),
    user: (destino.user_bd || '').trim(),
    password: (destino.clave_bd || '').trim(),
    charset: 'NONE',
  };
}

// ── Lectura del usuario en central ──────────────────────────────────────────

async function leerUsuarioCentral(iduser, destinoId) {
  const usuario = await leerFila('system', 'USUARIO', 'iduser', iduser);
  if (!usuario) return null;

  const usuarioempresa = await leerFilas(
    'system',
    `SELECT ${(await nonBlobCols('system', 'USUARIOEMPRESA')).join(', ')}
       FROM usuarioempresa WHERE iduser = ?`, [iduser]);

  const menu = await leerFilas(
    'system',
    `SELECT idempresa, iduser, idmenu, titulo, permiso
       FROM menu_general WHERE iduser = ?`, [iduser]);

  // SERVER: sucursales/depósitos con ORDEN recalculado (propio del destino = 1).
  const sucursales = await leerFilas(
    'server',
    `SELECT idsucursal, CASE WHEN idsucursal = ? THEN 1 ELSE 2 END AS orden
       FROM usuario_sucursal
      WHERE iduser = ?
        AND idsucursal IN (SELECT idsucursal FROM sucursal WHERE COALESCE(estado,0) = 1)`,
    [destinoId, iduser]);

  const depositos = await leerFilas(
    'server',
    `SELECT ud.iddeposito, CASE WHEN d.idsucursal = ? THEN 1 ELSE 2 END AS orden
       FROM usuario_deposito ud
       JOIN deposito d ON d.iddeposito = ud.iddeposito
      WHERE ud.iduser = ? AND COALESCE(d.estado,0) = 1`,
    [destinoId, iduser]);

  const depositos1 = await leerFilas(
    'server',
    `SELECT ud.iddeposito, CASE WHEN d.idsucursal = ? THEN 1 ELSE 2 END AS orden
       FROM usuario_deposito1 ud
       JOIN deposito d ON d.iddeposito = ud.iddeposito
      WHERE ud.iduser = ? AND COALESCE(d.estado,0) = 1`,
    [destinoId, iduser]);

  const conceptoCols = await nonBlobCols('server', 'USUARIO_CONCEPTO');
  const conceptos = await leerFilas(
    'server',
    `SELECT ${conceptoCols.join(', ')} FROM usuario_concepto WHERE iduser = ?`, [iduser]);

  const meseroCols = await nonBlobCols('server', 'GG_MESERO');
  const mesero = (await leerFilas(
    'server',
    `SELECT FIRST 1 ${meseroCols.join(', ')} FROM gg_mesero WHERE iduser = ?`, [iduser]))[0] || null;

  return { usuario, usuarioempresa, menu, sucursales, depositos, depositos1, conceptos, mesero };
}

// ── Escritura por BD destino ────────────────────────────────────────────────

async function escribirSystem(destino, data) {
  const conn = await attachExternal(optsDestino(destino, destino.system_bd));
  const bloqueos = [];
  try {
    // Introspección del destino ANTES de la transacción (esquemas pueden diferir).
    const cU = await metaDeConn(conn, 'USUARIO');
    const cUE = await metaDeConn(conn, 'USUARIOEMPRESA');
    const cTU = await metaDeConn(conn, 'TIPO_USUARIO');
    // Rol como dependencia previa garantizada (usuario.idtipo_usuario no es FK dura pero el rol
    // debe existir para que el módulo lo muestre). idtipo_usuario <= 0 = "Sin Rol" → sin dependencia.
    const idtipo = Number(data.usuario.idtipo_usuario);
    const rolRow = idtipo > 0
      ? await leerFila('system', 'TIPO_USUARIO', 'idtipo_usuario', idtipo)
      : null;

    // Guarda FK: USUARIOEMPRESA.IDEMPRESA → EMPRESAS. Las empresas son dato de instalación
    // (no se replican); si la empresa no existe en la sucursal, se omite esa fila.
    const uesOk = [];
    for (const ue of data.usuarioempresa) {
      const idemp = ue.idempresa;
      if (idemp != null && String(idemp).trim() !== '') {
        const ex = await conn.query('SELECT 1 FROM empresas WHERE idempresa = ?', [idemp]).catch(() => []);
        if (!ex.length) { bloqueos.push(`usuarioempresa: empresa ${String(idemp).trim()} inexistente en destino → omitida`); continue; }
      }
      uesOk.push(ue);
    }

    const res = await conn.transaction(async (tx) => {
      const r = { rol: null, usuario: null, usuarioempresa: 0, menu: 0 };
      if (rolRow) r.rol = await upsert(tx, 'TIPO_USUARIO', prepararFila(rolRow, cTU), ['IDTIPO_USUARIO']);
      r.usuario = await upsert(tx, 'USUARIO', prepararFila(data.usuario, cU), ['IDUSER']);

      for (const ue of uesOk) {
        await upsert(tx, 'USUARIOEMPRESA', prepararFila(ue, cUE), ['IDUSER', 'IDEMPRESA']);
        r.usuarioempresa++;
      }

      // menu_general: idmenu_principal es PK por generador local → delete+insert regenerando.
      await tx.query('DELETE FROM menu_general WHERE iduser = ?', [data.usuario.iduser]);
      for (const m of data.menu) {
        await tx.query(
          `INSERT INTO menu_general (idmenu_principal, idempresa, iduser, idmenu, titulo, permiso)
           VALUES (GEN_ID(GEN_MENU_GENERAL, 1), ?, ?, ?, ?, ?)`,
          [m.idempresa, m.iduser, m.idmenu, m.titulo, m.permiso]);
        r.menu++;
      }
      return r;
    });
    return { ...res, bloqueos };
  } finally {
    await conn.detach();
  }
}

// ── Cascada de dependencias CONSTRAINT-DRIVEN ───────────────────────────────
// Se ejecuta AUTÓNOMA (conn.query, auto-commit) ANTES de la tx principal (como el SP con
// "IN AUTONOMOUS TRANSACTION"). Lee las FK REALES de cada tabla del DESTINO y las resuelve
// recursivamente, replicando de central lo que falte. Cubre todas las tablas del SP sin
// hardcodear el grafo de dependencias.

async function metaCached(conn, cache, tabla) {
  const k = `META:${tabla.toUpperCase()}`;
  if (!cache.has(k)) cache.set(k, await metaDeConn(conn, tabla));
  return cache.get(k);
}

/** FKs de una tabla en el DESTINO: [{ col, reftab, refcol }] (col en minúscula). Cacheado. */
async function fksDe(conn, cache, tabla) {
  const k = `FK:${tabla.toUpperCase()}`;
  if (cache.has(k)) return cache.get(k);
  let list = [];
  try {
    list = await conn.query(
      `SELECT TRIM(isf.rdb$field_name) AS col, TRIM(rc2.rdb$relation_name) AS reftab,
              TRIM(isf2.rdb$field_name) AS refcol
         FROM rdb$relation_constraints rc
         JOIN rdb$ref_constraints refc ON refc.rdb$constraint_name = rc.rdb$constraint_name
         JOIN rdb$relation_constraints rc2 ON rc2.rdb$constraint_name = refc.rdb$const_name_uq
         JOIN rdb$index_segments isf  ON isf.rdb$index_name  = rc.rdb$index_name
         JOIN rdb$index_segments isf2 ON isf2.rdb$index_name = rc2.rdb$index_name
                                     AND isf2.rdb$field_position = isf.rdb$field_position
        WHERE rc.rdb$constraint_type = 'FOREIGN KEY' AND rc.rdb$relation_name = ?
        ORDER BY isf.rdb$field_position`, [tabla.toUpperCase()]);
  } catch (_) { list = []; }
  const out = list.map((f) => ({
    col: String(f.col).trim().toLowerCase(),
    reftab: String(f.reftab).trim(),
    refcol: String(f.refcol).trim(),
  }));
  cache.set(k, out);
  return out;
}

/**
 * Garantiza en el destino la fila (pkCol=pkVal) de `tabla`, replicándola de central si falta,
 * resolviendo antes sus FK recursivamente (según las constraints REALES del destino).
 * Best-effort: si algo falla se registra en `bloqueos` y no aborta. `visto` corta ciclos.
 */
async function garantizarFila(conn, cache, scope, tabla, pkCol, pkVal, bloqueos, visto) {
  if (!(Number(pkVal) > 0)) return true; // 0/null = sin referencia (centinela)
  const key = `${tabla.toUpperCase()}#${pkVal}`;
  if (visto.has(key)) return true;
  visto.add(key);
  if ((await conn.query(`SELECT 1 FROM ${tabla} WHERE ${pkCol} = ?`, [pkVal])).length) return true;

  const cols = await nonBlobCols(scope, tabla);
  const row = (await query(scope, `SELECT FIRST 1 ${cols.join(', ')} FROM ${tabla} WHERE ${pkCol} = ?`, [pkVal]))[0];
  if (!row) { bloqueos.push(`${tabla} ${pkVal} no existe en central`); return false; }

  // 1) Resolver sus dependencias FK primero (en el orden que exige el destino).
  for (const fk of await fksDe(conn, cache, tabla)) {
    await garantizarFila(conn, cache, scope, fk.reftab, fk.refcol, row[fk.col], bloqueos, visto);
  }
  // 2) Insertar/actualizar la fila.
  try {
    await upsert(conn, tabla, prepararFila(row, await metaCached(conn, cache, tabla)), [pkCol.toUpperCase()]);
    return true;
  } catch (e) {
    bloqueos.push(`${tabla} ${pkVal}: ${String(e.message).slice(0, 50)}`);
    return false;
  }
}

/** Garantiza SOLO las FK de una fila `row` de `tabla` (sin insertar la fila). Para gg_mesero. */
async function garantizarFksDe(conn, cache, scope, tabla, row, bloqueos, visto) {
  for (const fk of await fksDe(conn, cache, tabla)) {
    await garantizarFila(conn, cache, scope, fk.reftab, fk.refcol, row[fk.col], bloqueos, visto);
  }
}

async function escribirServer(destino, data) {
  const conn = await attachExternal(optsDestino(destino, destino.server_bd));
  const iduser = data.usuario.iduser;
  const destinoId = destino.idsucursal;
  const bloqueos = [];
  const metaCache = new Map();
  try {
    const cCpt = await metaDeConn(conn, 'USUARIO_CONCEPTO');
    const cMes = await metaDeConn(conn, 'GG_MESERO');
    // Cascada de dependencias (autónoma, antes de la tx principal).
    const visto = new Set();
    // Conceptos: garantizar los TIPOMOVIMIENTO (única FK dura de usuario_concepto).
    if (data.conceptos.length) {
      const tms = [...new Set(data.conceptos.map((c) => Number(c.idtipomovimiento)).filter((n) => n > 0))];
      for (const tm of tms) {
        await garantizarFila(conn, metaCache, 'server', 'tipomovimiento', 'idtipomovimiento', tm, bloqueos, visto);
      }
    }
    // Mesero: FK propias de GG_MESERO según el destino (p. ej. idtipo_mesero → gg_tipo_mesero) +
    // legajo por completitud (rh_persona/rh_cargo y toda su cascada). rh_idpersona/idcargo pueden
    // venir nulos si el flag LEGAJO de central está apagado → garantizarFila los saltea.
    if (data.mesero) {
      await garantizarFksDe(conn, metaCache, 'server', 'GG_MESERO', data.mesero, bloqueos, visto);
      await garantizarFila(conn, metaCache, 'server', 'rh_persona', 'idpersona', data.mesero.rh_idpersona, bloqueos, visto);
      await garantizarFila(conn, metaCache, 'server', 'rh_cargo', 'idcargo', data.mesero.idcargo, bloqueos, visto);
    }
    const res = await conn.transaction(async (tx) => {
      const r = { sucursales: 0, depositos: 0, depositos1: 0, conceptos: 0, mesero: null };

      // Guarda FK: solo sucursales que existan en el destino.
      await tx.query('DELETE FROM usuario_sucursal WHERE iduser = ?', [iduser]);
      for (const s of data.sucursales) {
        const ok = await tx.query('SELECT 1 FROM sucursal WHERE idsucursal = ?', [s.idsucursal]);
        if (!ok.length) { bloqueos.push(`sucursal ${s.idsucursal} inexistente`); continue; }
        await tx.query('INSERT INTO usuario_sucursal (iduser, idsucursal, orden) VALUES (?, ?, ?)',
          [iduser, s.idsucursal, s.orden]);
        r.sucursales++;
      }

      for (const [tabla, filas, keyR] of [
        ['usuario_deposito', data.depositos, 'depositos'],
        ['usuario_deposito1', data.depositos1, 'depositos1'],
      ]) {
        await tx.query(`DELETE FROM ${tabla} WHERE iduser = ?`, [iduser]);
        for (const d of filas) {
          const ok = await tx.query('SELECT 1 FROM deposito WHERE iddeposito = ?', [d.iddeposito]);
          if (!ok.length) { bloqueos.push(`deposito ${d.iddeposito} inexistente`); continue; }
          await tx.query(`INSERT INTO ${tabla} (iduser, iddeposito, orden) VALUES (?, ?, ?)`,
            [iduser, d.iddeposito, d.orden]);
          r[keyR]++;
        }
      }

      // Conceptos: sin PK → delete+insert. La única FK dura es idtipomovimiento (ya garantizado
      // en la cascada); si aun así falta se omite el concepto. Las demás columnas de usuario_concepto
      // NO tienen FK (verificado en el esquema), así que no se anulan: se preservan tal cual.
      await tx.query('DELETE FROM usuario_concepto WHERE iduser = ?', [iduser]);
      for (const cRaw of data.conceptos) {
        if (Number(cRaw.idtipomovimiento) > 0) {
          const tmOk = await tx.query('SELECT 1 FROM tipomovimiento WHERE idtipomovimiento = ?', [cRaw.idtipomovimiento]);
          if (!tmOk.length) { bloqueos.push(`concepto: tipomovimiento ${cRaw.idtipomovimiento} inexistente`); continue; }
        }
        const c = prepararFila(cRaw, cCpt);
        const cols = Object.keys(c);
        await tx.query(
          `INSERT INTO usuario_concepto (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
          cols.map((k) => c[k]));
        r.conceptos++;
      }

      // GG_MESERO: preservar IDMESERO, forzar IDSUCURSAL = destino. Guarda FK de persona/cargo.
      if (data.mesero) {
        const m = prepararFila({ ...data.mesero, idsucursal: destinoId }, cMes);
        if (m.rh_idpersona != null) {
          const ok = await tx.query('SELECT 1 FROM rh_persona WHERE idpersona = ?', [m.rh_idpersona]);
          if (!ok.length) { m.rh_idpersona = null; bloqueos.push(`rh_persona ${data.mesero.rh_idpersona} inexistente → mesero sin persona`); }
        }
        if (m.idcargo != null) {
          const ok = await tx.query('SELECT 1 FROM rh_cargo WHERE idcargo = ?', [m.idcargo]);
          if (!ok.length) { m.idcargo = null; bloqueos.push(`rh_cargo ${data.mesero.idcargo} inexistente → mesero sin cargo`); }
        }
        r.mesero = await upsert(tx, 'GG_MESERO', m, ['IDMESERO']);
      }
      return r;
    });
    return { ...res, bloqueos };
  } finally {
    await conn.detach();
  }
}

async function escribirMaster(destino, iduser) {
  if (!destino.master_bd || !destino.master_bd.trim()) return { skipped: 'sin-master' };
  // Solo si el usuario tiene registro en la BD master central (módulo RRHH/Contab).
  const uMaster = await leerFila('master', 'USUARIO', 'idusuario', iduser);
  if (!uMaster) return { skipped: 'usuario-sin-master' };

  const ueCols = await nonBlobCols('master', 'USUARIOEMPRESA');
  const ueMaster = await leerFilas(
    'master',
    `SELECT ${ueCols.join(', ')} FROM usuarioempresa WHERE idusuario = ?`, [iduser]);

  const conn = await attachExternal(optsDestino(destino, destino.master_bd));
  try {
    const cU = await metaDeConn(conn, 'USUARIO');
    const cUE = await metaDeConn(conn, 'USUARIOEMPRESA');
    return await conn.transaction(async (tx) => {
      const r = { usuario: null, usuarioempresa: 0 };
      r.usuario = await upsert(tx, 'USUARIO', prepararFila(uMaster, cU), ['IDUSUARIO']);
      for (const ue of ueMaster) {
        await upsert(tx, 'USUARIOEMPRESA', prepararFila(ue, cUE), ['IDEMPRESA', 'IDUSUARIO']);
        r.usuarioempresa++;
      }
      return r;
    });
  } finally {
    await conn.detach();
  }
}

// ── Orquestación ────────────────────────────────────────────────────────────

async function getDestino(idsucursal) {
  const rows = await query(
    'server',
    `SELECT idsucursal, estado, host_server, user_bd, clave_bd, server_bd, system_bd, master_bd
       FROM configuracion_usuario_replica WHERE idsucursal = ?`, [idsucursal]);
  return rows[0] || null;
}

/**
 * Replica un usuario a un destino. Devuelve { ok, detalle } o lanza (para que la
 * cola marque ERROR). Los "bloqueos" (FK faltantes toleradas) no abortan; se reportan.
 * @returns {Promise<{ok:boolean, bloqueado:boolean, detalle:object}>}
 */
async function replicarUsuario(idsucursal, iduser) {
  const destino = await getDestino(idsucursal);
  if (!destino) throw new Error(`Destino ${idsucursal} no configurado`);
  if (Number(destino.estado) !== 1) throw new Error(`Destino ${idsucursal} inactivo`);

  const data = await leerUsuarioCentral(iduser, destino.idsucursal);
  if (!data) throw new Error(`Usuario ${iduser} no existe en central`);

  const system = await escribirSystem(destino, data);
  const server = await escribirServer(destino, data);
  const master = await escribirMaster(destino, iduser);

  const bloqueos = [...(system.bloqueos || []), ...(server.bloqueos || [])];
  logger.info({ iduser, idsucursal, system, server, master }, 'replicarUsuario');
  return {
    ok: true,
    bloqueado: bloqueos.length > 0,
    detalle: {
      system: { ...system, bloqueos: undefined },
      server: { ...server, bloqueos: undefined },
      master, bloqueos,
    },
  };
}

module.exports = {
  replicarUsuario,
  leerUsuarioCentral,
  getDestino,
  // exportados para tests
  _internos: { upsert, existe, nonBlobCols, optsDestino },
};
