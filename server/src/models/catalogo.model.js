'use strict';

const { query } = require('../config/firebird');

const CatalogoModel = {
  perfiles: async ({ estado } = {}) => {
    // El usuario 'Admin' (superusuario) no vive en tipo_usuario pero debe aparecer
    // primero en la lista de roles. Se incorpora como fila sintética con idtipo_usuario=0.
    // menu_count indica si el rol ya tiene configuración en menu_general.
    const estadoCond = estado != null ? 'AND COALESCE(u.estado, 0) = ?' : '';
    const tipoCond   = estado != null ? 'WHERE COALESCE(estado, 0) = ?' : '';
    const sql = `
      SELECT CAST(0 AS INTEGER)  AS idtipo_usuario,
             u.nombre             AS descripcion,
             u.iduser,
             CAST(0 AS INTEGER)  AS tipo,
             COALESCE(u.estado, 0) AS estado,
             CAST(0 AS INTEGER)  AS master,
             CAST(0 AS INTEGER)  AS edicion_rol,
             (SELECT COUNT(*) FROM menu_general mg WHERE UPPER(mg.iduser) = UPPER(u.iduser)) AS menu_count
        FROM usuario u
       WHERE UPPER(TRIM(u.iduser)) = 'ADMIN' ${estadoCond}
      UNION ALL
      SELECT t.idtipo_usuario, t.descripcion, t.iduser, t.tipo, COALESCE(t.estado, 0), COALESCE(t.master,0),
             COALESCE(t.edicion_rol, 0),
             (SELECT COUNT(*) FROM menu_general mg WHERE UPPER(mg.iduser) = UPPER(t.iduser))
        FROM tipo_usuario t ${tipoCond}
      ORDER BY 1, 2`;
    const params = estado != null ? [estado, estado] : [];
    return query('system', sql, params);
  },

  sucursales: () =>
    query(
      'server',
      `SELECT idsucursal, nombre FROM sucursal WHERE estado = 1 ORDER BY nombre`,
    ).catch(() => []),

  permisosGenerales: () =>
    query(
      'system',
      `SELECT idpermiso, descripcion FROM tmp$usuario_permisos_generales ORDER BY idpermiso`,
    ).catch(() => []),

  permisosPdv: () =>
    query(
      'system',
      `SELECT idpermiso, descripcion, visible, indice
         FROM tmp$usuario_permisos_pdv WHERE COALESCE(visible,0) = 1 ORDER BY indice`,
    ).catch(() => []),

  permisosConceptos: () =>
    query(
      'system',
      `SELECT idpermiso_concepto, descripcion FROM tmp$usuario_permisos_conceptos ORDER BY idpermiso_concepto`,
    ).catch(() => []),

  talonarios: () =>
    query(
      'server',
      `SELECT t.idtalonario, t.vencimiento, t.desde, t.hasta, s.nombre AS sucursal
         FROM talonario t
         LEFT JOIN sucursal s ON s.idsucursal = t.idsucursal
        WHERE t.estado = 'A'
        ORDER BY t.idtalonario`,
    ).catch(() => []),

  vendedores: () =>
    query(
      'server',
      `SELECT idvendedor, nombre, apellido FROM vendedor
        WHERE estado = 1 ORDER BY apellido, nombre`,
    ).catch(() => []),

  planventas: () =>
    query(
      'server',
      `SELECT idplanventa, descripcion FROM planventa
        WHERE estado = 1 ORDER BY descripcion`,
    ).catch(() => []),

  condiciones: () =>
    query(
      'server',
      `SELECT idcondicion, descripcion FROM condicion
        WHERE estado = 1 ORDER BY descripcion`,
    ).catch(() => []),

  depositos: () =>
    query(
      'server',
      `SELECT iddeposito, descripcion, idsucursal FROM deposito
        WHERE estado = 1 ORDER BY iddeposito`,
    ).catch(() => []),

  permisosMaster: () =>
    query(
      'master',
      `SELECT posicion, titulo, grupo
         FROM tmp$usuario_permisos_master ORDER BY posicion`,
    ).catch(() => []),

  menuMaster: () =>
    query(
      'master',
      `SELECT posicion, titulo, modulo
         FROM tmp$usuario_menu_master ORDER BY posicion`,
    ).catch(() => []),
};

module.exports = CatalogoModel;
