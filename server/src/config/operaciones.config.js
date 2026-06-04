'use strict';

/**
 * Cat\u00e1logo de operaciones (TIPO_OPERACION) y descripci\u00f3n declarativa
 * de cada sub-tarea. Sirve como \u00fanica fuente de verdad para:
 *   - audit.js (mapeo c\u00f3digo \u2192 texto en historial)
 *   - operaciones.service.js (orquestador)
 *   - frontend (consultable v\u00eda /api/catalogos/operaciones)
 *
 * Cada operaci\u00f3n declara:
 *   - id:           c\u00f3digo en TIPO_OPERACION
 *   - descripcion:  texto legible (idem TIPO_OPERACION.DESCRIPCION)
 *   - efectos:      lista de sub-tareas potenciales (con flag y BD afectada)
 *
 * "flag" determina cu\u00e1ndo aplicar la sub-tarea, en base a
 * CONFIGURACION_USUARIO por IP:
 *   - 'siempre'        \u2192 incondicional
 *   - 'gastronomia'    \u2192 s\u00f3lo si GASTRONOMIA = 1
 *   - 'legajo'         \u2192 s\u00f3lo si LEGAJO = 1
 *   - 'biometrico'     \u2192 s\u00f3lo si BIOMETRICO = 1
 *   - 'master'         \u2192 s\u00f3lo si el rol tiene MASTER = 1 y la IP est\u00e1 habilitada
 */
const OP = Object.freeze({
  ALTA:               1,
  BAJA:               2,
  RESET_CLAVE:        3,
  ELIMINAR_HUELLA:    4,
  REASIGNAR_SUCURSAL: 5,
  CAMBIO_PERFIL:      6,
  ACTUALIZAR_CUENTA:  7,
  VINCULAR_LEGAJO:    8,
  EXCLUIR_CUENTA:     9,
  MIGRAR_DATOS:       10,
  REACTIVAR:          11,
  LOGIN:              12,
  LOGIN_FALLIDO:      13,
});

