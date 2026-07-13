'use strict';

const { query, transaction } = require('../config/firebird');
const { decodeRows } = require('../utils/charset');

// Filtro SQL: excluye idmenus malformados (segmento idempresa vacío → '__'
// consecutivo, p.ej. 'mnuRpt__3'). Replica cómo el legacy ignora esas entradas.
const SIN_MALFORMADO = `idmenu NOT LIKE '%\\_\\_%' ESCAPE '\\'`;

/**
 * Deduplica por idmenu conservando el primero (las filas vienen ordenadas por
 * idmenu_principal). Junto con SIN_MALFORMADO, replica el criterio del legacy:
 * ignorar 'mnuRpt__N' y, si hay válidos repetidos, quedarse con el primero.
 */
function dedupMenu(rows) {
  const seen = new Set();
  return rows.filter((r) => (seen.has(r.idmenu) ? false : (seen.add(r.idmenu), true)));
}

const MenuModel = {
  async listarPorUsuario(iduser, idempresa) {
    return query(
      'system',
      `SELECT idmenu_principal, idempresa,
              CAST(iduser AS VARCHAR(10) CHARACTER SET OCTETS) AS iduser,
              CAST(idmenu AS VARCHAR(40) CHARACTER SET OCTETS) AS idmenu,
              CAST(titulo AS VARCHAR(120) CHARACTER SET OCTETS) AS titulo,
              permiso
         FROM menu_general
        WHERE CAST(UPPER(TRIM(iduser)) AS VARCHAR(10) CHARACTER SET OCTETS) = CAST(? AS VARCHAR(10) CHARACTER SET OCTETS)
          AND idempresa = ?
          AND ${SIN_MALFORMADO}
        ORDER BY idmenu_principal`,
      [String(iduser || '').trim().toUpperCase(), idempresa],
    ).then((r) => dedupMenu(decodeRows(r, ['iduser', 'idmenu', 'titulo'])));
  },

  async listarPlantillaPorPerfil(idperfil) {
    return query(
      'system',
      `SELECT m.idmenu_principal,
              CAST(m.idmenu AS VARCHAR(40) CHARACTER SET OCTETS) AS idmenu,
              CAST(m.titulo AS VARCHAR(120) CHARACTER SET OCTETS) AS titulo,
              m.permiso
         FROM menu_general m
        WHERE UPPER(m.iduser) = (
              SELECT FIRST 1 UPPER(iduser) FROM tipo_usuario WHERE idtipo_usuario = ?
        )
          AND m.${SIN_MALFORMADO}
        ORDER BY m.idmenu_principal`,
      [idperfil],
    ).then((r) => decodeRows(r, ['idmenu', 'titulo']));
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
    const adminRows = dedupMenu(await query(
      'system',
      `SELECT idmenu_principal, CAST(idmenu AS VARCHAR(40) CHARACTER SET OCTETS) AS idmenu,
              CAST(titulo AS VARCHAR(120) CHARACTER SET OCTETS) AS titulo
         FROM menu_general
        WHERE UPPER(iduser) = 'ADMIN' AND idempresa = ?
          AND ${SIN_MALFORMADO}
        ORDER BY idmenu_principal`,
      [idempresa],
    ));
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

    return this.listarPorUsuario(iduser, idempresa);
  },
};

module.exports = MenuModel;
