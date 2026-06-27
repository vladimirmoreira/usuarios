'use strict';

const { query, transaction } = require('../config/firebird');

/**
 * Queries at\u00f3micas necesarias para el orquestador de operaciones.
 * Todas las operativas viven en pool 'system' (las que el SP antiguo
 * hac\u00eda con `EXECUTE STATEMENT ON EXTERNAL :IP||:SYSTEM`).
 *
 * CONFIGURACION_USUARIO se lee desde 'server'.
 */
const OperacionesModel = {

  // ---------------------------------------------------------------------------
  // Contexto / flags por IP
  // ---------------------------------------------------------------------------

  /** Trae los flags de comportamiento que dispara el cliente seg\u00fan IP. */
  async contextoPorIp(ip) {
    const rows = await query(
      'server',
      `SELECT FIRST 1 ip, legajo, biometrico, gastronomia, contabilidad, talento_humano, complementario
         FROM configuracion_usuario
        WHERE TRIM(ip) = TRIM(CAST(? AS VARCHAR(20)))`,
      [ip || ''],
    );
    if (rows[0]) return rows[0];
    // Fallback: primera fila (modo legacy)
    const fall = await query(
      'server',
      `SELECT FIRST 1 ip, legajo, biometrico, gastronomia, contabilidad, talento_humano, complementario
         FROM configuracion_usuario`,
      [],
    );
    return fall[0] || { legajo: 0, biometrico: 0, gastronomia: 0, contabilidad: 0, talento_humano: 0, complementario: 0 };
  },

  // ---------------------------------------------------------------------------
  // USUARIO
  // ---------------------------------------------------------------------------

  async existeUsuario(iduser) {
    const r = await query('system', 'SELECT FIRST 1 iduser FROM usuario WHERE iduser = ?', [iduser]);
    return r.length > 0;
  },

  async estadoUsuario(iduser) {
    const r = await query('system', 'SELECT FIRST 1 estado, documento, idtipo_usuario FROM usuario WHERE iduser = ?', [iduser]);
    return r[0] || null;
  },

  async perfilTemplate(idperfil) {
    const r = await query(
      'system',
      `SELECT FIRST 1 iduser, tipo, estado
         FROM tipo_usuario
        WHERE idtipo_usuario = ? AND COALESCE(estado, 0) = 1`,
      [idperfil],
    );
    return r[0] || null;
  },

  async perfilExisteActivo(idperfil) {
    const r = await query(
      'system',
      'SELECT FIRST 1 idtipo_usuario, estado FROM tipo_usuario WHERE idtipo_usuario = ?',
      [idperfil],
    );
    return r[0] || null;
  },

  async sucursalActiva(idsucursal) {
    const r = await query(
      'server',
      'SELECT FIRST 1 idsucursal, estado FROM sucursal WHERE idsucursal = ?',
      [idsucursal],
    );
    return r[0] || null;
  },

  // ---------------------------------------------------------------------------
  // ALTA \u2014 una sola transacci\u00f3n en system
  // ---------------------------------------------------------------------------

  /**
   * Inserta USUARIO + USUARIOEMPRESA + MENU_GENERAL + USUARIO_SUCURSAL
   * + USUARIO_DEPOSITO + USUARIO_DEPOSITO1 + USUARIO_CONCEPTO copiando del
   * usuario-template del perfil. Clave inicial = documento.
   */
  async altaCompleta(params) {
    return transaction('system', (tx) => _altaWork(tx, params));
  },

  /** Igual que altaCompleta pero participa en una transacción externa (para batch atómico). */
  async altaCompletaEnTx(tx, params) {
    return _altaWork(tx, params);
  },

  // ---------------------------------------------------------------------------
  // Mutaciones puntuales
  // ---------------------------------------------------------------------------

  async cambiarEstadoUsuario(iduser, nuevoEstado) {
    return query(
      'system',
      'UPDATE usuario SET estado = ? WHERE iduser = ? AND COALESCE(estado,0) <> ?',
      [nuevoEstado, iduser, nuevoEstado],
    );
  },

  async actualizarPass(iduser, nuevaClave) {
    return query('system', 'UPDATE usuario SET pass = ? WHERE iduser = ?', [nuevaClave, iduser]);
  },

  async actualizarBasicos(iduser, { nombre, apellido, documento }) {
    const sets = [], params = [];
    if (nombre != null)    { sets.push('nombre = ?');    params.push(nombre); }
    if (apellido != null)  { sets.push('apellido = ?');  params.push(apellido); }
    if (documento != null) { sets.push('documento = ?'); params.push(documento); }
    if (!sets.length) return 0;
    params.push(iduser);
    return query('system', `UPDATE usuario SET ${sets.join(', ')} WHERE iduser = ?`, params);
  },

  async actualizarDocumento(iduser, documento) {
    return query('system', 'UPDATE usuario SET documento = ? WHERE iduser = ?', [documento, iduser]);
  },

  async cambiarPerfilUsuario(iduser, idperfil) {
    return query('system', 'UPDATE usuario SET idtipo_usuario = ? WHERE iduser = ?', [idperfil, iduser]);
  },

  async excluirCuenta(iduser, valor = 1) {
    return query('system', 'UPDATE usuario SET exclusion = ? WHERE iduser = ?', [valor, iduser]);
  },

  // ---------------------------------------------------------------------------
  // GG_MESERO (PDV / gastronom\u00eda)
  // ---------------------------------------------------------------------------

  async meseroExiste(iduser) {
    const r = await query('server', 'SELECT FIRST 1 idmesero, estado FROM gg_mesero WHERE iduser = ?', [iduser]);
    return r[0] || null;
  },

  async insertarMesero({ nombre, apellido, documento, idperfil, idpersona, idsucursal, iduser, idcargo }) {
    // DECODE legacy: 7->3, 8->1, 10->1, 6->3
    const tipoMesero = ({ 7: 3, 8: 1, 10: 1, 6: 3 })[idperfil] ?? null;
    return query(
      'server',
      `INSERT INTO gg_mesero (idmesero, nombre, apellido, nrodocumento, estado, clave,
                              idtipo_mesero, rh_idpersona, idsucursal, iduser, idcargo, cajero, externo)
       VALUES (gen_id(gen_gg_mesero, 1), ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, 1, 0)`,
      [nombre, apellido, documento, documento, tipoMesero, idpersona, idsucursal, iduser, idcargo],
    );
  },

  async desactivarMesero(iduser) {
    return query('server', 'UPDATE gg_mesero SET estado = 0 WHERE estado <> 0 AND iduser = ?', [iduser]);
  },

  async actualizarMeseroClave(iduser, clave) {
    return query('server', 'UPDATE gg_mesero SET clave = ? WHERE iduser = ?', [clave, iduser]);
  },

  async actualizarMeseroSucursal(iduser, idsucursal) {
    return query('server', 'UPDATE gg_mesero SET idsucursal = ? WHERE iduser = ? AND estado = 1', [idsucursal, iduser]);
  },

  async actualizarMeseroPerfil(iduser, idperfil) {
    const tipoMesero = ({ 7: 3, 8: 1, 10: 1, 6: 3 })[idperfil] ?? null;
    if (tipoMesero == null) return 0;
    return query(
      'server',
      'UPDATE gg_mesero SET idtipo_mesero = ? WHERE iduser = ? AND estado = 1 AND idtipo_mesero <> ?',
      [tipoMesero, iduser, idperfil],
    );
  },

  async vincularMeseroPersona(iduser, idpersona, idcargo) {
    return transaction('server', async (tx) => {
      let n = 0;
      if (idpersona != null) {
        const r1 = await tx.query(
          'UPDATE gg_mesero SET rh_idpersona = ? WHERE iduser = ? AND rh_idpersona IS NULL AND estado = 1',
          [idpersona, iduser],
        );
        n += r1?.[0]?.count ?? 0;
      }
      if (idcargo != null) {
        const r2 = await tx.query(
          'UPDATE gg_mesero SET idcargo = ? WHERE iduser = ? AND idcargo IS NULL AND estado = 1',
          [idcargo, iduser],
        );
        n += r2?.[0]?.count ?? 0;
      }
      return n;
    });
  },

  // ---------------------------------------------------------------------------
  // RH_PERSONA / RH_CARGO / RH_CARGO_BIO
  // ---------------------------------------------------------------------------

  async cargoActivoPorDocumento(documento) {
    if (!documento) return null;
    const r = await query(
      'server',
      `SELECT FIRST 1 c.idcargo, c.idpersona, c.user_system
         FROM rh_cargo c
        WHERE c.estado = 1
          AND c.idpersona IN (SELECT idpersona FROM rh_persona WHERE documento = ?)
        ORDER BY c.idcargo DESC`,
      [documento],
    );
    return r[0] || null;
  },

  async asignarUserSystemAlCargo(idcargo, iduser) {
    return query(
      'server',
      'UPDATE rh_cargo SET user_system = ? WHERE idcargo = ? AND estado = 1 AND COALESCE(CHAR_LENGTH(user_system),0) = 0',
      [iduser, idcargo],
    );
  },

  async eliminarHuella(documento) {
    if (!documento) return { borradas: 0, cargos: [] };
    // 1) listar cargos afectados para detalle de audit
    const cargos = await query(
      'server',
      `SELECT b.idcargo FROM rh_cargo_bio b
        WHERE b.idcargo IN (
          SELECT c.idcargo FROM rh_cargo c
           WHERE c.idpersona IN (SELECT idpersona FROM rh_persona WHERE documento = ?)
        )`,
      [documento],
    );
    if (!cargos.length) return { borradas: 0, cargos: [] };
    await query(
      'server',
      `DELETE FROM rh_cargo_bio
        WHERE idcargo IN (
          SELECT c.idcargo FROM rh_cargo c
           WHERE c.idpersona IN (SELECT idpersona FROM rh_persona WHERE documento = ?)
        )`,
      [documento],
    );
    return { borradas: cargos.length, cargos: cargos.map((r) => r.idcargo) };
  },

  async documentoPersonaPorUsuario(iduser) {
    const r = await query(
      'server',
      `SELECT FIRST 1 p.documento FROM rh_persona p
        WHERE p.idpersona IN (SELECT idpersona FROM rh_cargo WHERE user_system = ?)`,
      [iduser],
    );
    return r[0]?.documento ?? null;
  },

  // ---------------------------------------------------------------------------
  // REASIGNACI\u00d3N DE SUCURSAL (sin TMP$*, todo en memoria)
  // ---------------------------------------------------------------------------

  async _filasSucursales(tx, iduser) {
    return tx.query(
      `SELECT idsucursal FROM usuario_sucursal
        WHERE iduser = ?
          AND idsucursal IN (SELECT idsucursal FROM sucursal WHERE COALESCE(estado,0)=1)`,
      [iduser],
    );
  },

  async _filasDepositosSalida(tx, iduser) {
    return tx.query(
      `SELECT ud.iddeposito FROM usuario_deposito ud
        WHERE ud.iduser = ?
          AND ud.iddeposito IN (SELECT iddeposito FROM deposito WHERE COALESCE(estado,0)=1)`,
      [iduser],
    );
  },

  async _filasDepositosEntrada(tx, iduser) {
    return tx.query(
      `SELECT ud.iddeposito FROM usuario_deposito1 ud
        WHERE ud.iduser = ?
          AND ud.iddeposito IN (SELECT iddeposito FROM deposito WHERE COALESCE(estado,0)=1)`,
      [iduser],
    );
  },

  /**
   * Reasigna sucursal predeterminada y reordena dep\u00f3sitos en una sola
   * transacci\u00f3n. Devuelve detalle por sub-tarea para auditor\u00eda.
   */
  async reasignarSucursalCompleto(iduser, idsucursal) {
    return transaction('server', async (tx) => {
      // 1) USUARIO_SUCURSAL
      const sucursales = (await this._filasSucursales(tx, iduser))
        .map((r) => r.idsucursal);
      await tx.query('DELETE FROM usuario_sucursal WHERE iduser = ?', [iduser]);
      for (const s of sucursales) {
        const orden = s === idsucursal ? 1 : 2;
        await tx.query(
          'INSERT INTO usuario_sucursal (iduser, idsucursal, orden) VALUES (?, ?, ?)',
          [iduser, s, orden],
        );
      }

      // 2) Dep\u00f3sito principal de la nueva sucursal
      const depPrincRows = await tx.query(
        `SELECT FIRST 1 iddeposito FROM deposito
          WHERE idsucursal = ? AND COALESCE(estado,0)=1 AND COALESCE(principal,0)=1`,
        [idsucursal],
      );
      const idDepPrincipal = depPrincRows[0]?.iddeposito ?? null;

      // 3) USUARIO_DEPOSITO (salida)
      const salidas = (await this._filasDepositosSalida(tx, iduser))
        .map((r) => r.iddeposito);
      await tx.query('DELETE FROM usuario_deposito WHERE iduser = ?', [iduser]);
      for (const d of salidas) {
        const orden = d === idDepPrincipal ? 1 : 2;
        await tx.query(
          'INSERT INTO usuario_deposito (iduser, iddeposito, orden) VALUES (?, ?, ?)',
          [iduser, d, orden],
        );
      }

      // 4) USUARIO_DEPOSITO1 (entrada)
      const entradas = (await this._filasDepositosEntrada(tx, iduser))
        .map((r) => r.iddeposito);
      await tx.query('DELETE FROM usuario_deposito1 WHERE iduser = ?', [iduser]);
      for (const d of entradas) {
        const orden = d === idDepPrincipal ? 1 : 2;
        await tx.query(
          'INSERT INTO usuario_deposito1 (iduser, iddeposito, orden) VALUES (?, ?, ?)',
          [iduser, d, orden],
        );
      }

      return {
        sucursales: sucursales.length,
        depositosSalida: salidas.length,
        depositosEntrada: entradas.length,
        idDepPrincipal,
      };
    });
  },
};

