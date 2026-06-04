'use strict';

const router = require('express').Router();
const { z } = require('zod');
const validate = require('../middlewares/validate');
const ctrl = require('../controllers/accesos.controller');

const idParam = { params: z.object({ iduser: z.string().min(1).max(10) }) };

router.get('/:iduser', validate(idParam), ctrl.obtenerAccesos);

router.put(
  '/:iduser/menu',
  validate({
    ...idParam,
    body: z.object({
      items: z.array(
        z.object({
          idmenu_principal: z.number().int(),
          permiso: z.number().int().min(0).max(1),
        }),
      ),
    }),
  }),
  ctrl.actualizarMenu,
);

router.put(
  '/:iduser/permisos-generales',
  validate({ ...idParam, body: z.object({ flags: z.array(z.boolean()) }) }),
  ctrl.actualizarPermisosGenerales,
);

router.put(
  '/:iduser/movimientos',
  validate({ ...idParam, body: z.object({ flags: z.array(z.boolean()) }) }),
  ctrl.actualizarMovimientos,
);

router.put(
  '/:iduser/pdv',
  validate({ ...idParam, body: z.object({ flags: z.array(z.boolean()) }) }),
  ctrl.actualizarPdv,
);

router.put(
  '/:iduser/permiso-gg',
  validate({ ...idParam, body: z.object({ flags: z.array(z.boolean()) }) }),
  ctrl.actualizarPermisoGg,
);

const conceptoItemSchema = z.object({
  idtipomovimiento: z.number().int(),
  permiso: z.number().int().min(0).max(1),
  permisoVarios: z.array(z.boolean()).length(15),
  idtalonario:  z.number().int().nullable().optional(),
  idvendedor:   z.number().int().nullable().optional(),
  idpersona:    z.number().int().nullable().optional(),
  idplanventa:  z.number().int().nullable().optional(),
  idcondicion:  z.number().int().nullable().optional(),
});

router.get('/:iduser/conceptos', validate(idParam), ctrl.obtenerConceptos);
router.put(
  '/:iduser/conceptos',
  validate({ ...idParam, body: z.object({ items: z.array(conceptoItemSchema) }) }),
  ctrl.actualizarConceptos,
);

// ── Sucursales por usuario ──────────────────────────────────────────────
const sucursalItemSchema = z.object({
  idsucursal: z.number().int(),
  habilitada: z.boolean(),
  orden: z.number().int().optional(),
});
router.get('/:iduser/sucursales', validate(idParam), ctrl.obtenerSucursales);
router.put(
  '/:iduser/sucursales',
  validate({ ...idParam, body: z.object({ items: z.array(sucursalItemSchema) }) }),
  ctrl.actualizarSucursales,
);

// ── Depósitos por usuario (salida / entrada) ────────────────────────────
const depositoItemSchema = z.object({
  iddeposito: z.number().int(),
  salida: z.boolean(),
  entrada: z.boolean(),
  ordenSalida: z.number().int().optional(),
  ordenEntrada: z.number().int().optional(),
});
router.get('/:iduser/depositos', validate(idParam), ctrl.obtenerDepositos);
router.put(
  '/:iduser/depositos',
  validate({ ...idParam, body: z.object({ items: z.array(depositoItemSchema) }) }),
  ctrl.actualizarDepositos,
);

// ── Master (Contabilidad / RRHH) ───────────────────────────────────────
const masterBody = z.object({
  permisos: z.array(z.boolean()).length(9),
  menu: z.array(z.boolean()).length(19),
});
router.get('/:iduser/master', validate(idParam), ctrl.obtenerMaster);
router.put('/:iduser/master', validate({ ...idParam, body: masterBody }), ctrl.actualizarMaster);

module.exports = router;
