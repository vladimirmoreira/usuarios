'use strict';

const router = require('express').Router();
const { z } = require('zod');
const validate = require('../middlewares/validate');
const ctrl = require('../controllers/rol.controller');

// idperfil = 0 está reservado para el superusuario Admin (no existe en tipo_usuario)
const idParam = { params: z.object({ idperfil: z.coerce.number().int().min(0) }) };
const flagsBody = z.object({ flags: z.array(z.boolean()) });

const rolBody = z.object({
  descripcion: z.string().min(1).max(60),
  iduser: z.string().min(1).max(20),
  tipo: z.coerce.number().int().min(0).max(1),
  master: z.coerce.number().int().min(0).max(1).optional(),
});

const rolUpdateBody = z.object({
  descripcion: z.string().min(1).max(60),
  tipo: z.coerce.number().int().min(0).max(1),
  estado: z.coerce.number().int().min(0).max(1),
  master: z.coerce.number().int().min(0).max(1).optional(),
  edicion_rol: z.coerce.number().int().min(0).max(1).optional(),
});

router.get('/', ctrl.listar);
router.post('/', validate({ body: rolBody }), ctrl.crear);
router.put('/:idperfil', validate({ ...idParam, body: rolUpdateBody }), ctrl.actualizar);
router.delete('/:idperfil', validate(idParam), ctrl.eliminar);

router.get('/:idperfil/accesos', validate(idParam), ctrl.obtenerAccesos);
router.get('/:idperfil/usuarios', validate(idParam), ctrl.listarUsuarios);
router.post(
  '/:idperfil/propagar',
  validate({
    ...idParam,
    body: z.object({
      excluidos: z.array(z.string().min(1).max(10)).default([]),
    }),
  }),
  ctrl.propagar,
);

router.put(
  '/:idperfil/menu',
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

router.put('/:idperfil/permisos-generales', validate({ ...idParam, body: flagsBody }), ctrl.actualizarPermisosGenerales);
router.put('/:idperfil/movimientos',        validate({ ...idParam, body: flagsBody }), ctrl.actualizarMovimientos);
router.put('/:idperfil/pdv',                validate({ ...idParam, body: flagsBody }), ctrl.actualizarPdv);
router.put('/:idperfil/permiso-gg',         validate({ ...idParam, body: flagsBody }), ctrl.actualizarPermisoGg);

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

router.get('/:idperfil/conceptos', validate(idParam), ctrl.obtenerConceptos);
router.put(
  '/:idperfil/conceptos',
  validate({ ...idParam, body: z.object({ items: z.array(conceptoItemSchema) }) }),
  ctrl.actualizarConceptos,
);

// ── Sucursales por rol ──────────────────────────────────
const sucursalItemSchema = z.object({
  idsucursal: z.number().int(),
  habilitada: z.boolean(),
  orden: z.number().int().optional(),
});
router.get('/:idperfil/sucursales', validate(idParam), ctrl.obtenerSucursales);
router.put(
  '/:idperfil/sucursales',
  validate({ ...idParam, body: z.object({ items: z.array(sucursalItemSchema) }) }),
  ctrl.actualizarSucursales,
);

// ── Depósitos por rol (salida / entrada) ──────────────────────
const depositoItemSchema = z.object({
  iddeposito: z.number().int(),
  salida: z.boolean(),
  entrada: z.boolean(),
  ordenSalida: z.number().int().optional(),
  ordenEntrada: z.number().int().optional(),
});
router.get('/:idperfil/depositos', validate(idParam), ctrl.obtenerDepositos);
router.put(
  '/:idperfil/depositos',
  validate({ ...idParam, body: z.object({ items: z.array(depositoItemSchema) }) }),
  ctrl.actualizarDepositos,
);

// ── Master (Contabilidad / RRHH) ───────────────────────────────────────
const masterBody = z.object({
  permisos: z.array(z.boolean()).length(9),
  menu: z.array(z.boolean()).length(19),
});
router.get('/:idperfil/master', validate(idParam), ctrl.obtenerMaster);
router.put('/:idperfil/master', validate({ ...idParam, body: masterBody }), ctrl.actualizarMaster);

module.exports = router;
