'use strict';

/**
 * Reportes — Fichas consolidadas (read-only).
 *
 * Reúne en una sola respuesta toda la información dispersa necesaria
 * para generar una hoja de presentación / impresión:
 *   - fichaUsuario(iduser, idempresa)
 *   - fichaRol(idperfil, idempresa)
 *
 * No realiza writes ni audita. Es seguro llamarlo desde un GET.
 */

const UsuarioModel          = require('../models/usuario.model');
const UsuarioSucursalModel  = require('../models/usuarioSucursal.model');
const UsuarioDepositoModel  = require('../models/usuarioDeposito.model');
const CatalogoModel         = require('../models/catalogo.model');
const RolModel              = require('../models/rol.model');
const AccesosService        = require('./accesos.service');
const env                   = require('../config/env');
const { query }             = require('../config/firebird');
const { decodeRows }        = require('../utils/charset');

const emp = (v) => v || env.DEFAULT_IDEMPRESA;

/**
 * Resuelve nombres legibles para las sucursales/depósitos asignados.
 */
async function expandSucursales(usSucs) {
  if (!usSucs?.length) return [];
  const sucs = await CatalogoModel.sucursales();
  const map = new Map(sucs.map((s) => [Number(s.idsucursal), s.nombre]));
  return usSucs.map((s) => ({
    idsucursal: Number(s.idsucursal),
    orden:      Number(s.orden) || 0,
    nombre:     map.get(Number(s.idsucursal)) || `Sucursal ${s.idsucursal}`,
  }));
}

async function expandDepositos(usDeps) {
  if (!usDeps) return { salida: [], entrada: [] };
  const deps = await CatalogoModel.depositos();
  const map = new Map(deps.map((d) => [Number(d.iddeposito), d]));
  const exp = (arr) => (arr || []).map((d) => {
    const meta = map.get(Number(d.iddeposito));
    return {
      iddeposito:  Number(d.iddeposito),
      orden:       Number(d.orden) || 0,
      descripcion: meta?.descripcion || `Depósito ${d.iddeposito}`,
      idsucursal:  meta?.idsucursal ?? null,
    };
  });
  return { salida: exp(usDeps.salida), entrada: exp(usDeps.entrada) };
}

/** Descripción del perfil a partir de idtipo_usuario. */
async function descripcionPerfil(idtipo_usuario) {
  if (idtipo_usuario == null) return null;
  if (Number(idtipo_usuario) === 0) return 'Admin (Superusuario)';
  const rows = await query(
    'system',
    `SELECT FIRST 1 CAST(descripcion AS VARCHAR(120) CHARACTER SET OCTETS) AS descripcion FROM tipo_usuario WHERE idtipo_usuario = ?`,
    [Number(idtipo_usuario)],
  ).then((r) => decodeRows(r, ['descripcion'])).catch(() => []);
  return rows[0]?.descripcion || null;
}

/** Lookup de vínculo con legajo (rh_persona/rh_cargo) — best-effort. */
async function vinculoLegajo(documento, iduser) {
  if (!documento && !iduser) return null;
  try {
    const rows = await query(
      'server',
      `SELECT FIRST 1 p.idpersona,
              CAST(p.nombre AS VARCHAR(120) CHARACTER SET OCTETS) AS nombre,
              CAST(p.apellido AS VARCHAR(120) CHARACTER SET OCTETS) AS apellido,
              p.nrodocumento,
              c.idcargo, c.iduser_system, c.estado AS cargo_estado
         FROM rh_persona p
         LEFT JOIN rh_cargo c ON c.idpersona = p.idpersona
        WHERE (? IS NOT NULL AND p.nrodocumento = ?)
           OR (? IS NOT NULL AND UPPER(TRIM(c.iduser_system)) = UPPER(TRIM(?)))
        ORDER BY c.estado DESC, c.idcargo DESC`,
      [documento, documento, iduser, iduser],
    );
    return rows[0] ? decodeRows([rows[0]], ['nombre', 'apellido'])[0] : null;
  } catch (_) {
    return null;
  }
}

