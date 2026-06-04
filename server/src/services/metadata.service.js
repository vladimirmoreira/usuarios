'use strict';

/**
 * Servicio de inicialización de metadatos (Metadata Seed).
 *
 * Puebla las tablas de referencia en las bases de datos system y server
 * con los catálogos base necesarios para el funcionamiento del módulo Usuarios.
 *
 * Tablas afectadas:
 *   - system: TMP$USUARIO_PERMISOS_GENERALES, TMP$USUARIO_PERMISOS_PDV, TIPO_USUARIO
 *   - server: TIPO_OPERACION
 *
 * El campo CONFIGURACION_USUARIO.METADATA_EJECUTADO actúa como cerrojo:
 *   0 → pendiente (permite ejecutar)
 *   1 → ya inicializado (bloquea nueva ejecución)
 */

const { query, transaction } = require('../config/firebird');
const logger = require('../utils/logger');

// ── Datos de referencia ──────────────────────────────────────────────────────

/** [idpermiso, descripcion] */
const PERMISOS_GENERALES = [
  [0,  'Agregar'],
  [1,  'Modificar'],
  [2,  'Eliminar'],
  [3,  'Imprimir'],
  [4,  'Agregar (Ayuda en Línea)'],
  [5,  'Modificar (Ayuda en Línea)'],
  [6,  'Administrar Planes de Venta'],
  [7,  'Admin'],
  [8,  'Ventas'],
  [9,  'Cuentas Corrientes'],
  [10, 'Administración de Reportes'],
  [11, 'Anulación Documentos'],
  [12, 'Control de Stock'],
  [13, 'Gestor de Avisos'],
  [14, 'Descuento'],
  [15, 'Compras'],
  [16, 'Estado Control Stock'],
  [17, 'Precio y Comisión'],
  [18, 'Tesorería'],
  [19, 'Administrador de OT'],
  [20, 'No Control Serie'],
  [21, 'Factura Contado - AutoCobro'],
  [22, 'Administración de Serie'],
  [23, 'Supervisor de Usuarios'],
  [24, 'Control Estado (Doc. Legales)'],
  [25, 'Control Estado (Interno)'],
  [26, 'Administrar Libro de Bancos'],
  [27, 'Contabilidad'],
  [28, 'Libro Banco - Conciliación'],
  [29, 'Modifica Cabecera Movimiento'],
  [30, 'Numeración Manual'],
  [31, 'Control de Turno'],
  [32, 'Re-imprimir Factura'],
  [33, 'Carga Recibos-Especial'],
  [34, 'Límite de Crédito'],
  [35, 'Caja Ciega'],
  [36, 'Administrar Producción'],
  [37, 'Sucursal'],
  [38, 'Ver Sucursal/ Reportes'],
];

/** [idpermiso, descripcion, visible, indice] */
const PERMISOS_PDV = [
  [3,  'Bloquear Sistema',  1,  0],
  [4,  'Salir',             1,  1],
  [5,  'Salon',             1,  2],
  [6,  'Delivery',          1,  3],
  [7,  'Carry Out',         1,  4],
  [8,  'Express',           1,  5],
  [12, 'Turno',             1,  6],
  [13, 'Pre-Producción',    1,  7],
  [14, 'KDS',               1,  8],
  [15, 'Marketing',         1,  9],
  [16, 'Eventos',           1, 10],
  [17, 'Menu Diario',       1, 11],
  [42, 'Vendedor',          1, 12],
  [43, 'Mesas',             1, 13],
  [44, 'Billetera',         1, 14],
  [48, 'Cambio de Clave',   1, 15],
  [49, 'Balanza',           1, 16],
  [50, 'Control de Bloqueos', 1, 17],
];

/**
 * [idtipo_usuario, descripcion, iduser, tipo, estado, master, edicion_rol]
 * Solo se insertan registros que no existan (UPDATE OR INSERT MATCHING pk).
 */
const TIPO_USUARIO = [
  [1,  'Administracion',       'ADMNISTRA',  0, 1, 0, 0],
  [2,  'Contabilidad',         'CONTABLE',   0, 1, 0, 0],
  [3,  'Compras',              'COMPRAS',    0, 1, 0, 0],
  [4,  'RRHH',                 'RRHH',       0, 0, 0, 0],
  [5,  'Marketing',            'MARKETING',  0, 1, 0, 0],
  [6,  'Operaciones',          'OPERACION',  0, 1, 0, 0],
  [7,  'Encargado de Ventas',  'VENTAS',     1, 1, 0, 1],
  [8,  'Vendedor',             'SERVICIO',   1, 1, 0, 1],
  [9,  'Logistica',            'REPARTO',    0, 1, 0, 0],
  [10, 'Caja',                 'CAJA',       1, 1, 0, 1],
  [11, 'Produccion',           'PRODUCCION', 0, 1, 0, 0],
];

