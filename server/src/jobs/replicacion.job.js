'use strict';

const ReplicacionModel = require('../models/replicacion.model');
const ReplicacionService = require('../services/replicacion.service');
const ConfiguracionModel = require('../models/configuracion.model');
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

// ── Loop auto-programado (intervalo DB-driven) ──────────────────────────────
// Actúa como RED DE SEGURIDAD (reintentos): el procesamiento normal es inmediato al
// encolar (el endpoint /replicacion/usuario y el enganche automático llaman a drenar()
// en el acto). Este loop solo reprocesa los PENDIENTE que quedaron por un destino caído.
// El intervalo sale de CONFIGURACION_USUARIO.TEMPORIZADOR_REPLICACION (minutos) y se
// RELEE en cada ciclo → cambiarlo desde la UI toma efecto sin reiniciar el server.

let timer = null;
let detenido = false;

async function intervaloMs() {
  const min = await ConfiguracionModel.temporizadorReplicacion().catch(() => 15);
  return Math.max(1, Number(min) || 15) * 60 * 1000;
}

/**
 * Drena la cola COMPLETA en lotes con throttling (para propagaciones masivas de rol).
 * Corre en background (no se debe await desde el request). Frena si no queda nada.
 */
async function drenarTodo({ maxCiclos = 1000, pausaMs = 300 } = {}) {
  for (let i = 0; i < maxCiclos; i++) {
    const s = await drenar(20);
    if (s && s.skipped) { await new Promise((r) => setTimeout(r, pausaMs)); continue; }
    if (!s || !s.procesados) break; // cola vacía
    await new Promise((r) => setTimeout(r, pausaMs)); // throttle entre lotes
  }
}

async function ciclo() {
  await drenar();
  // Purga de ENVIADO fuera de la ventana de retención (best-effort).
  try {
    const horas = await ConfiguracionModel.retencionReplicacionHoras();
    await ReplicacionModel.purgarEnviados(horas);
  } catch (e) { logger.warn({ err: e?.message }, '[jobs] replicacion: purga falló'); }
  if (detenido) return;
  const ms = await intervaloMs();
  timer = setTimeout(ciclo, ms);
}

function start() {
  if (process.env.ENABLE_REPLICACION_JOB === '0') {
    logger.info('[jobs] replicacion job DESHABILITADO (ENABLE_REPLICACION_JOB=0)');
    return null;
  }
  detenido = false;
  intervaloMs().then((ms) => {
    logger.info({ minutos: ms / 60000 }, '[jobs] replicacion job programado (intervalo DB-driven)');
    timer = setTimeout(ciclo, ms); // primer disparo tras el intervalo (no al arranque)
  });
  return { stop: () => { detenido = true; if (timer) clearTimeout(timer); } };
}

module.exports = { start, drenar, drenarTodo };
