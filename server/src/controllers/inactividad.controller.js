'use strict';

const InactividadModel = require('../models/inactividad.model');
const OperacionesService = require('../services/operaciones.service');

const ipDe  = (req) => req.headers['x-client-ip'] || req.ip;
const rptDe = (req) => req.user?.iduser || 'SYSTEM';

const MAX_BATCH = 100;

const InactividadController = {
  /** GET /api/usuarios/inactividad?dias=&idperfil= */
  async listar(req, res, next) {
    try {
      const dias = req.query.dias != null ? Number(req.query.dias) : null;
      const idperfilFiltro = req.query.idperfil != null
        ? Number(req.query.idperfil) : null;
      const { dias: usado, rows } = await InactividadModel.listar(dias, { idperfilFiltro });
      res.json({ dias: usado, total: rows.length, rows });
    } catch (e) { next(e); }
  },

  /**
   * POST /api/usuarios/inactividad/inhabilitar
   *   { iduser }            → uno a uno
   *   { ids[], dias? }      → lote (máx. 100)
   */
  async inhabilitar(req, res, next) {
    try {
      const ip = ipDe(req);
      const rptUser = rptDe(req);
      const dias = req.body.dias != null ? Number(req.body.dias) : null;

      // Modo uno a uno
      if (req.body.iduser) {
        const r = await OperacionesService.bajaUsuario({ iduser: req.body.iduser, rptUser, ip });
        return res.json({ ok: r.ok ?? true, ...r });
      }

      // Modo lote
      const idsIn = Array.isArray(req.body.ids) ? req.body.ids : [];
      if (!idsIn.length) {
        return res.status(400).json({ error: 'Debe indicar `iduser` o `ids[]`' });
      }
      if (idsIn.length > MAX_BATCH) {
        return res.status(400).json({ error: `El lote no puede superar ${MAX_BATCH} usuarios` });
      }

      // Re-validar inactividad (defensa en profundidad: alguien podría
      // haber registrado actividad entre la verificación y el envío).
      const { rows: candidatos } = await InactividadModel.listar(dias);
      const validos = new Set(candidatos.map((c) => c.iduser.toUpperCase()));
      const aProcesar = idsIn.filter((u) =>
        validos.has(String(u).trim().toUpperCase()));

      const resultados = [];
      for (const iduser of aProcesar) {
        try {
          const r = await OperacionesService.bajaUsuario({ iduser, rptUser, ip });
          resultados.push({ iduser, ok: r.ok ?? true, detalle: r.detalle });
        } catch (e) {
          resultados.push({ iduser, ok: false, mensaje: e?.message || 'Error' });
        }
      }
      const omitidos = idsIn.filter((u) =>
        !validos.has(String(u).trim().toUpperCase()));

      res.json({
        ok: true,
        procesados: resultados.length,
        exitosos: resultados.filter((r) => r.ok).length,
        fallidos: resultados.filter((r) => !r.ok).length,
        omitidos,
        resultados,
      });
    } catch (e) { next(e); }
  },
};

module.exports = InactividadController;
