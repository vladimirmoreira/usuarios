'use strict';

const ReplicacionModel = require('../models/replicacion.model');
const ReplicacionJob = require('../jobs/replicacion.job');
const { auditar, OP } = require('../utils/audit');

const { ESTADO, ESTADO_LABEL } = ReplicacionModel;

const ReplicacionController = {
  /**
   * GET /replicacion/estado
   * Un renglón por destino con el conteo de jobs por estado (Encolado/Enviado/Error/Bloqueado).
   */
  async estado(_req, res, next) {
    try {
      const [destinos, resumen] = await Promise.all([
        ReplicacionModel.listarDestinos(),
        ReplicacionModel.resumenPorDestino(),
      ]);

      // Index del resumen: idsucursal → { estado: cantidad }
      const porDest = new Map();
      for (const r of resumen) {
        const key = Number(r.idsucursal);
        if (!porDest.has(key)) porDest.set(key, {});
        porDest.get(key)[Number(r.estado)] = Number(r.cantidad);
      }

      const filas = destinos.map((d) => {
        const c = porDest.get(Number(d.idsucursal)) || {};
        return {
          idsucursal: Number(d.idsucursal),
          // La tabla no tiene NOMBRE: se etiqueta por id (+ host si está).
          nombre: `Sucursal ${d.idsucursal}`,
          servidor: d.host_server?.trim() || null,
          replica_master: !!(d.master_bd && String(d.master_bd).trim()),
          activo: Number(d.estado) === 1,
          pendiente: c[ESTADO.PENDIENTE] || 0,
          procesando: c[ESTADO.PROCESANDO] || 0,
          enviado: c[ESTADO.ENVIADO] || 0,
          error: c[ESTADO.ERROR] || 0,
          bloqueado: c[ESTADO.BLOQUEADO] || 0,
        };
      });

      res.json({ destinos: filas });
    } catch (e) { next(e); }
  },

  /** GET /replicacion/cola?idsucursal=&estado= — detalle de jobs. */
  async cola(req, res, next) {
    try {
      const idsucursal = req.query.idsucursal != null ? Number(req.query.idsucursal) : null;
      const estado = req.query.estado != null ? Number(req.query.estado) : null;
      const rows = await ReplicacionModel.listarCola({ idsucursal, estado });
      res.json(rows.map((r) => ({
        ...r,
        estado_label: ESTADO_LABEL[Number(r.estado)] || String(r.estado),
      })));
    } catch (e) { next(e); }
  },

  /** POST /replicacion/cola/:id/reintentar — reencola un job fallido. */
  async reintentar(req, res, next) {
    try {
      await ReplicacionModel.reintentar(Number(req.params.id));
      await auditar(req, req.user.iduser, OP.ACTUALIZAR_CUENTA,
        `Replicación: reintento job #${req.params.id}`);
      res.json({ ok: true });
    } catch (e) { next(e); }
  },

  /** POST /replicacion/reintentar-destino — reencola los fallidos de un destino (o todos). */
  async reintentarDestino(req, res, next) {
    try {
      const idsucursal = req.body?.idsucursal != null ? Number(req.body.idsucursal) : null;
      await ReplicacionModel.reintentarDestino(idsucursal);
      await auditar(req, req.user.iduser, OP.ACTUALIZAR_CUENTA,
        `Replicación: reintento destino ${idsucursal ?? 'TODOS'}`);
      res.json({ ok: true });
    } catch (e) { next(e); }
  },

  /**
   * POST /replicacion/usuario/:iduser — encola la replicación de un usuario a todos
   * los destinos activos (o a uno si se pasa idsucursal) y dispara el drenado.
   */
  async replicarUsuario(req, res, next) {
    try {
      const iduser = req.params.iduser;
      const idsucursal = req.body?.idsucursal != null ? Number(req.body.idsucursal) : null;
      const encolados = await ReplicacionModel.encolar({ iduser, operacion: 'MANUAL', idsucursal });
      await auditar(req, iduser, OP.MIGRAR_DATOS,
        `Replicación manual encolada a ${idsucursal ?? 'todos'} (${encolados} destino/s)`);
      // Drenado inmediato en segundo plano (no bloquea la respuesta).
      ReplicacionJob.drenar().catch(() => {});
      res.json({ ok: true, encolados });
    } catch (e) { next(e); }
  },

  /** GET /replicacion/roles-pendientes — roles marcados para propagar a sucursales. */
  async rolesPendientes(_req, res, next) {
    try {
      res.json(await ReplicacionModel.listarRolesPendientes());
    } catch (e) { next(e); }
  },

  /** GET /replicacion/progreso — jobs abiertos (PENDIENTE+PROCESANDO), para la barra. */
  async progreso(_req, res, next) {
    try {
      res.json({ abierto: await ReplicacionModel.contadorAbierto() });
    } catch (e) { next(e); }
  },

  /** GET /replicacion/alertas — contador para el badge del menú. */
  async alertas(_req, res, next) {
    try {
      res.json(await ReplicacionModel.contarAlertas());
    } catch (e) { next(e); }
  },

  /**
   * POST /replicacion/rol/:idtipo/propagar — encola a TODOS los usuarios activos del rol
   * a los destinos activos (con dedupe) y drena en lotes con throttling. Quita el recordatorio.
   */
  async propagarRol(req, res, next) {
    try {
      const idtipo = Number(req.params.idtipo);
      const usuarios = await ReplicacionModel.usuariosDeRol(idtipo);
      let encolados = 0;
      for (const u of usuarios) {
        encolados += await ReplicacionModel.encolar({ iduser: u, operacion: 'PROPAGAR_ROL' });
      }
      await ReplicacionModel.quitarRolPendiente(idtipo);
      await auditar(req, `ROL-${idtipo}`, OP.MIGRAR_DATOS,
        `Propagación rol ${idtipo}: ${usuarios.length} usuario(s), ${encolados} job(s) encolado(s)`);
      // Drenado masivo en background con throttling (no bloquea la respuesta).
      ReplicacionJob.drenarTodo().catch(() => {});
      res.json({ ok: true, usuarios: usuarios.length, encolados });
    } catch (e) { next(e); }
  },
};

module.exports = ReplicacionController;
