'use strict';

/**
 * Disparo AUTOMÁTICO de replicación tras una mutación de usuario.
 * - Best-effort: nunca rompe la operación de negocio (captura y loguea).
 * - Gateado por el flag CONFIGURACION_USUARIO.REPLICAR (cacheado 60s).
 * - Encola (con dedupe) + drena inmediato (fire-and-forget). Si el destino no
 *   responde, el job queda PENDIENTE y lo levanta el ciclo del worker.
 *
 * Uso en un controller, tras el éxito:  dispararReplicacion(iduser);
 */

const ReplicacionModel = require('../models/replicacion.model');
const ReplicacionJob = require('../jobs/replicacion.job');
const ConfiguracionModel = require('../models/configuracion.model');
const logger = require('../utils/logger');

const CACHE_MS = 60_000;
let _flag = { val: null, ts: 0 };

async function replicarHabilitado() {
  const now = Date.now();
  if (_flag.val !== null && now - _flag.ts < CACHE_MS) return _flag.val;
  const val = await ConfiguracionModel.replicarHabilitado().catch(() => false);
  _flag = { val, ts: now };
  return val;
}

/**
 * Encola la replicación de un usuario a todos los destinos activos y dispara el
 * drenado inmediato. No se debe `await` desde el controller (fire-and-forget).
 * @param {string} iduser
 */
async function dispararReplicacion(iduser) {
  try {
    if (!iduser) return;
    if (!(await replicarHabilitado())) return;
    const n = await ReplicacionModel.encolar({ iduser: String(iduser).trim(), operacion: 'AUTO' });
    if (n > 0) ReplicacionJob.drenar().catch(() => {});
  } catch (e) {
    logger.warn({ err: e?.message, iduser }, 'auto-replicación falló (best-effort)');
  }
}

/** Para varios usuarios (p. ej. alta batch). */
function dispararVarios(idusers = []) {
  for (const u of idusers) dispararReplicacion(u);
}

module.exports = { dispararReplicacion, dispararVarios };
