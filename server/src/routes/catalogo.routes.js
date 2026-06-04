'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/catalogo.controller');

router.get('/perfiles', ctrl.perfiles);
router.get('/sucursales', ctrl.sucursales);
router.get('/permisos-generales', ctrl.permisosGenerales);
router.get('/permisos-pdv', ctrl.permisosPdv);
router.get('/menu-base/:idperfil', ctrl.menuBase);
router.get('/talonarios', ctrl.talonarios);
router.get('/vendedores', ctrl.vendedores);
router.get('/planventas', ctrl.planventas);
router.get('/condiciones', ctrl.condiciones);
router.get('/depositos', ctrl.depositos);
router.get('/permisos-master', ctrl.permisosMaster);
router.get('/menu-master', ctrl.menuMaster);
router.get('/operaciones', ctrl.operaciones);

module.exports = router;
