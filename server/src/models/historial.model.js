'use strict';

const { query } = require('../config/firebird');
const { decodeRows } = require('../utils/charset');

/**
 * Auditoría: registra eventos en HISTORIAL_USUARIO (BD server).
 *
 * Estructura de la tabla:
 *   ID            INTEGER NOT NULL  (sin generator garantizado → MAX+1)
 *   USUARIO       VARCHAR(10)       (iduser destinatario de la acción)
 *   IDOPERACION   INTEGER NOT NULL  (FK a TIPO_OPERACION)
 *   FECHA         TIMESTAMP NOT NULL  (CURRENT_TIMESTAMP)  -- dialect 1: no soporta DATE
 *   AUTORIZACION  VARCHAR(10) NOT NULL (iduser que autoriza/ejecuta)
 *   OBSERVACION   BLOB sub_type 1   (descripción libre, opcional)
 */
const HistorialModel = {
  /**
   * Inserta una fila de historial. Si `iduser` u `rptUser` superan 10 chars,
   * se truncan para respetar el VARCHAR(10).
   */
  async registrar({ iduser, idoperacion, rptUser, observacion = null }) {
    if (!iduser || !idoperacion || !rptUser) return 0;
    const u  = String(iduser).trim().slice(0, 10);
    const op = Number(idoperacion);
    const rp = String(rptUser).trim().slice(0, 10) || 'SYSTEM';
    const obs = observacion == null ? null : String(observacion);
    await query(
      'server',
      `INSERT INTO historial_usuario (id, usuario, idoperacion, fecha, autorizacion, observacion)
       VALUES (GEN_ID(GEN_HISTORIAL_USUARIO, 1), ?, ?, CURRENT_TIMESTAMP, ?, ?)`,  /* dialect 1 */
      [u, op, rp, obs],
    );
    return 1;
  },

  /**
   * Consulta global paginada con filtros opcionales.
   * @param {{ usuario?, idoperacion?, autorizacion?, desde?, hasta?, page?, pageSize? }} opts
   */
  async listarGlobal({ usuario, idoperacion, autorizacion, desde, hasta, page = 1, pageSize = 50 } = {}) {
    const p    = Math.max(1, Number(page) || 1);
    const size = Math.min(200, Math.max(1, Number(pageSize) || 50));
    const offset = (p - 1) * size;

    const where       = [];
    const rowParams   = [];
    const countParams = [];

    const add = (cond, val) => { where.push(cond); rowParams.push(val); countParams.push(val); };

    if (usuario)     add('h.usuario CONTAINING ?',     String(usuario).trim());
    if (idoperacion != null && idoperacion !== '') add('h.idoperacion = ?', Number(idoperacion));
    if (autorizacion) add('h.autorizacion CONTAINING ?', String(autorizacion).trim());
    if (desde)        add('h.fecha >= CAST(? AS TIMESTAMP)', desde);  /* dialect 1 */
    if (hasta)        add('h.fecha <= CAST(? AS TIMESTAMP)', hasta);   /* dialect 1 */

    const whereStr = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [rows, totalRows] = await Promise.all([
      query(
        'server',
        `SELECT h.id,
                CAST(h.usuario AS VARCHAR(10) CHARACTER SET OCTETS) AS usuario,
                h.idoperacion,
                CAST(COALESCE(t.descripcion, CAST(h.idoperacion AS VARCHAR(10))) AS VARCHAR(120) CHARACTER SET OCTETS) AS descripcion,
                h.fecha,
                CAST(h.autorizacion AS VARCHAR(10) CHARACTER SET OCTETS) AS autorizacion,
                h.observacion
           FROM historial_usuario h
           LEFT JOIN tipo_operacion t ON t.idtipo_operacion = h.idoperacion
           ${whereStr}
          ORDER BY h.id DESC
          ROWS ? TO ?`,
        [...rowParams, offset + 1, offset + size],
      ),
      query(
        'server',
        `SELECT COUNT(*) AS total FROM historial_usuario h ${whereStr}`,
        countParams,
      ),
    ]);

    const total = Number(totalRows[0]?.total || 0);
    return {
      rows: decodeRows(rows, ['usuario', 'descripcion', 'autorizacion', 'observacion']),
      page: p, pageSize: size, total, totalPages: Math.ceil(total / size) || 1,
    };
  },
};

module.exports = HistorialModel;
