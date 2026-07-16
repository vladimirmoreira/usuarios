'use strict';

const router = require('express').Router();
const auth = require('../middlewares/auth');
const franja = require('../middlewares/franjaHoraria');

router.use('/auth', require('./auth.routes'));
router.use('/usuarios', auth, franja, require('./usuario.routes'));
router.use('/accesos', auth, franja, require('./accesos.routes'));
router.use('/roles', auth, franja, require('./rol.routes'));
router.use('/catalogos', auth, franja, require('./catalogo.routes'));
router.use('/auditoria', auth, franja, require('./auditoria.routes'));
router.use('/reportes', auth, franja, require('./reportes.routes'));
router.use('/configuracion', auth, franja, require('./configuracion.routes'));
router.use('/replicacion', auth, franja, require('./replicacion.routes'));

module.exports = router;
