'use strict';

const cron = require('node-cron');
const InactividadModel = require('../models/inactividad.model');
const logger = require('../utils/logger');

/**
 * Job semanal: lunes 06:00 hora del servidor.
 *
 * NO inhabilita automáticamente — sólo registra en el log los candidatos
 * detectados para que el operador los revise en la UI (`/usuarios/inactividad`).
 * Esto evita bajas masivas no supervisadas.
 *
 * Habilitar/deshabilitar vía env: ENABLE_INACTIVIDAD_JOB=1
 */
function start() {
  if (process.env.ENABLE_INACTIVIDAD_JOB !== '1') {
    logger.info('[jobs] inactividad job DESHABILITADO (ENABLE_INACTIVIDAD_JOB!=1)');
    return null;
  }

  const expr = process.env.INACTIVIDAD_CRON || '0 6 * * 1'; // lun 06:00
  if (!cron.validate(expr)) {
    logger.warn({ expr }, '[jobs] expresión cron inválida para inactividad job');
    return null;
  }

  const task = cron.schedule(expr, async () => {
    const inicio = Date.now();
    try {
      const { dias, rows } = await InactividadModel.listar(null);
      logger.info({
        evento: 'inactividad.scan',
        dias,
        candidatos: rows.length,
        ms: Date.now() - inicio,
        top: rows.slice(0, 10).map((r) => ({
          iduser: r.iduser, diasInactivo: r.diasInactivo, ultimaFecha: r.ultimaFecha,
        })),
      }, `[jobs] inactividad: ${rows.length} candidatos (umbral ${dias}d)`);
    } catch (e) {
      logger.error({ err: e?.message }, '[jobs] inactividad: error en escaneo');
    }
  }, { timezone: process.env.TZ || 'America/Asuncion' });

  logger.info({ expr }, '[jobs] inactividad job programado');
  return task;
}

module.exports = { start };
