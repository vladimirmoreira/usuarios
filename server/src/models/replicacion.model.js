'use strict';

const { query, transaction } = require('../config/firebird');

// Estados de un job en la cola (REPLICACION_COLA.ESTADO)
const ESTADO = {
  PENDIENTE: 0,
  PROCESANDO: 1,
  ENVIADO: 2,
  ERROR: 3,
  BLOQUEADO: 4, // falta una dependencia FK que no se pudo replicar
};

const ESTADO_LABEL = {
  0: 'PENDIENTE',
  1: 'PROCESANDO',
  2: 'ENVIADO',
  3: 'ERROR',
  4: 'BLOQUEADO',
};

// Columnas reales de CONFIGURACION_USUARIO_REPLICA. No se expone CLAVE_BD.
const DEST_COLS = `idsucursal, host_server, user_bd, server_bd, system_bd, master_bd,
                   COALESCE(orden, 0) AS orden, estado`;

const ReplicacionModel = {
  ESTADO,
  ESTADO_LABEL,

  /** Lista de destinos configurados (nunca expone CLAVE). */
  async listarDestinos() {
    return query(
      'server',
      `SELECT ${DEST_COLS} FROM configuracion_usuario_replica ORDER BY orden, idsucursal`,
    );
  },

  /**
   * Resumen de la cola agrupado por destino y estado.
   * Devuelve filas { idsucursal, estado, cantidad }.
   */
  async resumenPorDestino() {
    return query(
      'server',
      `SELECT idsucursal, estado, COUNT(*) AS cantidad
         FROM replicacion_cola
        GROUP BY idsucursal, estado`,
    );
  },

  /**
   * Jobs de la cola, con filtros opcionales. No trae PAYLOAD (puede ser grande).
   * @param {{ idsucursal?: number, estado?: number, limit?: number }} f
   */
  async listarCola({ idsucursal = null, estado = null, limit = 200 } = {}) {
    const where = [];
    const params = [];
    if (idsucursal != null) { where.push('idsucursal = ?'); params.push(idsucursal); }
    if (estado != null) { where.push('estado = ?'); params.push(estado); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    return query(
      'server',
      `SELECT FIRST ${Number(limit) || 200}
              id, iduser, idsucursal, operacion, estado,
              COALESCE(intentos, 0) AS intentos, ultimo_error,
              fecha_alta, fecha_proc
         FROM replicacion_cola
         ${whereSql}
        ORDER BY id DESC`,
      params,
    );
  },

  /** Cuenta de jobs "abiertos" (PENDIENTE + PROCESANDO) — para la barra de progreso. */
  async contadorAbierto() {
    const rows = await query(
      'server',
      `SELECT COUNT(*) AS n FROM replicacion_cola WHERE estado IN (?, ?)`,
      [ESTADO.PENDIENTE, ESTADO.PROCESANDO]);
    return Number(rows[0]?.n) || 0;
  },

  /** Reencola un job (ERROR/BLOQUEADO → PENDIENTE) para que el worker lo reintente. */
  async reintentar(id) {
    return transaction('server', async (tx) => {
      await tx.query(
        `UPDATE replicacion_cola
            SET estado = ?, ultimo_error = NULL
          WHERE id = ? AND estado IN (?, ?)`,
        [ESTADO.PENDIENTE, id, ESTADO.ERROR, ESTADO.BLOQUEADO],
      );
      return 1;
    });
  },

  /** Reencola todos los jobs fallidos de un destino (o de todos si idsucursal null). */
  async reintentarDestino(idsucursal = null) {
    return transaction('server', async (tx) => {
      const params = [ESTADO.PENDIENTE, ESTADO.ERROR, ESTADO.BLOQUEADO];
      let sql = `UPDATE replicacion_cola SET estado = ?, ultimo_error = NULL
                  WHERE estado IN (?, ?)`;
      if (idsucursal != null) { sql += ' AND idsucursal = ?'; params.push(idsucursal); }
      await tx.query(sql, params);
      return 1;
    });
  },

  /**
   * Jobs PENDIENTE (estado 0) listos para procesar por el worker.
   * No incluye ERROR/BLOQUEADO (esos se reencolan manualmente a PENDIENTE).
   */
  async tomarPendientes(limit = 20) {
    return query(
      'server',
      `SELECT FIRST ${Number(limit) || 20} id, iduser, idsucursal, operacion, COALESCE(intentos,0) AS intentos
         FROM replicacion_cola WHERE estado = ? ORDER BY id`,
      [ESTADO.PENDIENTE],
    );
  },

  /** Marca un job como PROCESANDO (para reflejarlo en el menú mientras corre). */
  async marcarProcesando(id) {
    return query('server',
      `UPDATE replicacion_cola SET estado = ? WHERE id = ?`, [ESTADO.PROCESANDO, id]);
  },

  /**
   * Cierra un job con un estado final (o lo deja PENDIENTE para reintento).
   * @param {number} id
   * @param {number} estado  ESTADO.*
   * @param {string|null} error  texto (se trunca a 200)
   * @param {boolean} bumpIntento  incrementar INTENTOS
   */
  async marcar(id, estado, error = null, bumpIntento = false) {
    const sets = ['estado = ?', 'fecha_proc = CURRENT_TIMESTAMP', 'ultimo_error = ?'];
    const params = [estado, error ? String(error).slice(0, 200) : null];
    if (bumpIntento) sets.push('intentos = COALESCE(intentos,0) + 1');
    params.push(id);
    return query('server', `UPDATE replicacion_cola SET ${sets.join(', ')} WHERE id = ?`, params);
  },

  /**
   * Encola un job por cada destino activo (outbox). Lo consume el worker.
   * @param {{ iduser: string, operacion: string, payload?: object, idsucursal?: number|null }} job
   * @returns {Promise<number>} cantidad de jobs encolados
   */
  async encolar({ iduser, operacion, payload = null, idsucursal = null }) {
    const destinos = await query(
      'server',
      `SELECT idsucursal FROM configuracion_usuario_replica
        WHERE COALESCE(estado, 1) = 1 ${idsucursal != null ? 'AND idsucursal = ?' : ''}
        ORDER BY orden, idsucursal`,
      idsucursal != null ? [idsucursal] : [],
    );
    if (!destinos.length) return 0;

    // Dedupe: no encolar si ya hay un job PENDIENTE para ese (usuario, destino).
    // El worker lee los datos EN VIVO al procesar, así que un pendiente basta aunque
    // el usuario se edite N veces antes de drenar.
    const pend = await query(
      'server',
      `SELECT idsucursal FROM replicacion_cola WHERE iduser = ? AND estado = ?`,
      [iduser, ESTADO.PENDIENTE],
    );
    const yaEnCola = new Set(pend.map((p) => Number(p.idsucursal)));
    const objetivos = destinos.filter((d) => !yaEnCola.has(Number(d.idsucursal)));
    if (!objetivos.length) return 0;
    const payloadStr = payload == null ? null : JSON.stringify(payload);
    await transaction('server', async (tx) => {
      for (const d of objetivos) {
        await tx.query(
          `INSERT INTO replicacion_cola
             (id, iduser, idsucursal, operacion, payload, estado, intentos, fecha_alta)
           VALUES (GEN_ID(GEN_REPLICACION_COLA, 1), ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)`,
          [iduser, d.idsucursal, operacion, payloadStr, ESTADO.PENDIENTE],
        );
      }
    });
    return objetivos.length;
  },

  // ── Recordatorios de propagación de rol ─────────────────────────────────

  /** Marca (upsert) un rol como pendiente de propagar a sucursales. */
  async marcarRolPendiente(idtipo, descripcion = null) {
    const id = Number(idtipo);
    if (!Number.isInteger(id) || id <= 0) return 0;
    return transaction('server', async (tx) => {
      const ex = await tx.query(
        'SELECT 1 FROM replicacion_rol_pendiente WHERE idtipo_usuario = ?', [id]);
      if (ex.length) {
        await tx.query(
          'UPDATE replicacion_rol_pendiente SET descripcion = ?, fecha = CURRENT_TIMESTAMP WHERE idtipo_usuario = ?',
          [descripcion, id]);
      } else {
        await tx.query(
          'INSERT INTO replicacion_rol_pendiente (idtipo_usuario, descripcion, fecha) VALUES (?, ?, CURRENT_TIMESTAMP)',
          [id, descripcion]);
      }
      return 1;
    });
  },

  /** Lista los roles pendientes de propagar, con la cantidad de usuarios activos de cada uno. */
  async listarRolesPendientes() {
    const roles = await query(
      'server',
      'SELECT idtipo_usuario, descripcion, fecha FROM replicacion_rol_pendiente ORDER BY fecha DESC');
    // Contar usuarios activos por rol (en la BD system).
    for (const r of roles) {
      const c = await query(
        'system',
        'SELECT COUNT(*) AS n FROM usuario WHERE idtipo_usuario = ? AND COALESCE(estado,0) = 1',
        [r.idtipo_usuario]).catch(() => [{ n: 0 }]);
      r.usuarios = Number(c[0]?.n) || 0;
    }
    return roles;
  },

  async quitarRolPendiente(idtipo) {
    return query('server', 'DELETE FROM replicacion_rol_pendiente WHERE idtipo_usuario = ?', [Number(idtipo)]);
  },

  /** IDs de usuarios activos de un rol (BD system). */
  async usuariosDeRol(idtipo) {
    const rows = await query(
      'system',
      'SELECT iduser FROM usuario WHERE idtipo_usuario = ? AND COALESCE(estado,0) = 1',
      [Number(idtipo)]);
    return rows.map((r) => String(r.iduser).trim());
  },

  /**
   * Purga los jobs ENVIADO cuya fecha_proc supera la ventana de retención (horas).
   * Los ERROR/BLOQUEADO nunca se purgan. Devuelve nada (best-effort).
   */
  async purgarEnviados(horas = 48) {
    const h = Math.min(8760, Math.max(1, Number(horas) || 48));
    // orgonita_server es dialect 3 → usar DATEADD (la resta timestamp-número no aplica).
    return query(
      'server',
      `DELETE FROM replicacion_cola
        WHERE estado = ? AND fecha_proc IS NOT NULL
          AND fecha_proc < DATEADD(? HOUR TO CURRENT_TIMESTAMP)`,
      [ESTADO.ENVIADO, -h],
    );
  },
};

module.exports = ReplicacionModel;
