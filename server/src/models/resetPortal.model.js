'use strict';

const crypto = require('crypto');
const { query } = require('../config/firebird');
const logger = require('../utils/logger');

/**
 * Persistencia del portal público de auto-reset de clave (BD `system`).
 *
 * Flujo de dos códigos:
 *   - VERIFICADOR: 15 caracteres alfanuméricos + especiales que genera RR.HH.
 *     y comunica al usuario. Autentica al usuario en el portal. Único, 1 h de
 *     vigencia, un solo uso, máx. 3 intentos.
 *   - CLAVE_NUEVA: 7 dígitos numéricos que genera el sistema al aplicar el
 *     reset. Es la nueva contraseña real. Única (no se reutiliza).
 *
 * Estados (columna USADO):
 *   0 = pendiente (activo)   1 = usado (reset aplicado)
 *   2 = reemplazado (RR.HH. generó uno nuevo)   3 = bloqueado (3 intentos)
 */

const TTL_MIN = 60;                    // vigencia del verificador (minutos)
const MAX_INTENTOS = 2;                // intentos de tipeo del verificador
// Alfabeto sin caracteres ambiguos (0/O, 1/l/I) para evitar errores al dictarlo.
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%*+-=?';
const LARGO_VERIFICADOR = 15;

let _ensured = null;
/** Crea la tabla/índice on-demand (idempotente) para deploys ya existentes. */
async function ensureTabla() {
  if (_ensured) return _ensured;
  _ensured = (async () => {
    // Chequear existencia primero: evita que un CREATE fallido "already exists"
    // se loguee como error en cada reinicio (el helper query loguea a nivel 50).
    try {
      const rel = await query(
        'system',
        "SELECT 1 AS x FROM rdb$relations WHERE TRIM(rdb$relation_name) = 'RESET_CLAVE_PORTAL'",
        [],
      );
      if (rel.length) return; // ya existe → nada que hacer
    } catch (e) {
      logger.warn({ err: (e?.message || '').slice(0, 160) }, 'reset_clave_portal: no se pudo verificar existencia');
    }
    const ddl = [
      `CREATE TABLE reset_clave_portal (
         VERIFICADOR  VARCHAR(20) NOT NULL,
         IDUSER       VARCHAR(10) NOT NULL,
         GENERADO     TIMESTAMP,
         EXPIRA       TIMESTAMP,
         USADO        SMALLINT DEFAULT 0 NOT NULL,
         INTENTOS     SMALLINT DEFAULT 0 NOT NULL,
         GENERADO_POR VARCHAR(10),
         IP_ORIGEN    VARCHAR(40),
         CLAVE_NUEVA  VARCHAR(20),
         CONSTRAINT PK_RESET_CLAVE_PORTAL PRIMARY KEY (VERIFICADOR)
       )`,
      `CREATE INDEX IDX_RESET_PORTAL_USER ON reset_clave_portal (IDUSER)`,
    ];
    for (const sql of ddl) {
      try {
        await query('system', sql, []);
      } catch (e) {
        const m = e?.message || '';
        if (!/already exists|already defined|duplicate/i.test(m)) {
          logger.warn({ err: m.slice(0, 160) }, 'reset_clave_portal DDL');
        }
      }
    }
  })();
  return _ensured;
}

function randChars(alfabeto, largo) {
  let out = '';
  for (let i = 0; i < largo; i++) out += alfabeto[crypto.randomInt(alfabeto.length)];
  return out;
}

const ResetPortalModel = {
  TTL_MIN,
  MAX_INTENTOS,

  ensureTabla,

  async existeVerificador(v) {
    const r = await query('system', 'SELECT FIRST 1 1 AS x FROM reset_clave_portal WHERE verificador = ?', [v]);
    return r.length > 0;
  },

  async existeClave(c) {
    const r = await query('system', 'SELECT FIRST 1 1 AS x FROM reset_clave_portal WHERE clave_nueva = ?', [c]);
    return r.length > 0;
  },

  /** Verificador único de 15 caracteres. */
  async generarVerificador() {
    for (let i = 0; i < 12; i++) {
      const v = randChars(ALFABETO, LARGO_VERIFICADOR);
      if (!(await this.existeVerificador(v))) return v;
    }
    throw new Error('No se pudo generar un verificador único');
  },

  /** Clave nueva única de 7 dígitos numéricos (no se reutiliza). */
  async generarClave() {
    for (let i = 0; i < 20; i++) {
      const c = String(crypto.randomInt(0, 10_000_000)).padStart(7, '0');
      if (!(await this.existeClave(c))) return c;
    }
    throw new Error('No se pudo generar una clave única');
  },

  /** Marca como reemplazadas (usado=2) las solicitudes pendientes del usuario. */
  async supersederPendientes(iduser) {
    await query(
      'system',
      'UPDATE reset_clave_portal SET usado = 2 WHERE usado = 0 AND UPPER(TRIM(iduser)) = UPPER(TRIM(?))',
      [iduser],
    );
  },

  async insertar({ verificador, iduser, generadoPor, ip, generado, expira }) {
    await query(
      'system',
      `INSERT INTO reset_clave_portal (verificador, iduser, generado, expira, usado, intentos, generado_por, ip_origen)
       VALUES (?, ?, ?, ?, 0, 0, ?, ?)`,
      [verificador, String(iduser).trim(), generado, expira, generadoPor || null, ip || null],
    );
  },

  /** Solicitud pendiente (usado=0) más reciente del usuario, o null. */
  async pendientePorUser(iduser) {
    const r = await query(
      'system',
      `SELECT FIRST 1 verificador, iduser, generado, expira, usado, intentos, generado_por
         FROM reset_clave_portal
        WHERE usado = 0 AND UPPER(TRIM(iduser)) = UPPER(TRIM(?))
        ORDER BY generado DESC`,
      [iduser],
    );
    return r[0] || null;
  },

  async setIntentos(verificador, n) {
    await query('system', 'UPDATE reset_clave_portal SET intentos = ? WHERE verificador = ?', [n, verificador]);
  },

  async marcarBloqueado(verificador) {
    await query('system', 'UPDATE reset_clave_portal SET usado = 3 WHERE verificador = ?', [verificador]);
  },

  async marcarUsada(verificador, claveNueva) {
    await query('system', 'UPDATE reset_clave_portal SET usado = 1, clave_nueva = ? WHERE verificador = ?', [claveNueva, verificador]);
  },

  /** Nombre/apellido del usuario (para mostrar en el portal). */
  async nombreUsuario(iduser) {
    const r = await query('system', 'SELECT FIRST 1 nombre, apellido FROM usuario WHERE iduser = ?', [iduser]);
    if (!r[0]) return null;
    return [r[0].nombre, r[0].apellido].filter(Boolean).join(' ').trim() || null;
  },
};

module.exports = ResetPortalModel;
