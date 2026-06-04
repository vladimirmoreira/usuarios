'use strict';

const ConfiguracionModel = require('../models/configuracion.model');

/**
 * Middleware: exige que el usuario logueado sea ADMIN o esté listado como
 * AUTORIZADO en CONFIGURACION_USUARIO (BD server).
 * Debe usarse después de `auth`.
 */
module.exports = async function requireAuthorized(req, res, next) {
  try {
    const iduser = req.user?.iduser;
    if (!iduser) return res.status(401).json({ error: 'No autenticado' });
    const ok = await ConfiguracionModel.isAutorizado(iduser);
    if (!ok) return res.status(403).json({ error: 'Acción no autorizada' });
    next();
  } catch (e) { next(e); }
};
