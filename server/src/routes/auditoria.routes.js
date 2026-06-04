'use strict';

const router = require('express').Router();
const ctrl   = require('../controllers/auditoria.controller');

router.get('/', ctrl.listar);

module.exports = router;
