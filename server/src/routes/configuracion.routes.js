'use strict';

const router = require('express').Router();
const { z }  = require('zod');
const validate = require('../middlewares/validate');
const ctrl   = require('../controllers/configuracion.controller');

const ipParam = { params: z.object({ ip: z.string().min(1).max(15) }) };

const cfgBody = z.object({
  ip:            z.string().min(1).max(15),
  server:        z.string().max(100).optional().nullable(),
  system:        z.string().max(100).optional().nullable(),
  master:        z.string().max(100).optional().nullable(),
  user_bd:       z.string().max(10).optional().nullable(),
  clave:         z.string().max(20).optional().nullable(),
  legajo:        z.number().int().min(0).max(1).optional().nullable(),
  biometrico:    z.number().int().min(0).max(1).optional().nullable(),
  gastronomia:   z.number().int().min(0).max(1).optional().nullable(),
  maximo:        z.number().int().optional().nullable(),
  complementario:z.number().int().min(0).max(1).optional().nullable(),
  ruta_archivo:  z.string().max(100).optional().nullable(),
  version_nro:   z.string().max(10).optional().nullable(),
  autorizado:    z.string().max(10).optional().nullable(),
});

// Chequeo de autorización (usado por el front para mostrar/ocultar el menú)
router.get('/autorizado', ctrl.verificarAutorizado);
router.get('/operaciones', ctrl.listarOperaciones);
router.get('/flags', ctrl.flags);

// Metadata seed — solo admins / autorizados
router.get('/metadata',          ctrl.estadoMetadata);
router.post('/metadata/ejecutar', ctrl.ejecutarMetadata);

router.get('/',    ctrl.listar);
router.post('/',   validate({ body: cfgBody }), ctrl.crear);
router.get('/:ip', validate(ipParam), ctrl.obtener);
router.put(
  '/:ip',
  validate({ ...ipParam, body: cfgBody.partial().extend({ ip: z.string().max(15).optional() }) }),
  ctrl.actualizar,
);
router.delete('/:ip', validate(ipParam), ctrl.eliminar);

module.exports = router;
