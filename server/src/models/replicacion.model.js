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

// Columnas reales de CONFIGURACION_USUARIO_REPLICA (dialect 1: SERVER/SYSTEM/MASTER
// están marcadas como reservadas; se referencian con alias *_bd para el lado JS).
const DEST_COLS = `idsucursal, ip, server AS server_bd, system AS system_bd,
                   master AS master_bd, COALESCE(orden, 0) AS orden, estado`;

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
   * Encola un job por cada destino activo (outbox). Lo consumirá el worker (etapa 2).
   * @param {{ iduser: string, operacion: string, payload?: object }} job
   * @returns {Promise<number>} cantidad de jobs encolados
   */
  async encolar({ iduser, operacion, payload = null }) {
    const destinos = await query(
      'server',
      `SELECT idsucursal FROM configuracion_usuario_replica
        WHERE COALESCE(estado, 1) = 1 ORDER BY orden, idsucursal`,
    );
    if (!destinos.length) return 0;
    const payloadStr = payload == null ? null : JSON.stringify(payload);
    await transaction('server', async (tx) => {
      for (const d of destinos) {
        await tx.query(
          `INSERT INTO replicacion_cola
             (id, iduser, idsucursal, operacion, payload, estado, intentos, fecha_alta)
           VALUES (GEN_ID(GEN_REPLICACION_COLA, 1), ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)`,
          [iduser, d.idsucursal, operacion, payloadStr, ESTADO.PENDIENTE],
        );
      }
    });
    return destinos.length;
  },
};

module.exports = ReplicacionModel;