const OPERACIONES = [
  {
    id: OP.ALTA, descripcion: 'Alta de Usuario',
    efectos: [
      { bd: 'system', accion: 'INSERT USUARIO (clave=documento)',                  flag: 'siempre' },
      { bd: 'system', accion: 'INSERT USUARIOEMPRESA (copia template perfil)',      flag: 'siempre' },
      { bd: 'system', accion: 'INSERT MENU_GENERAL (copia template perfil)',        flag: 'siempre' },
      { bd: 'server', accion: 'INSERT USUARIO_SUCURSAL',                            flag: 'siempre' },
      { bd: 'server', accion: 'INSERT USUARIO_DEPOSITO (salida)',                   flag: 'siempre' },
      { bd: 'server', accion: 'INSERT USUARIO_DEPOSITO1 (entrada)',                 flag: 'siempre' },
      { bd: 'server', accion: 'INSERT USUARIO_CONCEPTO',                            flag: 'siempre' },
      { bd: 'server', accion: 'UPDATE RH_CARGO.user_system',                        flag: 'legajo' },
      { bd: 'server', accion: 'INSERT GG_MESERO',                                   flag: 'gastronomia' },
      { bd: 'master', accion: 'UPSERT USUARIO + USUARIOEMPRESA (best-effort)',       flag: 'master' },
    ],
  },
  {
    id: OP.BAJA, descripcion: 'Baja de Usuario',
    efectos: [
      { bd: 'system', accion: 'UPDATE USUARIO.estado=0',                            flag: 'siempre' },
      { bd: 'server', accion: 'UPDATE GG_MESERO.estado=0',                          flag: 'gastronomia' },
      { bd: 'server', accion: 'DELETE RH_CARGO_BIO (huellas)',                      flag: 'biometrico' },
      { bd: 'master', accion: 'UPDATE USUARIO.estado=0 (best-effort)',              flag: 'master' },
    ],
  },
  {
    id: OP.RESET_CLAVE, descripcion: 'Reinicio de Clave',
    efectos: [
      { bd: 'system', accion: 'UPDATE USUARIO.pass',                                flag: 'siempre' },
      { bd: 'server', accion: 'UPDATE GG_MESERO.clave',                             flag: 'gastronomia' },
      { bd: 'master', accion: 'SYNC USUARIO.clave (best-effort)',                   flag: 'master' },
    ],
  },
  {
    id: OP.ELIMINAR_HUELLA, descripcion: 'Eliminación de Huella',
    efectos: [
      { bd: 'server', accion: 'DELETE RH_CARGO_BIO',                                flag: 'biometrico' },
    ],
  },
  {
    id: OP.REASIGNAR_SUCURSAL, descripcion: 'Reasignación de Sucursal',
    efectos: [
      { bd: 'server', accion: 'DELETE+INSERT USUARIO_SUCURSAL (reorden)',            flag: 'siempre' },
      { bd: 'server', accion: 'DELETE+INSERT USUARIO_DEPOSITO salida (reorden)',     flag: 'siempre' },
      { bd: 'server', accion: 'DELETE+INSERT USUARIO_DEPOSITO1 entrada (reorden)',   flag: 'siempre' },
      { bd: 'server', accion: 'UPDATE GG_MESERO.idsucursal',                         flag: 'gastronomia' },
    ],
  },
  {
    id: OP.CAMBIO_PERFIL, descripcion: 'Cambio de Perfil',
    efectos: [
      { bd: 'system', accion: 'UPDATE USUARIO.idtipo_usuario',                      flag: 'siempre' },
      { bd: 'server', accion: 'UPDATE GG_MESERO.idtipo_mesero',                     flag: 'gastronomia' },
      { bd: 'master', accion: 'SYNC USUARIOEMPRESA (best-effort)',                  flag: 'master' },
    ],
  },
  {
    id: OP.ACTUALIZAR_CUENTA, descripcion: 'Actualización de Cuenta',
    efectos: [
      { bd: 'system', accion: 'UPDATE USUARIO (nombre/apellido/documento)',          flag: 'siempre' },
      { bd: 'master', accion: 'UPSERT USUARIO (best-effort)',                       flag: 'master' },
    ],
  },
  {
    id: OP.VINCULAR_LEGAJO, descripcion: 'Vinculación con Legajo',
    efectos: [
      { bd: 'system', accion: 'UPDATE USUARIO.documento',                            flag: 'siempre' },
      { bd: 'server', accion: 'UPDATE RH_CARGO.user_system',                         flag: 'legajo' },
      { bd: 'server', accion: 'UPDATE GG_MESERO.rh_idpersona + idcargo',             flag: 'gastronomia' },
    ],
  },
  {
    id: OP.EXCLUIR_CUENTA, descripcion: 'Exclusión de Cuenta',
    efectos: [
      { bd: 'system', accion: 'UPDATE USUARIO.exclusion=1',                          flag: 'siempre' },
    ],
  },
  {
    id: OP.MIGRAR_DATOS, descripcion: 'Migración de Datos',
    efectos: [
      { bd: 'externa', accion: 'Replicación a servidores destino (pendiente)',        flag: 'siempre' },
    ],
  },
  {
    id: OP.REACTIVAR, descripcion: 'Re-Activar Cuenta',
    efectos: [
      { bd: 'system', accion: 'UPDATE USUARIO.estado=1',                             flag: 'siempre' },
      { bd: 'master', accion: 'UPDATE USUARIO.estado=1 (best-effort)',               flag: 'master' },
    ],
  },
  {
    id: OP.LOGIN, descripcion: 'Inicio de Sesión',
    efectos: [
      { bd: 'server', accion: 'INSERT HISTORIAL_USUARIO (login OK)', flag: 'siempre' },
    ],
  },
  {
    id: OP.LOGIN_FALLIDO, descripcion: 'Intento de Login Fallido',
    efectos: [
      { bd: 'server', accion: 'INSERT HISTORIAL_USUARIO (motivo)', flag: 'siempre' },
    ],
  },
];

const OP_BY_ID = OPERACIONES.reduce((acc, o) => { acc[o.id] = o; return acc; }, {});

module.exports = { OP, OPERACIONES, OP_BY_ID };
