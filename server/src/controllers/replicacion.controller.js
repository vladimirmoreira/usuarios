'use strict';

const ReplicacionModel = require('../models/replicacion.model');
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
          nombre: d.nombre?.trim() || `Sucursal ${d.idsucursal}`,
          servidor: d.servidor?.trim() || null,
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
};

module.exports = ReplicacionController;
