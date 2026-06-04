'use strict';

/**
 * Job diario: aplica el calendario de sucursales programado (USUARIO_TURNO_SUCURSAL).
 *
 * Cada día a la hora configurada (default: 00:05) busca las filas cuya FECHA
 * coincide con el día actual y, por cada usuario, llama a reasignarSucursal
 * (que actualiza USUARIO_SUCURSAL, USUARIO_DEPOSITO, USUARIO_DEPOSITO1, GG_MESERO
 * y registra auditoría con OP.REASIGNAR_SUCURSAL = 5).
 *
 * Habilitar vía env: ENABLE_TURNO_SUCURSAL_JOB=1
 * Horario vía env:   TURNO_SUCURSAL_CRON=0 4 * * *   (04:00 por defecto)
 *
 * NOTA: el estado del usuario se verifica en la DB de sistema al momento de
 * ejecutarse el job, por lo que si un usuario fue dado de baja a mitad de mes
 * ya no recibirá la reasignación aunque tenga días en el calendario.
 */

const cron               = require('node-cron');
const { query }          = require('../config/firebird');
const OperacionesService = require('../services/operaciones.service');
const logger             = require('../utils/logger');

const JOB_USER = 'CRON_TURNO';   // rptUser para auditoría

async function aplicarHoy() {
  const hoy = new Date();
  const fecha = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;

  // 1. Obtener IDs de usuarios activos desde la DB de sistema (consulta separada
  //    porque usuario_turno_sucursal está en server DB y usuario en system DB)
  const activosRows = await query(
    'system',
    `SELECT iduser FROM usuario WHERE COALESCE(estado, 0) = 1`,
    [],
  );
  const activosSet = new Set(activosRows.map((r) => String(r.iduser).toUpperCase()));

  // 2. Obtener todos los turnos programados para hoy (server DB)
  const turnosHoy = await query(
    'server',
    `SELECT uts.iduser, uts.idsucursal
       FROM usuario_turno_sucursal uts
      WHERE uts.fecha = ?`,
    [fecha],
  );

  // Filtrar: solo usuarios activos en este momento
  const turnos = turnosHoy.filter((t) => activosSet.has(String(t.iduser).toUpperCase()));
  const omitidosInactivos = turnosHoy.length - turnos.length;
  if (omitidosInactivos > 0) {
    logger.info({ omitidosInactivos, fecha }, '[jobs] turno-sucursal: usuarios inactivos omitidos');
  }

  if (!turnos.length) {
    logger.info({ fecha }, '[jobs] turno-sucursal: sin asignaciones para hoy');
    return { fecha, procesados: 0, omitidos: 0, errores: 0 };
  }

  let procesados = 0;
  let omitidos   = 0;
  let errores    = 0;

  for (const t of turnos) {
    try {
      // Verificar si ya está en esa sucursal (orden=1) para no generar operación innecesaria
      const actual = await query(
        'server',
        `SELECT FIRST 1 idsucursal FROM usuario_sucursal
          WHERE UPPER(iduser) = UPPER(?) ORDER BY orden`,
        [t.iduser],
      );

      const sucActual = actual[0]?.idsucursal ?? null;
      if (sucActual === t.idsucursal) {
        omitidos++;
        continue;
      }

      // Usa OperacionesService para incluir GG_MESERO + auditoría completa
      await OperacionesService.reasignarSucursal({
        iduser:    t.iduser,
        idsucursal: t.idsucursal,
        rptUser:   JOB_USER,
        ip:        '127.0.0.1',
      });

      procesados++;
      logger.info({ iduser: t.iduser, idsucursal: t.idsucursal, fecha },
        '[jobs] turno-sucursal: reasignado');
    } catch (e) {
      errores++;
      logger.error({ iduser: t.iduser, idsucursal: t.idsucursal, err: e?.message },
        '[jobs] turno-sucursal: error al reasignar');
    }
  }

  return { fecha, procesados, omitidos, errores };
}

function start() {
  if (process.env.ENABLE_TURNO_SUCURSAL_JOB !== '1') {
    logger.info('[jobs] turno-sucursal job DESHABILITADO (ENABLE_TURNO_SUCURSAL_JOB!=1)');
    return null;
  }

  const expr = process.env.TURNO_SUCURSAL_CRON || '0 4 * * *'; // 04:00 cada día
  if (!cron.validate(expr)) {
    logger.warn({ expr }, '[jobs] expresión cron inválida para turno-sucursal job');
    return null;
  }

  const task = cron.schedule(expr, async () => {
    const inicio = Date.now();
    try {
      const r = await aplicarHoy();
      logger.info({
        ...r, ms: Date.now() - inicio,
      }, `[jobs] turno-sucursal: ${r.procesados} reasignados, ${r.omitidos} sin cambio, ${r.errores} errores`);
    } catch (e) {
      logger.error({ err: e?.message }, '[jobs] turno-sucursal: error general');
    }
  }, { timezone: process.env.TZ || 'America/Asuncion' });

  logger.info({ expr }, '[jobs] turno-sucursal job programado');
  return task;
}

module.exports = { start, aplicarHoy };