/** [idtipo_operacion, descripcion] */
const TIPO_OPERACION = [
  [1,  'Alta de Usuario'],
  [2,  'Baja de Usuario'],
  [3,  'Reinicio de Clave'],
  [4,  'Eliminación de Huella'],
  [5,  'Reasignación de Sucursal'],
  [6,  'Cambio de Perfil'],
  [7,  'Actualización de Cuenta'],
  [8,  'Vinculación con Legajo'],
  [9,  'Exclusion de Cuenta'],
  [10, 'Migración de Datos'],
  [11, 'Re-Activar Cuenta'],
];

// ── Estado ───────────────────────────────────────────────────────────────────

/**
 * Devuelve { ejecutado: boolean } para la primera fila de CONFIGURACION_USUARIO.
 * Si no existe ninguna fila, retorna { ejecutado: false }.
 */
async function obtenerEstado() {
  try {
    const rows = await query(
      'server',
      `SELECT FIRST 1 COALESCE(metadata_ejecutado, 0) AS ejecutado
         FROM configuracion_usuario ORDER BY ip`,
    );
    return { ejecutado: Number(rows[0]?.ejecutado) === 1 };
  } catch (err) {
    logger.warn({ err }, 'MetadataService.obtenerEstado falló');
    return { ejecutado: false };
  }
}

// ── Seed helpers ─────────────────────────────────────────────────────────────

async function seedPermisosGenerales(tx) {
  // Limpieza previa + reinserción completa del catálogo
  await tx.query('DELETE FROM "TMP$USUARIO_PERMISOS_GENERALES"');
  for (const [idpermiso, descripcion] of PERMISOS_GENERALES) {
    await tx.query(
      'INSERT INTO "TMP$USUARIO_PERMISOS_GENERALES" (idpermiso, descripcion) VALUES (?, ?)',
      [idpermiso, descripcion],
    );
  }
}

async function seedPermisosPdv(tx) {
  await tx.query('DELETE FROM "TMP$USUARIO_PERMISOS_PDV"');
  for (const [idpermiso, descripcion, visible, indice] of PERMISOS_PDV) {
    await tx.query(
      'INSERT INTO "TMP$USUARIO_PERMISOS_PDV" (idpermiso, descripcion, visible, indice) VALUES (?, ?, ?, ?)',
      [idpermiso, descripcion, visible, indice],
    );
  }
}

async function seedTipoUsuario(tx) {
  // UPDATE OR INSERT: si ya existe el rol, actualiza; si no, crea.
  for (const [id, desc, iduser, tipo, estado, master, edicion_rol] of TIPO_USUARIO) {
    await tx.query(
      `UPDATE OR INSERT INTO tipo_usuario
         (idtipo_usuario, descripcion, iduser, tipo, estado, master, edicion_rol)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       MATCHING (idtipo_usuario)`,
      [id, desc, iduser, tipo, estado, master, edicion_rol],
    );
  }
}

async function seedTipoOperacion(tx) {
  for (const [id, descripcion] of TIPO_OPERACION) {
    await tx.query(
      `UPDATE OR INSERT INTO tipo_operacion (idtipo_operacion, descripcion)
       VALUES (?, ?) MATCHING (idtipo_operacion)`,
      [id, descripcion],
    );
  }
}

// ── Ejecución principal ───────────────────────────────────────────────────────

/**
 * Ejecuta la inicialización completa de metadatos.
 * Primero verifica que METADATA_EJECUTADO = 0; si ya fue ejecutado lanza error.
 *
 * @returns {{ ok: boolean, detalle: object }}
 */
async function ejecutar() {
  // 1. Verificar cerrojo
  const estado = await obtenerEstado();
  if (estado.ejecutado) {
    const err = new Error('Los metadatos ya fueron inicializados. METADATA_EJECUTADO = 1.');
    err.status = 409;
    throw err;
  }

  const detalle = {
    permisos_generales: 0,
    permisos_pdv: 0,
    tipo_usuario: 0,
    tipo_operacion: 0,
  };

  // 2. Seed BD system
  await transaction('system', async (tx) => {
    await seedPermisosGenerales(tx);
    detalle.permisos_generales = PERMISOS_GENERALES.length;

    await seedPermisosPdv(tx);
    detalle.permisos_pdv = PERMISOS_PDV.length;

    await seedTipoUsuario(tx);
    detalle.tipo_usuario = TIPO_USUARIO.length;
  });

  // 3. Seed BD server + marcar como ejecutado
  await transaction('server', async (tx) => {
    await seedTipoOperacion(tx);
    detalle.tipo_operacion = TIPO_OPERACION.length;

    // Marcar METADATA_EJECUTADO = 1 en todas las filas
    await tx.query('UPDATE configuracion_usuario SET metadata_ejecutado = 1');
  });

  logger.info({ detalle }, 'MetadataService: inicialización completada');
  return { ok: true, detalle };
}

module.exports = { obtenerEstado, ejecutar };
