'use strict';

/**
 * Servicio que coordina la replicaci\u00f3n de un usuario a la BD MASTER.
 *
 * Reglas:
 *   - Activo s\u00f3lo si el rol del usuario (tipo_usuario.master) = 1.
 *   - Las flags de m\u00f3dulos (contabilidad / talento_humano) se leen de
 *     configuracion_usuario por la IP que la app conoce como "actual".
 *   - Si rol.master=0 o no hay ning\u00fan m\u00f3dulo habilitado, no se hace nada.
 */

const MasterModel = require('../models/master.model');
const UsuarioModel = require('../models/usuario.model');
const ConfiguracionModel = require('../models/configuracion.model');
const { query } = require('../config/firebird');
const env = require('../config/env');
const logger = require('../utils/logger');

const SIZE_PERMISOS = 9;
const SIZE_MENU = 19;
const SIZE_MENUVER = 10;
const SIZE_MODULOS = 3;

function pad01(arr = [], size) {
  let out = '';
  for (let i = 0; i < size; i++) out += arr[i] ? '1' : '0';
  return out;
}
function read01(str, size) {
  const s = str == null ? '' : String(str);
  const out = new Array(size).fill(false);
  for (let i = 0; i < size; i++) out[i] = s[i] === '1';
  return out;
}

async function rolMasterDe(iduser) {
  // Trae el flag master del rol del usuario (a trav\u00e9s de idtipo_usuario).
  // Admin tambi\u00e9n se considera master si tiene alg\u00fan flag de m\u00f3dulo configurado.
  if (!iduser) return false;
  const up = iduser.trim().toUpperCase();
  if (up === 'ADMIN') return true;
  const rows = await query(
    'system',
    `SELECT FIRST 1 COALESCE(t.master,0) AS master
       FROM usuario u
       LEFT JOIN tipo_usuario t ON t.idtipo_usuario = u.idtipo_usuario
      WHERE UPPER(TRIM(u.iduser)) = UPPER(TRIM(?))`,
    [iduser],
  );
  return !!(rows[0] && Number(rows[0].master) === 1);
}

/**
 * Obtiene los m\u00f3dulos habilitados desde configuracion_usuario.
 * Estrategia: priorizar la IP pasada; si no hay coincidencia, busca una IP que tenga
 * alguno habilitado (suficiente para entornos de cliente \u00fanico).
 */
async function modulosHabilitados(ip) {
  let m = await ConfiguracionModel.modulosPorIp(ip);
  if (!m.contabilidad && !m.talento_humano) {
    const rows = await query(
      'server',
      `SELECT FIRST 1 COALESCE(contabilidad,0) AS contabilidad,
              COALESCE(talento_humano,0) AS talento_humano
         FROM configuracion_usuario
        WHERE COALESCE(contabilidad,0) = 1 OR COALESCE(talento_humano,0) = 1`,
    );
    if (rows[0]) m = rows[0];
  }
  return {
    contabilidad: Number(m.contabilidad) === 1,
    talento_humano: Number(m.talento_humano) === 1,
  };
}

/**
 * Traduce la empresa del SYSTEM a la empresa del MASTER (independientes).
 * Master suele ser mono-empresa; el mapeo vive en MASTER.EMPRESAS.idempresa_system.
 *   1) busca la empresa master cuyo idempresa_system = la empresa system dada;
 *   2) si no hay, cae a env.MASTER_IDEMPRESA (default '1').
 * Best-effort: si la columna/tabla no existe, usa el fallback.
 */
async function masterIdempresaDe(sysIdempresa) {
  const sys = String(sysIdempresa ?? '').trim();
  if (sys) {
    try {
      const rows = await query(
        'master',
        // En MASTER la tabla es EMPRESA (singular); en SYSTEM es EMPRESAS (plural).
        `SELECT FIRST 1 CAST(TRIM(idempresa) AS VARCHAR(2) CHARACTER SET OCTETS) AS idempresa
           FROM empresa
          WHERE CAST(TRIM(idempresa_system) AS VARCHAR(2) CHARACTER SET OCTETS) = CAST(? AS VARCHAR(2) CHARACTER SET OCTETS)`,
        [sys],
      );
      const m = rows[0]?.idempresa != null ? String(rows[0].idempresa).trim() : '';
      if (m) return m;
    } catch (_) { /* master viejo sin la columna → fallback */ }
  }
  return String(env.MASTER_IDEMPRESA || '1').trim();
}

