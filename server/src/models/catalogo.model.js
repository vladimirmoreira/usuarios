'use strict';

const { query } = require('../config/firebird');
const { decodeRows } = require('../utils/charset');

// BD ASCII (orgonita) leída en NONE: el texto se castea a OCTETS en el SQL y se
// decodifica (latin1) en JS para evitar "Cannot transliterate" con acentos/ñ.
const O = (expr, alias, n = 120) => `CAST(${expr} AS VARCHAR(${n}) CHARACTER SET OCTETS) AS ${alias}`;

const CatalogoModel = {
  perfiles: async ({ estado } = {}) => {
    const estadoCond = estado != null ? 'AND COALESCE(u.estado, 0) = ?' : '';
    const tipoCond   = estado != null ? 'WHERE COALESCE(estado, 0) = ?' : '';
    const sql = `
      SELECT CAST(0 AS INTEGER)  AS idtipo_usuario,
             ${O('u.nombre', 'descripcion')},
             ${O('u.iduser', 'iduser', 10)},
             CAST(0 AS INTEGER)  AS tipo,
             COALESCE(u.estado, 0) AS estado,
             CAST(0 AS INTEGER)  AS master,
             CAST(0 AS INTEGER)  AS edicion_rol,
             (SELECT COUNT(*) FROM menu_general mg WHERE UPPER(mg.iduser) = UPPER(u.iduser)) AS menu_count
        FROM usuario u
       WHERE UPPER(TRIM(u.iduser)) = 'ADMIN' ${estadoCond}
      UNION ALL
      SELECT t.idtipo_usuario,
             ${O('t.descripcion', 'descripcion')},
             ${O('t.iduser', 'iduser', 10)},
             t.tipo, COALESCE(t.estado, 0), COALESCE(t.master,0),
             COALESCE(t.edicion_rol, 0),
             (SELECT COUNT(*) FROM menu_general mg WHERE UPPER(mg.iduser) = UPPER(t.iduser))
        FROM tipo_usuario t ${tipoCond}
      ORDER BY 1, 2`;
    const params = estado != null ? [estado, estado] : [];
    return decodeRows(await query('system', sql, params), ['descripcion', 'iduser']);
  },

  sucursales: () =>
    query('server', `SELECT idsucursal, ${O('nombre', 'nombre')} FROM sucursal WHERE estado = 1 ORDER BY nombre`)
      .then((r) => decodeRows(r, ['nombre'])).catch(() => []),

  permisosGenerales: () =>
    query('system', `SELECT idpermiso, ${O('descripcion', 'descripcion')} FROM tmp$usuario_permisos_generales ORDER BY idpermiso`)
      .then((r) => decodeRows(r, ['descripcion'])).catch(() => []),

  permisosPdv: () =>
    query('system', `SELECT idpermiso, ${O('descripcion', 'descripcion')}, visible, indice
         FROM tmp$usuario_permisos_pdv WHERE COALESCE(visible,0) = 1 ORDER BY indice`)
      .then((r) => decodeRows(r, ['descripcion'])).catch(() => []),

  permisosConceptos: () =>
    query('system', `SELECT idpermiso_concepto, ${O('descripcion', 'descripcion')} FROM tmp$usuario_permisos_conceptos ORDER BY idpermiso_concepto`)
      .then((r) => decodeRows(r, ['descripcion'])).catch(() => []),

  talonarios: () =>
    query('server', `SELECT t.idtalonario, t.vencimiento, t.desde, t.hasta, ${O('s.nombre', 'sucursal')}
         FROM talonario t
         LEFT JOIN sucursal s ON s.idsucursal = t.idsucursal
        WHERE t.estado = 'A'
        ORDER BY t.idtalonario`)
      .then((r) => decodeRows(r, ['sucursal'])).catch(() => []),

  vendedores: () =>
    query('server', `SELECT idvendedor, ${O('nombre', 'nombre')}, ${O('apellido', 'apellido')} FROM vendedor
        WHERE estado = 1 ORDER BY apellido, nombre`)
      .then((r) => decodeRows(r, ['nombre', 'apellido'])).catch(() => []),

  planventas: () =>
    query('server', `SELECT idplanventa, ${O('descripcion', 'descripcion')} FROM planventa
        WHERE estado = 1 ORDER BY descripcion`)
      .then((r) => decodeRows(r, ['descripcion'])).catch(() => []),

  condiciones: () =>
    query('server', `SELECT idcondicion, ${O('descripcion', 'descripcion')} FROM condicion
        WHERE estado = 1 ORDER BY descripcion`)
      .then((r) => decodeRows(r, ['descripcion'])).catch(() => []),

  depositos: () =>
    query('server', `SELECT iddeposito, ${O('descripcion', 'descripcion')}, idsucursal FROM deposito
        WHERE estado = 1 ORDER BY iddeposito`)
      .then((r) => decodeRows(r, ['descripcion'])).catch(() => []),

  permisosMaster: () =>
    query('master', `SELECT posicion, ${O('titulo', 'titulo')}, ${O('grupo', 'grupo')}
         FROM tmp$usuario_permisos_master ORDER BY posicion`)
      .then((r) => decodeRows(r, ['titulo', 'grupo'])).catch(() => []),

  menuMaster: () =>
    query('master', `SELECT posicion, ${O('titulo', 'titulo')}, ${O('modulo', 'modulo')}
         FROM tmp$usuario_menu_master ORDER BY posicion`)
      .then((r) => decodeRows(r, ['titulo', 'modulo'])).catch(() => []),
};

module.exports = CatalogoModel;
