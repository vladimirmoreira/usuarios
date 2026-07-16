'use strict';

const AccesosService = require('../services/accesos.service');
const MasterSyncService = require('../services/masterSync.service');
const { auditar, OP } = require('../utils/audit');
const { dispararReplicacion } = require('../services/replicacionTrigger');

const empresaDe = (req) => req.user?.idempresa;
const ipDe = (req) => req.headers['x-client-ip'] || req.ip;

// Se llama en TODAS las mutaciones de accesos → punto único para auditar + auto-replicar.
const aud = (req, iduser, detalle) => {
  dispararReplicacion(iduser); // auto-replicación (best-effort, gateada por flag REPLICAR)
  return auditar(req, iduser, OP.ACTUALIZAR_CUENTA, `Accesos: ${detalle}`);
};

const AccesosController = {
  async obtenerAccesos(req, res, next) {
    try { res.json(await AccesosService.obtenerCompleto(req.params.iduser, empresaDe(req))); }
    catch (e) { next(e); }
  },
  async actualizarMenu(req, res, next) {
    try {
      const n = await AccesosService.actualizarMenu(req.params.iduser, req.body.items);
      await aud(req, req.params.iduser, `menú (${n} items)`);
      res.json({ ok: true, n });
    } catch (e) { next(e); }
  },
  async actualizarPermisosGenerales(req, res, next) {
    try {
      const n = await AccesosService.actualizarPermisosGenerales(req.params.iduser, req.body.flags, empresaDe(req));
      await aud(req, req.params.iduser, `permisos generales`);
      res.json({ ok: true, n });
    } catch (e) { next(e); }
  },
  async actualizarMovimientos(req, res, next) {
    try {
      const n = await AccesosService.actualizarMovimientos(req.params.iduser, req.body.flags, empresaDe(req));
      await aud(req, req.params.iduser, `movimientos`);
      res.json({ ok: true, n });
    } catch (e) { next(e); }
  },
  async actualizarPdv(req, res, next) {
    try {
      const n = await AccesosService.actualizarPdv(req.params.iduser, req.body.flags, empresaDe(req));
      await aud(req, req.params.iduser, `pdv`);
      res.json({ ok: true, n });
    } catch (e) { next(e); }
  },
  async actualizarPermisoGg(req, res, next) {
    try {
      const n = await AccesosService.actualizarPermisoGg(req.params.iduser, req.body.flags, empresaDe(req));
      await aud(req, req.params.iduser, `permisos GG`);
      res.json({ ok: true, n });
    } catch (e) { next(e); }
  },
  async obtenerConceptos(req, res, next) {
    try { res.json(await AccesosService.obtenerConceptos(req.params.iduser)); }
    catch (e) { next(e); }
  },
  async actualizarConceptos(req, res, next) {
    try {
      const n = await AccesosService.actualizarConceptos(req.params.iduser, req.body.items);
      await aud(req, req.params.iduser, `conceptos`);
      res.json({ ok: true, n });
    } catch (e) { next(e); }
  },
  async obtenerSucursales(req, res, next) {
    try { res.json(await AccesosService.obtenerSucursales(req.params.iduser)); }
    catch (e) { next(e); }
  },
  async actualizarSucursales(req, res, next) {
    try {
      const n = await AccesosService.actualizarSucursales(req.params.iduser, req.body.items);
      await aud(req, req.params.iduser, `sucursales`);
      res.json({ ok: true, n });
    } catch (e) { next(e); }
  },
  async obtenerDepositos(req, res, next) {
    try { res.json(await AccesosService.obtenerDepositos(req.params.iduser)); }
    catch (e) { next(e); }
  },
  async actualizarDepositos(req, res, next) {
    try {
      const out = await AccesosService.actualizarDepositos(req.params.iduser, req.body.items);
      await aud(req, req.params.iduser, `depósitos`);
      res.json({ ok: true, ...out });
    } catch (e) { next(e); }
  },

  // ── Master (Contabilidad / RRHH) ───────────────────────────────────────
  async obtenerMaster(req, res, next) {
    try { res.json(await MasterSyncService.obtenerAccesos(req.params.iduser, empresaDe(req))); }
    catch (e) { next(e); }
  },
  async actualizarMaster(req, res, next) {
    try {
      const out = await MasterSyncService.actualizarAccesos(
        req.params.iduser,
        { permisos: req.body.permisos, menu: req.body.menu },
        empresaDe(req),
        ipDe(req),
      );
      await aud(req, req.params.iduser, `master Contab./RRHH`);
      res.json({ ok: true, ...out });
    } catch (e) { next(e); }
  },
};

module.exports = AccesosController;
