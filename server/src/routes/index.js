'use strict';

const router = require('express').Router();
const auth = require('../middlewares/auth');

router.use('/auth', require('./auth.routes'));
router.use('/usuarios', auth, require('./usuario.routes'));
router.use('/accesos', auth, require('./accesos.routes'));
router.use('/roles', auth, require('./rol.routes'));
router.use('/catalogos', auth, require('./catalogo.routes'));
router.use('/auditoria', auth, require('./auditoria.routes'));
router.use('/reportes', auth, require('./reportes.routes'));
router.use('/configuracion', auth, require('./configuracion.routes'));
router.use('/replicacion', auth, require('./replicacion.routes'));

module.exports = router;
