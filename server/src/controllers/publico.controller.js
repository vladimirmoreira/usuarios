'use strict';

/**
 * Portal público de auto-reset de clave (sin login).
 * Protegido por el candado de red local (middleware ipLocal) y rate-limit propio.
 */

const OperacionesService = require('../services/operaciones.service');
const { dispararReplicacion } = require('../services/replicacionTrigger');

const ipDe = (req) => req.ip || '';

const PublicoController = {
  /** Paso 1: solo iduser. Confirma que haya una solicitud pendiente (sin consumir intentos). */
  async existe(req, res, next) {
    try {
      const r = await OperacionesService.portalExiste({ iduser: req.body.iduser });
      res.json(r);
    } catch (e) { next(e); }
  },

  /** (Alternativo) valida iduser + verificador; devuelve el nombre para confirmar identidad. */
  async validar(req, res, next) {
    try {
      const r = await OperacionesService.portalValidar({
        iduser: req.body.iduser, verificador: req.body.verificador,
      });
      res.json(r);
    } catch (e) { next(e); }
  },

  /** Paso 2: genera la clave de 7 dígitos, aplica el reset y la devuelve al usuario. */
  async aplicar(req, res, next) {
    try {
      const r = await OperacionesService.portalAplicar({
        iduser: req.body.iduser, verificador: req.body.verificador, ip: ipDe(req),
      });
      dispararReplicacion(String(req.body.iduser).trim());
      res.json(r);
    } catch (e) { next(e); }
  },
};

module.exports = PublicoController;
