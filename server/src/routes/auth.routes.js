'use strict';

const router = require('express').Router();
const { z } = require('zod');
const validate = require('../middlewares/validate');
const ctrl = require('../controllers/auth.controller');

router.post(
  '/login',
  validate({
    body: z.object({
      iduser: z.string().min(1).max(10),
      pass: z.string().min(1).max(20),
      // Fase 2 del login multi-empresa: la empresa elegida del combo (opcional).
      idempresa: z.string().max(2).optional(),
    }),
  }),
  ctrl.login,
);

router.post(
  '/refresh',
  validate({ body: z.object({ refreshToken: z.string() }) }),
  ctrl.refresh,
);

module.exports = router;