/** Vínculo con mesero (gg_mesero) — best-effort. */
async function vinculoMesero(documento, iduser) {
  if (!documento && !iduser) return null;
  try {
    const rows = await query(
      'server',
      `SELECT FIRST 1 idmesero,
              CAST(nombre AS VARCHAR(120) CHARACTER SET OCTETS) AS nombre,
              nrodocumento, idsucursal, estado, idtipo_mesero
         FROM gg_mesero
        WHERE (? IS NOT NULL AND nrodocumento = ?)
           OR (? IS NOT NULL AND UPPER(TRIM(iduser)) = UPPER(TRIM(?)))`,
      [documento, documento, iduser, iduser],
    );
    return rows[0] ? decodeRows([rows[0]], ['nombre'])[0] : null;
  } catch (_) {
    return null;
  }
}

const ReportesService = {
  /**
   * Ficha completa de un usuario.
   * Estructura: { usuario, perfil, complemento, sucursales, depositos,
   *               accesos:{menu, permisosGenerales, movimientos, pdv, permisoGg},
   *               conceptos:{permisosCatalogo, grupos}, vinculos, historialReciente }
   */
  async fichaUsuario(iduser, idempresa) {
    const empresa = emp(idempresa);

    const [usuario, complemento, sucs, deps] = await Promise.all([
      UsuarioModel.findById(iduser),
      UsuarioModel.getComplemento(iduser).catch(() => null),
      UsuarioSucursalModel.listarPorUsuario(iduser),
      UsuarioDepositoModel.listarPorUsuario(iduser),
    ]);

    if (!usuario) {
      const err = new Error('Usuario no encontrado');
      err.status = 404;
      throw err;
    }

    const [perfil, sucursales, depositos, accesos, conceptos, legajo, mesero, historial] =
      await Promise.all([
        descripcionPerfil(usuario.idtipo_usuario),
        expandSucursales(sucs),
        expandDepositos(deps),
        AccesosService.obtenerCompleto(iduser, empresa),
        AccesosService.obtenerConceptos(iduser),
        vinculoLegajo(usuario.documento, iduser),
        vinculoMesero(usuario.documento, iduser),
        UsuarioModel.historial(iduser, { pageSize: 25 }).catch(() => ({ rows: [], total: 0 })),
      ]);

    return {
      usuario:           { ...usuario, perfil_descripcion: perfil },
      complemento,
      sucursales,
      depositos,
      accesos,
      conceptos,
      vinculos:          { legajo, mesero },
      historialReciente: historial.rows || [],
      historialTotal:    historial.total ?? 0,
      generadoEn:        new Date().toISOString(),
    };
  },

  /**
   * Ficha completa de un rol (template).
   * Estructura: { rol, accesos, conceptos, usuariosAsignados }
   */
  async fichaRol(idperfil, idempresa) {
    const empresa = emp(idempresa);
    const template = await RolModel.templateIduser(Number(idperfil));
    if (!template) {
      const err = new Error('Rol no encontrado');
      err.status = 404;
      throw err;
    }

    const [accesos, conceptos, usuariosAsignados] = await Promise.all([
      AccesosService.obtenerCompleto(template.iduser, empresa),
      AccesosService.obtenerConceptos(template.iduser),
      RolModel.listarUsuariosPorRol(Number(idperfil)).catch(() => []),
    ]);

    return {
      rol: {
        idperfil:    Number(idperfil),
        descripcion: template.descripcion,
        iduser:      template.iduser,
        tipo:        template.tipo,
        estado:      template.estado,
        master:      template.master ?? 0,
        edicion_rol: template.edicion_rol ?? 0,
      },
      accesos,
      conceptos,
      usuariosAsignados,
      generadoEn: new Date().toISOString(),
    };
  },
};

module.exports = ReportesService;
