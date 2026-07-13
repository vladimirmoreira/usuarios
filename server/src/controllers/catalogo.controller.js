'use strict';

const CatalogoModel = require('../models/catalogo.model');
const MenuModel = require('../models/menu.model');
const { OPERACIONES } = require('../config/operaciones.config');

const CatalogoController = {
  perfiles: async (_req, res, next) => {
    try { res.json(await CatalogoModel.perfiles({ estado: 1 })); } catch (e) { next(e); }
  },
  sucursales: async (_req, res, next) => {
    try { res.json(await CatalogoModel.sucursales()); } catch (e) { next(e); }
  },
  sucursalesLocales: async (_req, res, next) => {
    try { res.json(await CatalogoModel.sucursalesLocales()); } catch (e) { next(e); }
  },
  tiposMesero: async (_req, res, next) => {
    try { res.json(await CatalogoModel.tiposMesero()); } catch (e) { next(e); }
  },
  permisosGenerales: async (_req, res, next) => {
    try { res.json(await CatalogoModel.permisosGenerales()); } catch (e) { next(e); }
  },
  permisosPdv: async (_req, res, next) => {
    try { res.json(await CatalogoModel.permisosPdv()); } catch (e) { next(e); }
  },
  menuBase: async (req, res, next) => {
    try { res.json(await MenuModel.listarPlantillaPorPerfil(Number(req.params.idperfil))); }
    catch (e) { next(e); }
  },
  talonarios: async (_req, res, next) => {
    try { res.json(await CatalogoModel.talonarios()); } catch (e) { next(e); }
  },
  vendedores: async (_req, res, next) => {
    try { res.json(await CatalogoModel.vendedores()); } catch (e) { next(e); }
  },
  planventas: async (_req, res, next) => {
    try { res.json(await CatalogoModel.planventas()); } catch (e) { next(e); }
  },
  condiciones: async (_req, res, next) => {
    try { res.json(await CatalogoModel.condiciones()); } catch (e) { next(e); }
  },
  depositos: async (_req, res, next) => {
    try { res.json(await CatalogoModel.depositos()); } catch (e) { next(e); }
  },
  permisosMaster: async (_req, res, next) => {
    try { res.json(await CatalogoModel.permisosMaster()); } catch (e) { next(e); }
  },
  menuMaster: async (_req, res, next) => {
    try { res.json(await CatalogoModel.menuMaster()); } catch (e) { next(e); }
  },
  operaciones: async (_req, res) => {
    res.json(OPERACIONES);
  },
};

module.exports = CatalogoController;
