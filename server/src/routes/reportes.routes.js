'use strict';

const router = require('express').Router();
const ctrl   = require('../controllers/reportes.controller');

router.get('/usuario/:iduser',  ctrl.fichaUsuario);
router.get('/rol/:idperfil',    ctrl.fichaRol);

module.exports = router;
