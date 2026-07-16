'use strict';

const ConfiguracionModel = require('../models/configuracion.model');
const { horaActual, dentroFranja } = require('../utils/franja');

// Caché de la franja (evita pegarle a la BD en cada request). TTL 60s.
const CACHE_MS = 60_000;
let cache = { val: null, ts: 0 };

async function getFranja() {
  const now = Date.now();
  if (cache.val && now - cache.ts < CACHE_MS) return cache.val;
  const val = await ConfiguracionModel.franjaHoraria().catch(() => ({ inicio: null, fin: null }));
  cache = { val, ts: now };
  return val;
}

/**
 * Corta la sesión (403 con code FUERA_HORARIO) si la hora actual está fuera de la franja
 * de ingreso. No aplica a ADMIN. Best-effort: si el chequeo falla, deja pasar.
 * Debe usarse DESPUÉS de `auth` (necesita req.user).
 */
module.exports = async function franjaHoraria(req, res, next) {
  try {
    const id = (req.user?.iduser || '').trim().toUpperCase();
    if (!id || id === 'ADMIN') return next();
    const fr = await getFranja();
    if (dentroFranja(horaActual(), fr.inicio, fr.fin)) return next();
    return res.status(403).json({
      error: `Fuera del horario permitido (${fr.inicio} a ${fr.fin} hs).`,
      code: 'FUERA_HORARIO',
    });
  } catch (_) { return next(); }
};
