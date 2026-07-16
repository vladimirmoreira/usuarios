'use strict';

const router = require('express').Router();
const { z } = require('zod');
const validate = require('../middlewares/validate');
const requireAuthorized = require('../middlewares/requireAuthorized');
const ctrl = require('../controllers/replicacion.controller');

// Todo el módulo de Replicación es solo para ADMIN / usuarios AUTORIZADOS.
router.use(requireAuthorized);

router.get('/estado', ctrl.estado);
router.get('/cola', ctrl.cola);
router.get('/progreso', ctrl.progreso);
router.get('/alertas', ctrl.alertas);
router.get('/roles-pendientes', ctrl.rolesPendientes);

router.post('/rol/:idtipo/propagar',
  validate({ params: z.object({ idtipo: z.coerce.number().int().positive() }) }),
  ctrl.propagarRol);

router.post('/cola/:id/reintentar',
  validate({ params: z.object({ id: z.coerce.number().int().positive() }) }),
  ctrl.reintentar);

router.post('/reintentar-destino',
  validate({ body: z.object({ idsucursal: z.coerce.number().int().optional().nullable() }) }),
  ctrl.reintentarDestino);

router.post('/usuario/:iduser',
  validate({
    params: z.object({ iduser: z.string().min(1).max(10) }),
    body: z.object({ idsucursal: z.coerce.number().int().optional().nullable() }).partial(),
  }),
  ctrl.replicarUsuario);

module.exports = router;
