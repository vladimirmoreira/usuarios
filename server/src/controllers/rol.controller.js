'use strict';

const AccesosService = require('../services/accesos.service');
const MasterSyncService = require('../services/masterSync.service');
const MenuModel = require('../models/menu.model');
const RolModel = require('../models/rol.model');
const CatalogoModel = require('../models/catalogo.model');
const env = require('../config/env');
const { auditar, OP } = require('../utils/audit');

const empresaDe = (req) => req.user?.idempresa;
const ipDe = (req) => req.headers['x-client-ip'] || req.ip;

const audRol = (req, rolIduser, detalle) =>
  auditar(req, rolIduser, OP.ACTUALIZAR_CUENTA, `Rol-Template: ${detalle}`);

async function resolverTemplate(idperfil) {
  const rol = await RolModel.templateIduser(idperfil);
  if (!rol || !rol.iduser) {
    const e = new Error('Rol sin usuario plantilla configurado');
    e.status = 400;
    throw e;
  }
  return rol;
}

const RolController = {
  async listar(req, res, next) {
    try {
      // Sin param => todos; con param => filtrar por estado
      const estado = 'estado' in req.query ? Number(req.query.estado) : null;
      res.json(await CatalogoModel.perfiles({ estado }));
    } catch (e) { next(e); }
  },

  async crear(req, res, next) {
    try {
      const { descripcion, iduser, tipo, master } = req.body;
      const id = await RolModel.crear({ descripcion, iduser, tipo, master });
      // Inicializar menu_general copiando de Admin con permiso=0
      const empresa = empresaDe(req) || env.DEFAULT_IDEMPRESA;
      await MenuModel.copiarDesdeAdmin(iduser.trim(), empresa);
      await auditar(req, iduser, OP.ALTA, `Alta de Rol "${descripcion}" (id=${id})`);
      res.status(201).json({ ok: true, idtipo_usuario: id });
    } catch (e) { next(e); }
  },

  async actualizar(req, res, next) {
    try {
      const idperfil = Number(req.params.idperfil);
      const { descripcion, tipo, estado, master } = req.body;
      await RolModel.actualizar(idperfil, { descripcion, tipo, estado, master });
      const rol = await RolModel.templateIduser(idperfil).catch(() => null);
      if (rol?.iduser) await audRol(req, rol.iduser, `Actualización rol id=${idperfil}`);
      res.json({ ok: true });
    } catch (e) { next(e); }
  },

  async eliminar(req, res, next) {
    try {
      const idperfil = Number(req.params.idperfil);
      const rol = await RolModel.templateIduser(idperfil).catch(() => null);
      await RolModel.eliminar(idperfil);
      if (rol?.iduser) await auditar(req, rol.iduser, OP.BAJA, `Eliminación de Rol id=${idperfil}`);
      res.json({ ok: true });
    } catch (e) { next(e); }
  },

  async obtenerAccesos(req, res, next) {
    try {
      const rol = await resolverTemplate(Number(req.params.idperfil));
      const data = await AccesosService.obtenerCompleto(rol.iduser, empresaDe(req));
      res.json({ rol, ...data });
    } catch (e) { next(e); }
  },

  async listarUsuarios(req, res, next) {
    try {
      const idperfil = Number(req.params.idperfil);
      res.json(await RolModel.listarUsuariosPorRol(idperfil));
    } catch (e) { next(e); }
  },

  async propagar(req, res, next) {
    try {
      const idperfil = Number(req.params.idperfil);
      const { excluidos = [] } = req.body;
      const rol = await resolverTemplate(idperfil);
      const result = await AccesosService.propagarDesdeRol(
        rol.iduser, idperfil, excluidos, empresaDe(req),
      );
      await audRol(
        req, rol.iduser,
        `Propagación a ${result.propagados} usuario(s); ${result.excluidos} excluido(s)`,
      );
      res.json({ ok: true, ...result });
    } catch (e) { next(e); }
  },

  async actualizarMenu(req, res, next) {
    try {
      const rol = await resolverTemplate(Number(req.params.idperfil));
      const n = await AccesosService.actualizarMenu(rol.iduser, req.body.items);
      await audRol(req, rol.iduser, `menú (${n} items)`);
      res.json({ ok: true, n });
    } catch (e) { next(e); }
  },

  async actualizarPermisosGenerales(req, res, next) {
    try {
      const rol = await resolverTemplate(Number(req.params.idperfil));
      const n = await AccesosService.actualizarPermisosGenerales(rol.iduser, req.body.flags, empresaDe(req));
      await audRol(req, rol.iduser, `permisos generales`);
      res.json({ ok: true, n });
    } catch (e) { next(e); }
  },

  async actualizarMovimientos(req, res, next) {
    try {
      const rol = await resolverTemplate(Number(req.params.idperfil));
      const n = await AccesosService.actualizarMovimientos(rol.iduser, req.body.flags, empresaDe(req));
      await audRol(req, rol.iduser, `movimientos`);
      res.json({ ok: true, n });
    } catch (e) { next(e); }
  },

  async actualizarPdv(req, res, next) {
    try {
      const rol = await resolverTemplate(Number(req.params.idperfil));
      const n = await AccesosService.actualizarPdv(rol.iduser, req.body.flags, empresaDe(req));
      await audRol(req, rol.iduser, `pdv`);
      res.json({ ok: true, n });
    } catch (e) { next(e); }
  },

  async actualizarPermisoGg(req, res, next) {
    try {
      const rol = await resolverTemplate(Number(req.params.idperfil));
      const n = await AccesosService.actualizarPermisoGg(rol.iduser, req.body.flags, empresaDe(req));
      await audRol(req, rol.iduser, `permisos GG`);
      res.json({ ok: true, n });
    } catch (e) { next(e); }
  },

  async obtenerConceptos(req, res, next) {
    try {
      const rol = await resolverTemplate(Number(req.params.idperfil));
      res.json(await AccesosService.obtenerConceptos(rol.iduser));
    } catch (e) { next(e); }
  },

  async actualizarConceptos(req, res, next) {
    try {
      const rol = await resolverTemplate(Number(req.params.idperfil));
      const n = await AccesosService.actualizarConceptos(rol.iduser, req.body.items);
      await audRol(req, rol.iduser, `conceptos`);
      res.json({ ok: true, n });
    } catch (e) { next(e); }
  },

  async obtenerSucursales(req, res, next) {
    try {
      const rol = await resolverTemplate(Number(req.params.idperfil));
      res.json(await AccesosService.obtenerSucursales(rol.iduser));
    } catch (e) { next(e); }
  },
  async actualizarSucursales(req, res, next) {
    try {
      const rol = await resolverTemplate(Number(req.params.idperfil));
      const n = await AccesosService.actualizarSucursales(rol.iduser, req.body.items);
      await audRol(req, rol.iduser, `sucursales`);
      res.json({ ok: true, n });
    } catch (e) { next(e); }
  },
  async obtenerDepositos(req, res, next) {
    try {
      const rol = await resolverTemplate(Number(req.params.idperfil));
      res.json(await AccesosService.obtenerDepositos(rol.iduser));
    } catch (e) { next(e); }
  },
  async actualizarDepositos(req, res, next) {
    try {
      const rol = await resolverTemplate(Number(req.params.idperfil));
      const out = await AccesosService.actualizarDepositos(rol.iduser, req.body.items);
      await audRol(req, rol.iduser, `depósitos`);
      res.json({ ok: true, ...out });
    } catch (e) { next(e); }
  },

  // ── Master (Contabilidad / RRHH) ────────────────────────────────
  async obtenerMaster(req, res, next) {
    try {
      const rol = await resolverTemplate(Number(req.params.idperfil));
      res.json(await MasterSyncService.obtenerAccesos(rol.iduser, empresaDe(req)));
    } catch (e) { next(e); }
  },
  async actualizarMaster(req, res, next) {
    try {
      const rol = await resolverTemplate(Number(req.params.idperfil));
      const out = await MasterSyncService.actualizarAccesos(
        rol.iduser,
        { permisos: req.body.permisos, menu: req.body.menu },
        empresaDe(req),
        ipDe(req),
      );
      await audRol(req, rol.iduser, `master Contab./RRHH`);
      res.json({ ok: true, ...out });
    } catch (e) { next(e); }
  },
};

module.exports = RolController;
