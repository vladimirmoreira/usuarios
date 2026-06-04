'use strict';

const { query, transaction } = require('../config/firebird');

/**
 * USUARIO_SUCURSAL (iduser, idsucursal, orden) — sin PK en el legacy.
 * Patrón: DELETE all + INSERT solo los habilitados.
 */
const UsuarioSucursalModel = {
  listarPorUsuario: (iduser) =>
    query(
      'server',
      `SELECT idsucursal, orden FROM usuario_sucursal
        WHERE UPPER(iduser) = UPPER(?)
        ORDER BY orden, idsucursal`,
      [iduser],
    ).catch(() => []),

  /**
   * Primera sucursal (orden mínimo) de TODOS los usuarios.
   * Devuelve [{ iduser: string (upper-trim), sucursal_nombre: string }]
   * La deduplicación al primero por usuario se hace en JS.
   */
  sucursalesBulk: () =>
    query(
      'server',
      `SELECT UPPER(TRIM(us.iduser)) AS iduser, s.nombre AS sucursal_nombre, us.orden
         FROM usuario_sucursal us
         JOIN sucursal s ON s.idsucursal = us.idsucursal
        ORDER BY UPPER(TRIM(us.iduser)), us.orden, us.idsucursal`,
    ).catch(() => []),

  /**
   * Reemplaza por completo la asignación de sucursales del usuario.
   * @param {string} iduser
   * @param {Array<{idsucursal:number, orden:number}>} items  Solo los habilitados.
   */
  replaceAll: (iduser, items) =>
    transaction('server', async (tx) => {
      await tx.query(
        `DELETE FROM usuario_sucursal WHERE UPPER(iduser) = UPPER(?)`,
        [iduser],
      );
      for (const { idsucursal, orden } of items) {
        await tx.query(
          `INSERT INTO usuario_sucursal (iduser, idsucursal, orden) VALUES (?, ?, ?)`,
          [iduser, idsucursal, orden ?? 0],
        );
      }
      return items.length;
    }),
};

module.exports = UsuarioSucursalModel;
