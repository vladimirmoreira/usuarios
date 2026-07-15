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
      `SELECT FIRST 1 ip, legajo, biometrico, gastronomia, contabilidad, talento_humano, complementario, mail_resetclave, COALESCE(crear_sin_rol,1) AS crear_sin_rol,
              COALESCE(clonar,0) AS clonar, COALESCE(replicar,0) AS replicar
         FROM configuracion_usuario
        WHERE TRIM(ip) = TRIM(CAST(? AS VARCHAR(20)))`,
      [ip || ''],
    );
    if (rows[0]) return rows[0];
    // Fallback: primera fila (modo legacy)
    const fall = await query(
      'server',
      `SELECT FIRST 1 ip, legajo, biometrico, gastronomia, contabilidad, talento_humano, complementario, mail_resetclave, COALESCE(crear_sin_rol,1) AS crear_sin_rol,
              COALESCE(clonar,0) AS clonar, COALESCE(replicar,0) AS replicar
         FROM configuracion_usuario`,
      [],
    );
    return fall[0] || { legajo: 0, biometrico: 0, gastronomia: 0, contabilidad: 0, talento_humano: 0, complementario: 0, mail_resetclave: 0 };
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
   * Inserta USUARIO + USUARIOEMPRESA + MENU_GENERAL (BD **system**) y
   * USUARIO_SUCURSAL + USUARIO_DEPOSITO + USUARIO_DEPOSITO1 + USUARIO_CONCEPTO
   * (BD **server**) copiando del usuario-template del perfil. Clave inicial = documento.
   *
   * Las tablas de sucursales/depósitos/conceptos viven en la BD `server`, no en
   * `system`. Por eso el alta se hace en dos transacciones (una por base): la de
   * `server` va anidada dentro de la de `system`, de modo que si la parte server
   * falla, ambas revierten en cascada (rollback). El único hueco de atomicidad —
   * despreciable— es que la commit de `system` falle después de que `server` ya
   * commiteó; en la práctica un commit tras inserts correctos no falla.
   */
  async altaCompleta(params) {
    return transaction('system', async (sysTx) => {
      await _altaSystemPart(sysTx, params);
      return transaction('server', (srvTx) => _altaServerPart(srvTx, params));
    });
  },

  /** Parte del alta que corre en la BD system (usuario/usuarioempresa/menu). */
  async altaSystemPart(tx, params) {
    return _altaSystemPart(tx, params);
  },

  /** Parte del alta que corre en la BD server (sucursal/depósitos/conceptos). */
  async altaServerPart(tx, params) {
    return _altaServerPart(tx, params);
  },

  /**
   * Alta "Sin Rol": crea el USUARIO con idtipo_usuario = 0 (0 no excluye de las
   * vistas, a diferencia de -1 que marca plantillas de rol), copia MENU_GENERAL
   * desde Admin con permiso = 0 (igual que un rol nuevo) e inicializa
   * USUARIOEMPRESA en blanco. No asigna sucursal/depósitos/conceptos: queda como
   * un lienzo en blanco para configurar luego en el editor de Accesos. Los menús
   * de Contab./RRHH (master) se muestran igualmente en el editor, sin activar.
   */
  async altaSinRol({ iduser, nombre, apellido, documento }) {
    return transaction('system', async (tx) => {
      await tx.query(
        `INSERT INTO usuario (iduser, nombre, apellido, pass, estado, idempresa, idtipo_usuario, documento, control, hasta_vigencia)
         VALUES (?, ?, ?, ?, 1, 1, 0, ?, 1, CAST('2050-12-31' AS TIMESTAMP))`,
        [iduser, nombre, apellido, documento, documento],
      );
      await tx.query(
        `INSERT INTO menu_general (idmenu_principal, idempresa, iduser, idmenu, titulo, permiso)
         SELECT gen_id(gen_menu_general, 1), m.idempresa, ?, m.idmenu, m.titulo, 0
           FROM menu_general m
          WHERE UPPER(TRIM(m.iduser)) = 'ADMIN'
            AND m.idmenu NOT LIKE '%\\_\\_%' ESCAPE '\\'
            AND m.idmenu_principal = (
                  SELECT MIN(m2.idmenu_principal) FROM menu_general m2
                   WHERE UPPER(TRIM(m2.iduser)) = 'ADMIN' AND m2.idempresa = m.idempresa AND m2.idmenu = m.idmenu
            )`,
        [iduser],
      );
      await tx.query(
        `INSERT INTO usuarioempresa (iduser, idempresa, permisos, movimientos, permiso_gg, menu_gg_2)
         VALUES (?, 1, '', '', '', '')`,
        [iduser],
      );
    });
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

  /**
   * idtipo_mesero configurado para un rol vía "Usuario PDV" (fila plantilla en
   * gg_mesero del iduser-template del rol). Devuelve 1/2/3 o null si no está configurado.
   */
  async tipoMeseroDeTemplate(templateIduser) {
    if (!templateIduser) return null;
    const r = await query(
      'server',
      `SELECT FIRST 1 idtipo_mesero FROM gg_mesero
        WHERE UPPER(TRIM(iduser)) = UPPER(TRIM(?)) AND idtipo_mesero IS NOT NULL
        ORDER BY idmesero`,
      [templateIduser],
    );
    return r[0]?.idtipo_mesero ?? null;
  },

  async insertarMesero({ nombre, apellido, documento, idperfil, idpersona, idsucursal, iduser, idcargo, idtipoMesero }) {
    // Cualquier rol PDV (tipo_usuario.tipo=1) debe quedar con un idtipo_mesero válido (1/2/3).
    // Prioridad: tipo configurado en el rol (Usuario PDV) → mapa legacy → default 1.
    const tipoMesero = idtipoMesero ?? ({ 7: 3, 8: 1, 10: 1, 6: 3 })[idperfil] ?? 1;
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

/* ─── Lógica interna de alta, separada por base de datos ──────────────────── */

/** Envuelve cada sentencia para etiquetar el error con la tabla afectada. */
const _stepper = (tx) => async (label, sql, params) => {
  try {
    return await tx.query(sql, params);
  } catch (e) {
    const wrapped = new Error(`[${label}] ${e.message}`);
    wrapped.status = 500;
    throw wrapped;
  }
};

/** Parte del alta en BD **system**: USUARIO + USUARIOEMPRESA + MENU_GENERAL. */
async function _altaSystemPart(tx, { iduser, idperfil, nombre, apellido, documento, templateIduser }) {
  const step = _stepper(tx);

  // USUARIO — vigencia por defecto 31/12/2050 (sin caducidad efectiva). En el alta
  // unitaria, el controller la sobreescribe con la fecha del formulario si difiere.
  await step(
    'USUARIO',
    `INSERT INTO usuario (iduser, nombre, apellido, pass, estado, idempresa, idtipo_usuario, documento, control, hasta_vigencia)
     VALUES (?, ?, ?, ?, 1, 1, ?, ?, 1, CAST('2050-12-31' AS TIMESTAMP))`,
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

  // MENU_GENERAL copiando del template. Se excluyen idmenus malformados
  // ('__' consecutivo, idempresa vacío) y se deduplica por (idempresa, idmenu)
  // conservando el primero (menor idmenu_principal), igual que ignora el legacy.
  await step(
    'MENU_GENERAL',
    `INSERT INTO menu_general (idmenu_principal, idempresa, iduser, idmenu, titulo, permiso)
     SELECT gen_id(gen_menu_general, 1), m.idempresa, ?, m.idmenu, m.titulo, m.permiso
       FROM menu_general m
      WHERE m.iduser = ?
        AND m.idmenu NOT LIKE '%\\_\\_%' ESCAPE '\\'
        AND m.idmenu_principal = (
              SELECT MIN(m2.idmenu_principal) FROM menu_general m2
               WHERE m2.iduser = m.iduser AND m2.idempresa = m.idempresa AND m2.idmenu = m.idmenu
        )`,
    [iduser, templateIduser],
  );
}

/**
 * Parte del alta en BD **server**: USUARIO_SUCURSAL + USUARIO_DEPOSITO +
 * USUARIO_DEPOSITO1 + USUARIO_CONCEPTO (todas copiando del template del perfil).
 */
async function _altaServerPart(tx, { iduser, idsucursal, templateIduser }) {
  const step = _stepper(tx);

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
