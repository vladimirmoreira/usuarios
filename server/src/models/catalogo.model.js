'use strict';

const { query } = require('../config/firebird');
const { decodeRows } = require('../utils/charset');

// BD ASCII (orgonita) leída en NONE: el texto se castea a OCTETS en el SQL y se
// decodifica (latin1) en JS para evitar "Cannot transliterate" con acentos/ñ.
const O = (expr, alias, n = 120) => `CAST(${expr} AS VARCHAR(${n}) CHARACTER SET OCTETS) AS ${alias}`;

// Catálogos master de respaldo. Las tablas TMP$USUARIO_PERMISOS_MASTER /
// TMP$USUARIO_MENU_MASTER pueden no existir en la BD master del cliente
// (los seeds 01_master_setup.sql / 02_master_menu.sql no siempre se corren).
// Sin catálogo, el panel Contab./RRHH no renderiza ningún permiso aunque el
// usuario los tenga en master. Estos valores replican esos seeds.
const PERMISOS_MASTER_FALLBACK = [
  { posicion: 1, titulo: 'Agregar',         grupo: 'GENERAL' },
  { posicion: 2, titulo: 'Modificar',       grupo: 'GENERAL' },
  { posicion: 3, titulo: 'Eliminar',        grupo: 'GENERAL' },
  { posicion: 4, titulo: 'Imprimir',        grupo: 'GENERAL' },
  { posicion: 5, titulo: 'Administrador',   grupo: 'ADMIN'   },
  { posicion: 6, titulo: 'Conf. Reportes',  grupo: 'ADMIN'   },
  { posicion: 7, titulo: 'RRHH Grupos',     grupo: 'RRHH'    },
  { posicion: 8, titulo: 'RRHH Supervisor', grupo: 'RRHH'    },
  { posicion: 9, titulo: 'RRHH Areas',      grupo: 'RRHH'    },
];
const MENU_MASTER_FALLBACK = [
  { posicion: 1,  titulo: 'Diario',                  modulo: 1 },
  { posicion: 2,  titulo: 'Mayor',                   modulo: 1 },
  { posicion: 3,  titulo: 'Libro Fiscal',            modulo: 1 },
  { posicion: 4,  titulo: 'Inventario Activo Fijo',  modulo: 1 },
  { posicion: 5,  titulo: 'Procesos',                modulo: 1 },
  { posicion: 6,  titulo: 'Sumas y Saldos',          modulo: 1 },
  { posicion: 7,  titulo: 'Estados de Resultados',   modulo: 1 },
  { posicion: 8,  titulo: 'General',                 modulo: 1 },
  { posicion: 9,  titulo: 'Impositivo',              modulo: 1 },
  { posicion: 10, titulo: 'Plan de Cuentas',         modulo: 1 },
  { posicion: 11, titulo: 'Definiciones',            modulo: 1 },
  { posicion: 12, titulo: 'Propiedades',             modulo: 1 },
  { posicion: 13, titulo: 'Liquidación de Salarios', modulo: 2 },
  { posicion: 14, titulo: 'Movimientos',             modulo: 2 },
  { posicion: 15, titulo: 'Control de Acceso',       modulo: 2 },
  { posicion: 16, titulo: 'Planilla Seguro Social',  modulo: 2 },
  { posicion: 17, titulo: 'Libro Laboral',           modulo: 2 },
  { posicion: 18, titulo: 'Legajo del Personal',     modulo: 2 },
  { posicion: 19, titulo: 'Propiedades',             modulo: 2 },
];

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
             (SELECT COUNT(*) FROM menu_general mg WHERE UPPER(mg.iduser) = UPPER(u.iduser)) AS menu_count,
             (SELECT COUNT(*) FROM menu_general mg WHERE UPPER(mg.iduser) = UPPER(u.iduser) AND mg.permiso = 1) AS permisos_activos
        FROM usuario u
       WHERE UPPER(TRIM(u.iduser)) = 'ADMIN' ${estadoCond}
      UNION ALL
      SELECT t.idtipo_usuario,
             ${O('t.descripcion', 'descripcion')},
             ${O('t.iduser', 'iduser', 10)},
             t.tipo, COALESCE(t.estado, 0), COALESCE(t.master,0),
             COALESCE(t.edicion_rol, 0),
             (SELECT COUNT(*) FROM menu_general mg WHERE UPPER(mg.iduser) = UPPER(t.iduser)),
             (SELECT COUNT(*) FROM menu_general mg WHERE UPPER(mg.iduser) = UPPER(t.iduser) AND mg.permiso = 1)
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
      .then((r) => decodeRows(r, ['titulo', 'grupo']).map((x) => ({ ...x, posicion: Number(x.posicion) })))
      .then((r) => (r.length ? r : PERMISOS_MASTER_FALLBACK))
      .catch(() => PERMISOS_MASTER_FALLBACK),

  // `modulo` se lee crudo (numérico): el frontend compara `modulo === 1`/`=== 2`.
  menuMaster: () =>
    query('master', `SELECT posicion, ${O('titulo', 'titulo')}, modulo
         FROM tmp$usuario_menu_master ORDER BY posicion`)
      .then((r) => decodeRows(r, ['titulo']).map((x) => ({
        ...x, posicion: Number(x.posicion), modulo: Number(x.modulo),
      })))
      .then((r) => (r.length ? r : MENU_MASTER_FALLBACK))
      .catch(() => MENU_MASTER_FALLBACK),
};

module.exports = CatalogoModel;
