'use strict';

const cron = require('node-cron');
const UsuarioModel = require('../models/usuario.model');
const { auditarDirecto, OP } = require('../utils/audit');
const logger = require('../utils/logger');

/**
 * Job diario: caduca (estado=0) los usuarios cuya `HASTA_VIGENCIA` ya venció.
 * A diferencia del de inactividad, este SÍ inhabilita automáticamente porque la
 * fecha de vigencia es una decisión explícita del operador al dar de alta.
 *
 * Habilitar/deshabilitar vía env: ENABLE_VIGENCIA_JOB=1 (default: habilitado).
 * Horario:                        VIGENCIA_CRON (default 04:00 cada día).
 */
function start() {
  if (process.env.ENABLE_VIGENCIA_JOB === '0') {
    logger.info('[jobs] vigencia job DESHABILITADO (ENABLE_VIGENCIA_JOB=0)');
    return null;
  }

  const expr = process.env.VIGENCIA_CRON || '0 4 * * *'; // 04:00 cada día
  if (!cron.validate(expr)) {
    logger.warn({ expr }, '[jobs] expresión cron inválida para vigencia job');
    return null;
  }

  const task = cron.schedule(expr, async () => {
    const inicio = Date.now();
    try {
      const afectados = await UsuarioModel.caducarVencidos();
      if (afectados.length) {
        for (const iduser of afectados) {
          auditarDirecto({ iduser, idoperacion: OP.BAJA, rptUser: 'CRON_VIGENCIA',
            observacion: 'Baja automática por vigencia vencida' });
        }
      }
      logger.info({ evento: 'vigencia.scan', caducados: afectados.length, ms: Date.now() - inicio, iduser: afectados },
        `[jobs] vigencia: ${afectados.length} usuario(s) caducado(s)`);
    } catch (e) {
      logger.error({ err: e?.message }, '[jobs] vigencia: error en escaneo');
    }
  }, { timezone: process.env.TZ || 'America/Asuncion' });

  logger.info({ expr }, '[jobs] vigencia job programado');
  return task;
}

module.exports = { start };
