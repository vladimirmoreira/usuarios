'use strict';

const { query, transaction } = require('../config/firebird');

const UsuarioTurnoModel = {

  /**
   * Devuelve todos los turnos de un usuario en un mes dado.
   * @param {string} iduser
   * @param {number} anio
   * @param {number} mes   1-based
   * @returns {Array<{id, idsucursal, fecha}>}
   */
  async listarMes(iduser, anio, mes) {
    const desde = `${anio}-${String(mes).padStart(2, '0')}-01`;
    const hasta = `${anio}-${String(mes).padStart(2, '0')}-31`;
    return query(
      'server',
      `SELECT id, idsucursal, fecha
         FROM usuario_turno_sucursal
        WHERE UPPER(iduser) = UPPER(?)
          AND fecha >= ? AND fecha <= ?
        ORDER BY fecha`,
      [iduser, desde, hasta],
    ).catch(() => []);
  },

  /**
   * Reemplaza los turnos de un usuario en un mes completo.
   * Recibe un array de { idsucursal, fecha } (fecha = 'YYYY-MM-DD').
   */
  async reemplazarMes(iduser, anio, mes, items) {
    const desde = `${anio}-${String(mes).padStart(2, '0')}-01`;
    const hasta = `${anio}-${String(mes).padStart(2, '0')}-31`;
    return transaction('server', async (tx) => {
      await tx.query(
        `DELETE FROM usuario_turno_sucursal
          WHERE UPPER(iduser) = UPPER(?) AND fecha >= ? AND fecha <= ?`,
        [iduser, desde, hasta],
      );
      for (const item of items) {
        await tx.query(
          `INSERT INTO usuario_turno_sucursal (id, iduser, idsucursal, fecha)
           VALUES (gen_id(gen_usuario_turno_sucursal, 1), ?, ?, ?)`,
          [iduser, item.idsucursal, item.fecha],
        );
      }
      return items.length;
    });
  },
};

module.exports = UsuarioTurnoModel;
