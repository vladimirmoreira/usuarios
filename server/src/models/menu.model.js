'use strict';

const { query, transaction } = require('../config/firebird');

const MenuModel = {
  async listarPorUsuario(iduser, idempresa) {
    return query(
      'system',
      `SELECT idmenu_principal, idempresa, iduser, idmenu, titulo, permiso
         FROM menu_general WHERE UPPER(iduser) = UPPER(?) AND idempresa = ?
         ORDER BY idmenu_principal`,
      [iduser, idempresa],
    );
  },

  async listarPlantillaPorPerfil(idperfil) {
    return query(
      'system',
      `SELECT m.idmenu_principal, m.idmenu, m.titulo, m.permiso
         FROM menu_general m
        WHERE UPPER(m.iduser) = (
              SELECT FIRST 1 UPPER(iduser) FROM tipo_usuario WHERE idtipo_usuario = ?
        )
        ORDER BY m.idmenu_principal`,
      [idperfil],
    );
  },

  /** Actualiza el flag PERMISO (0/1) para los items dados. Una transacción. */
  async actualizarPermisos(iduser, items) {
    return transaction('system', async (tx) => {
      for (const it of items) {
        await tx.query(
          `UPDATE menu_general SET permiso = ?
            WHERE iduser = ? AND idmenu_principal = ?`,
          [it.permiso, iduser, it.idmenu_principal],
        );
      }
      return items.length;
    });
  },

  /**
   * Copia todos los registros de menu_general del Admin para un iduser nuevo,
   * con permiso = 0 (todo desactivado). Usa gen_id(gen_menu_general, 1) para PKs.
   * Si el Admin no tiene registros para ese idempresa, no inserta nada.
   */
  async copiarDesdeAdmin(iduser, idempresa) {
    const adminRows = await query(
      'system',
      `SELECT idmenu, titulo FROM menu_general
        WHERE UPPER(iduser) = 'ADMIN' AND idempresa = ?
        ORDER BY idmenu_principal`,
      [idempresa],
    );
    if (!adminRows.length) return [];

    await transaction('system', async (tx) => {
      for (const row of adminRows) {
        await tx.query(
          `INSERT INTO menu_general (idmenu_principal, idempresa, iduser, idmenu, titulo, permiso)
           VALUES (gen_id(gen_menu_general, 1), ?, ?, ?, ?, 0)`,
          [idempresa, iduser, row.idmenu, row.titulo],
        );
      }
    });

    return query(
      'system',
      `SELECT idmenu_principal, idempresa, iduser, idmenu, titulo, permiso
         FROM menu_general WHERE UPPER(iduser) = UPPER(?) AND idempresa = ?
         ORDER BY idmenu_principal`,
      [iduser, idempresa],
    );
  },
};

module.exports = MenuModel;
