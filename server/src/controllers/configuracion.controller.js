'use strict';

const ConfiguracionModel = require('../models/configuracion.model');
const OperacionesModel   = require('../models/operaciones.model');
const CatalogoModel      = require('../models/catalogo.model');
const { OPERACIONES } = require('../config/operaciones.config');
const { auditar, OP } = require('../utils/audit');
const MetadataService    = require('../services/metadata.service');

const ConfiguracionController = {
  // ── Empresas (system + master) ──────────────────────────────────────────
  async listarEmpresas(_req, res, next) {
    try {
      const [system, master] = await Promise.all([
        CatalogoModel.empresasSystem(),
        CatalogoModel.empresasMaster(),
      ]);
      res.json({ system, master });
    } catch (e) { next(e); }
  },

  async setEmpresaAccesible(req, res, next) {
    try {
      await CatalogoModel.setEmpresaAccesible(req.params.idempresa, req.body.accesible);
      await auditar(req, `EMP-${req.params.idempresa}`, OP.ACTUALIZAR_CUENTA,
        `Empresa ${req.params.idempresa} accesible=${req.body.accesible}`);
      res.json({ ok: true });
    } catch (e) { next(e); }
  },

  async setEmpresaMasterMapping(req, res, next) {
    try {
      const val = req.body.idempresa_system ?? null;
      await CatalogoModel.setEmpresaMasterMapping(req.params.idempresa, val);
      await auditar(req, `EMPM-${req.params.idempresa}`, OP.ACTUALIZAR_CUENTA,
        `Empresa master ${req.params.idempresa} idempresa_system=${val ?? 'NULL'}`);
      res.json({ ok: true });
    } catch (e) { next(e); }
  },

  async listar(req, res, next) {
    try {
      const data = await ConfiguracionModel.listar();
      // Nunca exponer CLAVE en texto plano en el listado
      res.json(data.map(({ clave: _c, ...rest }) => rest));
    } catch (e) { next(e); }
  },

  async obtener(req, res, next) {
    try {
      const row = await ConfiguracionModel.obtener(req.params.ip);
      if (!row) return res.status(404).json({ error: 'Configuración no encontrada' });
      const { clave: _c, ...rest } = row;
      res.json(rest);
    } catch (e) { next(e); }
  },

  async crear(req, res, next) {
    try {
      // Registro único: configuracion_usuario admite una sola fila.
      const existentes = await ConfiguracionModel.listar();
      if (existentes.length > 0) {
        return res.status(409).json({ error: 'Ya existe una configuración. La tabla admite un único registro.' });
      }
      await ConfiguracionModel.crear(req.body);
      await auditar(req, req.user.iduser, OP.ACTUALIZAR_CUENTA,
        `Configuración IP=${req.body.ip} creada`);
      res.status(201).json({ ok: true });
    } catch (e) { next(e); }
  },

  async actualizar(req, res, next) {
    try {
      const n = await ConfiguracionModel.actualizar(req.params.ip, req.body);
      if (n === 0) return res.status(404).json({ error: 'Sin cambios o no encontrado' });
      await auditar(req, req.user.iduser, OP.ACTUALIZAR_CUENTA,
        `Configuración IP=${req.params.ip} actualizada (${Object.keys(req.body).join(', ')})`);
      res.json({ ok: true });
    } catch (e) { next(e); }
  },

  async eliminar(req, res, next) {
    try {
      await ConfiguracionModel.eliminar(req.params.ip);
      await auditar(req, req.user.iduser, OP.BAJA,
        `Configuración IP=${req.params.ip} eliminada`);
      res.json({ ok: true });
    } catch (e) { next(e); }
  },

  /** GET /configuracion/autorizado — indica si el usuario logueado puede ver esta sección. */
  async verificarAutorizado(req, res, next) {
    try {
      const ok = await ConfiguracionModel.isAutorizado(req.user.iduser);
      res.json({ autorizado: ok });
    } catch (e) { next(e); }
  },

  /** GET /configuracion/operaciones — devuelve el catálogo declarativo de operaciones. */
  async listarOperaciones(_req, res) {
    res.json(OPERACIONES);
  },

  /** GET /configuracion/flags — flags activos según la IP del cliente. */
  async flags(req, res, next) {
    try {
      const ip = req.headers['x-client-ip'] || req.ip;
      const c  = await OperacionesModel.contextoPorIp(ip).catch(() => ({}));
      res.json({
        ip,
        legajo:         Number(c?.legajo) === 1,
        biometrico:     Number(c?.biometrico) === 1,
        gastronomia:    Number(c?.gastronomia) === 1,
        contabilidad:   Number(c?.contabilidad) === 1,
        talento_humano: Number(c?.talento_humano) === 1,
        complementario: Number(c?.complementario) === 1,
        // Default 1 (habilitado) si la columna aún no existe / viene null.
        crear_sin_rol:  c?.crear_sin_rol == null ? true : Number(c?.crear_sin_rol) === 1,
      });
    } catch (e) { next(e); }
  },

  /** GET /configuracion/metadata — estado del cerrojo de inicialización de metadatos. */
  async estadoMetadata(_req, res, next) {
    try {
      const estado = await MetadataService.obtenerEstado();
      res.json(estado);
    } catch (e) { next(e); }
  },

  /** POST /configuracion/metadata/ejecutar — ejecuta la inicialización de metadatos. */
  async ejecutarMetadata(req, res, next) {
    try {
      const resultado = await MetadataService.ejecutar();
      await auditar(req, req.user.iduser, OP.ACTUALIZAR_CUENTA,
        'Inicialización de metadatos ejecutada');
      res.json(resultado);
    } catch (e) { next(e); }
  },
};

module.exports = ConfiguracionController;
