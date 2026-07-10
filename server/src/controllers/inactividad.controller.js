'use strict';

const InactividadModel = require('../models/inactividad.model');
const OperacionesService = require('../services/operaciones.service');

const ipDe  = (req) => req.headers['x-client-ip'] || req.ip;
const rptDe = (req) => req.user?.iduser || 'SYSTEM';

const MAX_BATCH = 100;

const InactividadController = {
  /** GET /api/usuarios/inactividad?dias=&diasPorCaducar=&idperfil=
   *  Vista unificada de incidencias (inactividad + caducados + próximos a caducar). */
  async listar(req, res, next) {
    try {
      const diasInactividad = req.query.dias != null ? Number(req.query.dias) : null;
      const diasPorCaducar = req.query.diasPorCaducar != null ? Number(req.query.diasPorCaducar) : 30;
      const idperfilFiltro = req.query.idperfil != null ? Number(req.query.idperfil) : null;
      const out = await InactividadModel.listarIncidencias({ diasInactividad, diasPorCaducar, idperfilFiltro });
      res.json({ ...out, total: out.rows.length });
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

      // Re-validar incidencias (defensa en profundidad: alguien podría haber
      // registrado actividad o extendido la vigencia entre la verificación y el envío).
      // Solo son accionables (inhabilitables) los caducados y los inactivos; los
      // "por_caducar" todavía no vencieron y no se pueden inhabilitar en lote.
      const { rows: candidatos } = await InactividadModel.listarIncidencias({ diasInactividad: dias });
      const validos = new Set(
        candidatos.filter((c) => c.motivo !== 'por_caducar').map((c) => c.iduser.toUpperCase()),
      );
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
