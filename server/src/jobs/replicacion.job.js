'use strict';

const cron = require('node-cron');
const ReplicacionModel = require('../models/replicacion.model');
const ReplicacionService = require('../services/replicacion.service');
const logger = require('../utils/logger');

const { ESTADO } = ReplicacionModel;

/** Heurística: ¿el fallo es de conexión (VPN/host caído) y conviene reintentar solo? */
function esErrorConexion(msg = '') {
  return /connect|ECONN|timeout|network request|unavailable|refused|closed|reset|host/i.test(msg);
}

let corriendo = false;

/**
 * Drena la cola: procesa los jobs PENDIENTE.
 *   - éxito limpio            → ENVIADO
 *   - éxito con dependencias  → BLOQUEADO (requiere atención; ver ultimo_error)
 *   - fallo de conexión       → queda PENDIENTE (reintenta el próximo tick) + intentos++
 *   - fallo de datos/SQL      → ERROR (reintento manual) + intentos++
 */
async function drenar(limit = 20) {
  if (corriendo) return { skipped: 'ya-corriendo' };
  corriendo = true;
  const stats = { procesados: 0, enviados: 0, bloqueados: 0, errores: 0, reintentos: 0 };
  try {
    const jobs = await ReplicacionModel.tomarPendientes(limit);
    for (const j of jobs) {
      stats.procesados++;
      await ReplicacionModel.marcarProcesando(j.id);
      try {
        const r = await ReplicacionService.replicarUsuario(j.idsucursal, j.iduser);
        if (r.bloqueado) {
          await ReplicacionModel.marcar(j.id, ESTADO.BLOQUEADO, (r.detalle.bloqueos || []).join('; '), false);
          stats.bloqueados++;
        } else {
          await ReplicacionModel.marcar(j.id, ESTADO.ENVIADO, null, false);
          stats.enviados++;
        }
      } catch (e) {
        const msg = e?.message || String(e);
        if (esErrorConexion(msg)) {
          await ReplicacionModel.marcar(j.id, ESTADO.PENDIENTE, msg, true); // reintenta solo
          stats.reintentos++;
        } else {
          await ReplicacionModel.marcar(j.id, ESTADO.ERROR, msg, true);
          stats.errores++;
        }
      }
    }
    if (stats.procesados) logger.info(stats, '[jobs] replicacion: cola drenada');
    return stats;
  } catch (e) {
    logger.error({ err: e?.message }, '[jobs] replicacion: error drenando cola');
    return { error: e?.message };
  } finally {
    corriendo = false;
  }
}

/**
 * Programa el drenado periódico de la cola.
 * Deshabilitar: ENABLE_REPLICACION_JOB=0. Frecuencia: REPLICACION_CRON (default cada minuto).
 */
function start() {
  if (process.env.ENABLE_REPLICACION_JOB === '0') {
    logger.info('[jobs] replicacion job DESHABILITADO (ENABLE_REPLICACION_JOB=0)');
    return null;
  }
  const expr = process.env.REPLICACION_CRON || '*/1 * * * *'; // cada minuto
  if (!cron.validate(expr)) {
    logger.warn({ expr }, '[jobs] expresión cron inválida para replicacion job');
    return null;
  }
  const task = cron.schedule(expr, () => { drenar(); },
    { timezone: process.env.TZ || 'America/Asuncion' });
  logger.info({ expr }, '[jobs] replicacion job programado');
  return task;
}

module.exports = { start, drenar };
