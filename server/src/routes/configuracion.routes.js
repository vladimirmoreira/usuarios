'use strict';

const router = require('express').Router();
const { z }  = require('zod');
const validate = require('../middlewares/validate');
const ctrl   = require('../controllers/configuracion.controller');

const ipParam = { params: z.object({ ip: z.string().min(1).max(15) }) };

const cfgBody = z.object({
  ip:            z.string().min(1).max(15),
  server:        z.string().max(100).optional().nullable(),
  sys_cfg:       z.string().max(100).optional().nullable(),
  master:        z.string().max(100).optional().nullable(),
  user_bd:       z.string().max(10).optional().nullable(),
  clave:         z.string().max(20).optional().nullable(),
  legajo:        z.number().int().min(0).max(1).optional().nullable(),
  biometrico:    z.number().int().min(0).max(1).optional().nullable(),
  gastronomia:   z.number().int().min(0).max(1).optional().nullable(),
  maximo:        z.number().int().optional().nullable(),
  complementario:z.number().int().min(0).max(1).optional().nullable(),
  contabilidad:  z.number().int().min(0).max(1).optional().nullable(),
  talento_humano:z.number().int().min(0).max(1).optional().nullable(),
  crear_sin_rol: z.number().int().min(0).max(1).optional().nullable(),
  clonar:        z.number().int().min(0).max(1).optional().nullable(),
  replicar:      z.number().int().min(0).max(1).optional().nullable(),
  dias_inactividad: z.number().int().optional().nullable(),
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

// Empresas: system (ACCESIBLE) + master (IDEMPRESA_SYSTEM). Van antes de '/:ip'.
const idEmpParam = { params: z.object({ idempresa: z.string().min(1).max(2) }) };
router.get('/empresas', ctrl.listarEmpresas);
router.put('/empresas/system/:idempresa',
  validate({ ...idEmpParam, body: z.object({ accesible: z.coerce.number().int().min(0).max(1) }) }),
  ctrl.setEmpresaAccesible);
router.put('/empresas/master/:idempresa',
  validate({ ...idEmpParam, body: z.object({ idempresa_system: z.string().max(2).nullable().optional() }) }),
  ctrl.setEmpresaMasterMapping);

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
