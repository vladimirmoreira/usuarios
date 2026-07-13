'use strict';

const router = require('express').Router();
const { z } = require('zod');
const validate = require('../middlewares/validate');
const requireAuthorized = require('../middlewares/requireAuthorized');
const ctrl = require('../controllers/usuario.controller');
const inactividadCtrl = require('../controllers/inactividad.controller');

const idParam = { params: z.object({ iduser: z.string().min(1).max(10) }) };

router.get(
  '/',
  validate({
    query: z.object({
      busqueda: z.string().optional(),
      idperfil: z.coerce.number().optional(),
      estado: z.coerce.number().optional(),
    }),
  }),
  ctrl.listar,
);

router.get(
  '/sugerir',
  validate({
    query: z.object({
      nombre: z.string().min(1).max(25),
      apellido: z.string().min(1).max(50),
    }),
  }),
  ctrl.sugerirIduser,
);

router.get(
  '/check-documento',
  validate({ query: z.object({ documento: z.string().min(1).max(20), excludeIduser: z.string().optional() }) }),
  ctrl.checkDocumento,
);

router.post('/bloquear-sin-menu', ctrl.bloquearSinMenu);

// ── Export CSV (mismos filtros que listar) ─────────────────────────────────
router.get(
  '/export.csv',
  requireAuthorized,
  validate({ query: z.object({
    busqueda: z.string().optional(),
    idperfil: z.coerce.number().int().optional(),
    estado: z.coerce.number().int().optional(),
  }) }),
  ctrl.exportCsv,
);

// ── Importación masiva ─────────────────────────────────────────────────────
router.post(
  '/importar',
  requireAuthorized,
  validate({
    body: z.object({
      filas: z.array(z.object({
        nombre:     z.string().min(1).max(25),
        apellido:   z.string().min(1).max(50),
        documento:  z.string().min(1).max(20),
        perfil:     z.union([z.string(), z.number()]),
        idsucursal: z.union([z.string(), z.number()]),
      })).min(1).max(200),
    }),
  }),
  ctrl.importar,
);

// ── Inactividad (debe ir ANTES de '/:iduser' para evitar shadowing) ────────
router.get(
  '/inactividad',
  requireAuthorized,
  validate({ query: z.object({
    dias: z.coerce.number().int().min(1).max(3650).optional(),
    diasPorCaducar: z.coerce.number().int().min(0).max(3650).optional(),
    idperfil: z.coerce.number().int().positive().optional(),
  }) }),
  inactividadCtrl.listar,
);
router.post(
  '/inactividad/inhabilitar',
  requireAuthorized,
  validate({ body: z.object({
    iduser: z.string().min(1).max(10).optional(),
    ids: z.array(z.string().min(1).max(10)).max(100).optional(),
    dias: z.number().int().min(1).max(3650).optional(),
  }).refine((b) => !!b.iduser || (Array.isArray(b.ids) && b.ids.length > 0),
            { message: 'Debe indicar `iduser` o `ids[]`' }) }),
  inactividadCtrl.inhabilitar,
);

router.get('/:iduser', validate(idParam), ctrl.obtener);

router.post(
  '/',
  validate({
    body: z.object({
      iduser: z.string().min(1).max(10),
      nombre: z.string().min(1).max(25),
      apellido: z.string().min(1).max(25),
      documento: z.string().min(1).max(20),
      // idperfil = 0 => "Sin Rol" (usuario sin plantilla). En ese caso idsucursal es opcional.
      idperfil: z.number().int().min(0),
      idsucursal: z.number().int().min(0).optional(),
      control: z.number().int().min(0).max(1).default(1),
      foto: z.string().optional(),
      hasta_vigencia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    }),
  }),
  ctrl.crear,
);

router.patch(
  '/:iduser',
  validate({
    ...idParam,
    body: z.object({
      nombre: z.string().max(25).optional(),
      apellido: z.string().max(25).optional(),
      documento: z.string().max(20).optional(),
      hasta_vigencia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    }),
  }),
  ctrl.actualizar,
);

router.post('/:iduser/baja', validate(idParam), ctrl.dardeBaja);
router.post('/:iduser/reactivar', validate(idParam), ctrl.reactivar);
router.post('/:iduser/vincular-legajo', validate(idParam), ctrl.vincularLegajo);
router.post('/:iduser/reset-clave', validate(idParam), ctrl.resetClave);
router.post('/:iduser/reset-clave/iniciar', validate(idParam), ctrl.resetClaveIniciar);
router.post(
  '/:iduser/reset-clave/confirmar',
  validate({ ...idParam, body: z.object({ codigo: z.string().min(4).max(8), nuevaClave: z.string().max(20).optional() }) }),
  ctrl.resetClaveConfirmar,
);
router.post(
  '/:iduser/reasignar-sucursal',
  validate({ ...idParam, body: z.object({ idsucursal: z.number().int().positive() }) }),
  ctrl.reasignarSucursal,
);
router.post(
  '/:iduser/cambiar-perfil',
  // idperfil = 0 => "Sin Rol" (sin plantilla). Se permite >= 0.
  validate({ ...idParam, body: z.object({ idperfil: z.number().int().min(0) }) }),
  ctrl.cambiarPerfil,
);
// Clonar accesos per-empresa (USUARIOEMPRESA + MENU_GENERAL) a otra empresa.
router.post(
  '/:iduser/clonar-empresa',
  validate({ ...idParam, body: z.object({ idempresaDestino: z.coerce.string().min(1).max(2) }) }),
  ctrl.clonarAEmpresa,
);
router.get('/:iduser/historial', validate(idParam), ctrl.historial);
router.get('/:iduser/sucursal-principal', validate(idParam), ctrl.sucursalPrincipal);
router.get('/:iduser/foto', validate(idParam), ctrl.foto);
router.get(
  '/:iduser/turnos',
  validate({
    ...idParam,
    query: z.object({
      anio: z.coerce.number().int().min(2020).max(2100),
      mes:  z.coerce.number().int().min(1).max(12),
    }),
  }),
  ctrl.turnosMes,
);
router.post(
  '/:iduser/turnos',
  validate({
    ...idParam,
    body: z.object({
      anio:  z.number().int().min(2020).max(2100),
      mes:   z.number().int().min(1).max(12),
      items: z.array(z.object({
        idsucursal: z.number().int().positive(),
        fecha:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })).max(366),
    }),
  }),
  ctrl.guardarTurnosMes,
);
router.get('/:iduser/complemento', validate(idParam), ctrl.obtenerComplemento);
router.patch(
  '/:iduser/complemento',
  validate({
    ...idParam,
    body: z.object({
      modo_print: z.number().int().nullable().optional(),
      talonario:  z.number().int().nullable().optional(),
      descuento:  z.number().nullable().optional(),
    }),
  }),
  ctrl.actualizarComplemento,
);

module.exports = router;
