'use strict';

const { query, transaction } = require('../config/firebird');

const PermisoModel = {
  async obtenerUsuarioEmpresa(iduser, idempresa) {
    const rows = await query(
      'system',
      `SELECT FIRST 1 iduser, idempresa, permisos, movimientos, permiso_gg, menu_gg_2
         FROM usuarioempresa WHERE UPPER(iduser) = UPPER(?) AND idempresa = ?`,
      [iduser, idempresa],
    );
    return rows[0] || null;
  },

  /** Crea la fila con valores vacíos si todavía no existe (no falla si ya existe). */
  async inicializar(iduser, idempresa) {
    await transaction('system', async (tx) => {
      const existe = await tx.query(
        `SELECT FIRST 1 iduser FROM usuarioempresa
          WHERE UPPER(iduser) = UPPER(?) AND idempresa = ?`,
        [iduser, idempresa],
      );
      if (!existe.length) {
        await tx.query(
          `INSERT INTO usuarioempresa (iduser, idempresa, permisos, movimientos, permiso_gg, menu_gg_2)
           VALUES (?, ?, '', '', '', '')`,
          [iduser, idempresa],
        );
      }
    });
  },

  /** Actualiza un campo de usuarioempresa. Si la fila no existe la crea primero (upsert). */
  async actualizarCampo(iduser, idempresa, campo, valor) {
    const permitidos = ['permisos', 'movimientos', 'permiso_gg', 'menu_gg_2'];
    if (!permitidos.includes(campo)) throw new Error(`Campo no permitido: ${campo}`);
    return transaction('system', async (tx) => {
      const existe = await tx.query(
        `SELECT FIRST 1 iduser FROM usuarioempresa
          WHERE UPPER(iduser) = UPPER(?) AND idempresa = ?`,
        [iduser, idempresa],
      );
      if (existe.length) {
        await tx.query(
          `UPDATE usuarioempresa SET ${campo} = ?
            WHERE UPPER(iduser) = UPPER(?) AND idempresa = ?`,
          [valor, iduser, idempresa],
        );
      } else {
        await tx.query(
          `INSERT INTO usuarioempresa (iduser, idempresa, ${campo}) VALUES (?, ?, ?)`,
          [iduser, idempresa, valor],
        );
      }
      return 1;
    });
  },
};

module.exports = PermisoModel;
