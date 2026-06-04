'use strict';

const ReportesService = require('../services/reportes.service');

const empresaDe = (req) => req.user?.idempresa;

const ReportesController = {
  async fichaUsuario(req, res, next) {
    try {
      res.json(await ReportesService.fichaUsuario(req.params.iduser, empresaDe(req)));
    } catch (e) { next(e); }
  },

  async fichaRol(req, res, next) {
    try {
      res.json(await ReportesService.fichaRol(req.params.idperfil, empresaDe(req)));
    } catch (e) { next(e); }
  },
};

module.exports = ReportesController;
