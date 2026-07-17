'use strict';

/**
 * Rutas públicas (SIN auth) del portal de auto-reset de clave.
 * Capas de seguridad:
 *   1. ipLocal      → solo red local / allowlist (RESET_PORTAL_IPS).
 *   2. rate-limit   → 10 req/min por IP (más estricto que el global).
 *   3. servicio     → verificador de alta entropía, 1 h, un solo uso, 3 intentos.
 */

const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const validate = require('../middlewares/validate');
const ipLocal = require('../middlewares/ipLocal');
const ctrl = require('../controllers/publico.controller');

const limiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Esperá un minuto e intentá de nuevo.' },
});

const bodyIduser = {
  body: z.object({ iduser: z.string().min(1).max(10) }),
};
const bodyReset = {
  body: z.object({
    iduser: z.string().min(1).max(10),
    verificador: z.string().min(1).max(20),
  }),
};

router.use(ipLocal, limiter);

router.post('/reset/existe', validate(bodyIduser), ctrl.existe);
router.post('/reset/validar', validate(bodyReset), ctrl.validar);
router.post('/reset/aplicar', validate(bodyReset), ctrl.aplicar);

module.exports = router;
