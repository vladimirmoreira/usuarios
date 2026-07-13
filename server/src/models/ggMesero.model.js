'use strict';

const { query } = require('../config/firebird');

const OCT = 'VARCHAR(10) CHARACTER SET OCTETS';
const up = (v) => String(v || '').trim().toUpperCase();

/**
 * gg_mesero (BD server): fila "plantilla" de mesero PDV asociada a un rol.
 * Se crea desde el editor de rol al activar "Usuario PDV". NO se toca a partir
 * de los usuarios (alta manual/importación) ni se elimina desde acá.
 */
const GgMeseroModel = {
  /** Devuelve la fila mesero del iduser plantilla, o null si no existe. */
  async obtenerPorUser(iduser) {
    const rows = await query(
      'server',
      `SELECT FIRST 1 idmesero, idsucursal, idtipo_mesero, COALESCE(estado, 0) AS estado
         FROM gg_mesero
        WHERE CAST(UPPER(TRIM(iduser)) AS ${OCT}) = CAST(? AS ${OCT})
        ORDER BY idmesero`,
      [up(iduser)],
    ).catch(() => []);
    return rows[0] || null;
  },

  /**
   * Inserta la fila plantilla de mesero para el rol.
   * nombre='Perfil', apellido=descripción del rol, nrodocumento='000000',
   * estado=1, clave='$$$$$$', externo=0, rh_idpersona/idcargo=NULL.
   */
  async crear({ iduser, apellido, idsucursal, idtipo_mesero }) {
    await query(
      'server',
      `INSERT INTO gg_mesero
         (idmesero, nombre, apellido, nrodocumento, estado, clave,
          iduser, externo, rh_idpersona, idcargo, idsucursal, idtipo_mesero)
       VALUES (gen_id(GEN_GG_MESERO, 1), 'Perfil', ?, '000000', 1, '$$$$$$',
               ?, 0, NULL, NULL, ?, ?)`,
      [apellido, iduser, idsucursal, idtipo_mesero],
    );
  },

  /** Actualiza sucursal / tipo de mesero de la fila existente (no crea ni borra). */
  async actualizar(iduser, { idsucursal, idtipo_mesero }) {
    await query(
      'server',
      `UPDATE gg_mesero SET idsucursal = ?, idtipo_mesero = ?
        WHERE CAST(UPPER(TRIM(iduser)) AS ${OCT}) = CAST(? AS ${OCT})`,
      [idsucursal, idtipo_mesero, up(iduser)],
    );
  },
};

module.exports = GgMeseroModel;