/* ─── Lógica interna de alta completa (reutilizable en tx externa) ─────────── */
async function _altaWork(tx, { iduser, idperfil, nombre, apellido, documento, idsucursal, templateIduser }) {
  const step = async (label, sql, params) => {
    try {
      return await tx.query(sql, params);
    } catch (e) {
      const wrapped = new Error(`[${label}] ${e.message}`);
      wrapped.status = 500;
      throw wrapped;
    }
  };

  // USUARIO
  await step(
    'USUARIO',
    `INSERT INTO usuario (iduser, nombre, apellido, pass, estado, idempresa, idtipo_usuario, documento, control)
     VALUES (?, ?, ?, ?, 1, 1, ?, ?, 1)`,
    [iduser, nombre, apellido, documento, idperfil, documento],
  );

  // USUARIOEMPRESA copiando del template
  await step(
    'USUARIOEMPRESA',
    `INSERT INTO usuarioempresa (iduser, idempresa, permisos, movimientos, modo_print,
                                  talonario, menu_gg_2, permiso_gg)
     SELECT ?, 1, ue.permisos, ue.movimientos, ue.modo_print, ue.talonario, ue.menu_gg_2, ue.permiso_gg
       FROM usuarioempresa ue WHERE ue.iduser = ?`,
    [iduser, templateIduser],
  );

  // MENU_GENERAL copiando del template
  await step(
    'MENU_GENERAL',
    `INSERT INTO menu_general (idmenu_principal, idempresa, iduser, idmenu, titulo, permiso)
     SELECT gen_id(gen_menu_general, 1), m.idempresa, ?, m.idmenu, m.titulo, m.permiso
       FROM menu_general m WHERE m.iduser = ?`,
    [iduser, templateIduser],
  );

  // USUARIO_SUCURSAL (orden 1 = la elegida, 2 = el resto)
  await step(
    'USUARIO_SUCURSAL',
    `INSERT INTO usuario_sucursal (iduser, idsucursal, orden)
     SELECT ?, suc.idsucursal,
            CASE WHEN suc.idsucursal = ? THEN 1 ELSE 2 END
       FROM usuario_sucursal suc
      WHERE suc.iduser = ?
        AND suc.idsucursal IN (SELECT idsucursal FROM sucursal WHERE COALESCE(estado,0)=1)`,
    [iduser, idsucursal, templateIduser],
  );

  // DEPOSITO principal de la sucursal elegida
  const dep = await step(
    'DEPOSITO_QUERY',
    `SELECT FIRST 1 iddeposito FROM deposito
      WHERE COALESCE(estado,0)=1 AND COALESCE(principal,0)=1 AND idsucursal = ?`,
    [idsucursal],
  );
  const idDepositoPrincipal = dep[0]?.iddeposito ?? null;

  // USUARIO_DEPOSITO (salida)
  await step(
    'USUARIO_DEPOSITO',
    `INSERT INTO usuario_deposito (iduser, iddeposito, orden)
     SELECT ?, dep.iddeposito,
            CASE WHEN dep.iddeposito = ? THEN 1 ELSE 2 END
       FROM usuario_deposito dep
      WHERE dep.iduser = ?
        AND dep.iddeposito IN (SELECT iddeposito FROM deposito WHERE COALESCE(estado,0)=1)`,
    [iduser, idDepositoPrincipal, templateIduser],
  );

  // USUARIO_DEPOSITO1 (entrada)
  await step(
    'USUARIO_DEPOSITO1',
    `INSERT INTO usuario_deposito1 (iduser, iddeposito, orden)
     SELECT ?, dep.iddeposito,
            CASE WHEN dep.iddeposito = ? THEN 1 ELSE 2 END
       FROM usuario_deposito1 dep
      WHERE dep.iduser = ?
        AND dep.iddeposito IN (SELECT iddeposito FROM deposito WHERE COALESCE(estado,0)=1)`,
    [iduser, idDepositoPrincipal, templateIduser],
  );

  // USUARIO_CONCEPTO
  await step(
    'USUARIO_CONCEPTO',
    `INSERT INTO usuario_concepto (iduser, idtipomovimiento, permiso, idtalonario,
                                    permiso_varios, idvendedor, idpersona, idplanventa, idcondicion)
     SELECT ?, cpt.idtipomovimiento, cpt.permiso, cpt.idtalonario, cpt.permiso_varios,
            cpt.idvendedor, cpt.idpersona, cpt.idplanventa, cpt.idcondicion
       FROM usuario_concepto cpt WHERE cpt.iduser = ?`,
    [iduser, templateIduser],
  );

  return { idDepositoPrincipal };
}

module.exports = OperacionesModel;
