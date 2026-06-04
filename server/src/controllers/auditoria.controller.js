'use strict';

const HistorialModel = require('../models/historial.model');

const AuditoriaController = {
  async listar(req, res, next) {
    try {
      const { usuario, idoperacion, autorizacion, desde, hasta, page, pageSize } = req.query;
      res.json(
        await HistorialModel.listarGlobal({
          usuario,
          idoperacion: idoperacion !== undefined ? idoperacion : null,
          autorizacion,
          desde,
          hasta,
          page:     Number(page)     || 1,
          pageSize: Number(pageSize) || 50,
        }),
      );
    } catch (e) { next(e); }
  },
};

module.exports = AuditoriaController;