function calcularModulos(menuArr) {
  // pos1=Sistema(siempre 1), pos2=Contab (alg\u00fan check 1..12), pos3=RRHH (alg\u00fan check 13..19)
  const contab = menuArr.slice(0, 12).some(Boolean) ? '1' : '0';
  const rrhh   = menuArr.slice(12, 19).some(Boolean) ? '1' : '0';
  return '1' + contab + rrhh; // SIZE_MODULOS=3
}

function calcularMenuver(modulosHab) {
  // 10 chars: pos1=Contab, pos2=RRHH, resto en '0'
  let s = '';
  s += modulosHab.contabilidad ? '1' : '0';
  s += modulosHab.talento_humano ? '1' : '0';
  for (let i = 2; i < SIZE_MENUVER; i++) s += '0';
  return s;
}

const MasterSyncService = {
  SIZE_PERMISOS, SIZE_MENU, SIZE_MENUVER, SIZE_MODULOS,
  pad01, read01, calcularModulos, calcularMenuver, masterIdempresaDe,

  /**
   * Sincroniza el usuario en MASTER si corresponde (best-effort: nunca tira la request).
   * @param {string} iduser
   * @param {object} ctx { ip, claveNueva }
   */
  async syncUsuario(iduser, { ip = null, claveNueva = null, idempresa = null } = {}) {
    try {
      if (!MasterModel.habilitado()) return { skipped: 'master-disabled' };
      const rolMaster = await rolMasterDe(iduser);
      if (!rolMaster) return { skipped: 'rol-no-master' };

      const modHab = await modulosHabilitados(ip);
      if (!modHab.contabilidad && !modHab.talento_humano) {
        return { skipped: 'modulos-no-habilitados' };
      }

      const u = await UsuarioModel.findById(iduser);
      if (!u) return { skipped: 'usuario-no-encontrado' };

      const menuver = calcularMenuver(modHab);
      // Empresa MASTER (traducida desde la empresa system operativa; fallback a la de origen).
      const masterEmp = await masterIdempresaDe(idempresa || u.idempresa);

      await MasterModel.upsertUsuario({
        iduser: u.iduser,
        nombre: u.nombre,
        apellido: u.apellido,
        clave: claveNueva || null,
        estado: u.estado,
        idempresa: masterEmp,
        menuver,
      });

      // Si no existe USUARIOEMPRESA, crear con menu/permisos vac\u00edos y MODULOS calculados
      const ue = await MasterModel.obtenerUsuarioEmpresa(u.iduser, masterEmp);
      if (!ue) {
        await MasterModel.upsertUsuarioEmpresa({
          iduser: u.iduser,
          idempresa: masterEmp,
          permisos: pad01([], SIZE_PERMISOS),
          menu: pad01([], SIZE_MENU),
          modulos: '100', // Sistema=1, sin m\u00f3dulos activos a\u00fan
          estado: 1,
        });
      }
      return { ok: true };
    } catch (err) {
      logger.warn({ err, iduser }, 'masterSync.syncUsuario fall\u00f3 (best-effort)');
      return { error: err.message };
    }
  },

  /** Lee estado de accesos master de un usuario. */
  async obtenerAccesos(iduser, idempresa) {
    const empresa = await masterIdempresaDe(idempresa);
    const ue = await MasterModel.obtenerUsuarioEmpresa(iduser, empresa);
    return {
      habilitado: MasterModel.habilitado(),
      permisos: read01(ue?.permisos, SIZE_PERMISOS),
      menu: read01(ue?.menu, SIZE_MENU),
      modulos: ue?.modulos || '100',
    };
  },

  /** Guarda permisos + menu y recalcula MODULOS. */
  async actualizarAccesos(iduser, { permisos, menu }, idempresa, ip) {
    if (!MasterModel.habilitado()) {
      const e = new Error('Replicaci\u00f3n MASTER deshabilitada');
      e.status = 400;
      throw e;
    }
    const empresa = await masterIdempresaDe(idempresa);
    const permisosStr = pad01(permisos || [], SIZE_PERMISOS);
    const menuArr = (menu || []).slice(0, SIZE_MENU);
    const menuStr = pad01(menuArr, SIZE_MENU);
    const modulos = calcularModulos(menuArr);

    // Asegurar existencia en USUARIO de master (con la misma empresa system operativa)
    await this.syncUsuario(iduser, { ip, idempresa });

    await MasterModel.upsertUsuarioEmpresa({
      iduser,
      idempresa: empresa,
      permisos: permisosStr,
      menu: menuStr,
      modulos,
      estado: 1,
    });
    return { permisos: permisosStr, menu: menuStr, modulos };
  },
};

module.exports = MasterSyncService;
