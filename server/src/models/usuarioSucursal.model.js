'use strict';

const { query, transaction } = require('../config/firebird');
const { decodeRows } = require('../utils/charset');

const OCT = 'VARCHAR(10) CHARACTER SET OCTETS';
const up = (v) => String(v || '').trim().toUpperCase();

/**
 * USUARIO_SUCURSAL (iduser, idsucursal, orden) — sin PK en el legacy.
 * Patrón: DELETE all + INSERT solo los habilitados.
 */
const UsuarioSucursalModel = {
  listarPorUsuario: (iduser) =>
    query(
      'server',
      `SELECT idsucursal, orden FROM usuario_sucursal
        WHERE CAST(UPPER(TRIM(iduser)) AS ${OCT}) = CAST(? AS ${OCT})
        ORDER BY orden, idsucursal`,
      [up(iduser)],
    ).catch(() => []),

  /**
   * Primera sucursal (orden mínimo) de TODOS los usuarios.
   * Devuelve [{ iduser: string (upper-trim), sucursal_nombre: string }]
   * La deduplicación al primero por usuario se hace en JS.
   */
  sucursalesBulk: () =>
    query(
      'server',
      `SELECT UPPER(TRIM(us.iduser)) AS iduser,
              CAST(s.nombre AS VARCHAR(120) CHARACTER SET OCTETS) AS sucursal_nombre,
              us.orden
         FROM usuario_sucursal us
         JOIN sucursal s ON s.idsucursal = us.idsucursal
        ORDER BY UPPER(TRIM(us.iduser)), us.orden, us.idsucursal`,
    ).then((r) => decodeRows(r, ['sucursal_nombre'])).catch(() => []),

  /**
   * Reemplaza por completo la asignación de sucursales del usuario.
   * @param {string} iduser
   * @param {Array<{idsucursal:number, orden:number}>} items  Solo los habilitados.
   */
  replaceAll: (iduser, items) =>
    transaction('server', async (tx) => {
      await tx.query(
        `DELETE FROM usuario_sucursal WHERE CAST(UPPER(TRIM(iduser)) AS ${OCT}) = CAST(? AS ${OCT})`,
        [up(iduser)],
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
