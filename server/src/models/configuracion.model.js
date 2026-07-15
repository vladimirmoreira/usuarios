'use strict';

const { query, transaction } = require('../config/firebird');

// Dialect 1: SYSTEM es palabra reservada. Columna real = SYSTEM_BD; alias SYS_CFG.
const COLS = `ip, server, SYSTEM_BD AS SYS_CFG, MASTER_BD AS MASTER, user_bd, clave,
              legajo, biometrico, gastronomia, maximo,
              complementario, ruta_archivo, version_nro, autorizado,
              contabilidad, talento_humano, dias_inactividad,
              COALESCE(crear_sin_rol, 1) AS crear_sin_rol,
              COALESCE(clonar, 0) AS clonar,
              COALESCE(replicar, 0) AS replicar,
              metadata_ejecutado`;

const ConfiguracionModel = {
  async listar() {
    return query('server', `SELECT ${COLS} FROM configuracion_usuario ORDER BY ip`);
  },

  async obtener(ip) {
    const rows = await query(
      'server',
      `SELECT FIRST 1 ${COLS} FROM configuracion_usuario WHERE ip = ?`,
      [ip],
    );
    return rows[0] || null;
  },

  async crear(data) {
    return transaction('server', async (tx) => {
      await tx.query(
        `INSERT INTO configuracion_usuario
           (ip, server, SYSTEM_BD, MASTER_BD, user_bd, clave,
            legajo, biometrico, gastronomia, maximo,
            complementario, ruta_archivo, version_nro, autorizado,
            contabilidad, talento_humano, dias_inactividad, crear_sin_rol,
            clonar, replicar, metadata_ejecutado)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          data.ip, data.server, data.sys_cfg, data.master, data.user_bd, data.clave,
          data.legajo ?? 0, data.biometrico ?? 0, data.gastronomia ?? 0,
          data.maximo ?? null, data.complementario ?? 0,
          data.ruta_archivo ?? null, data.version_nro ?? null, data.autorizado ?? null,
          data.contabilidad ?? 0, data.talento_humano ?? 0,
          data.dias_inactividad ?? 90, data.crear_sin_rol ?? 1,
          data.clonar ?? 0, data.replicar ?? 0, data.metadata_ejecutado ?? 0,
        ],
      );
    });
  },

  async actualizar(ip, data) {
    return transaction('server', async (tx) => {
      const MAP = {
        server: 'server', sys_cfg: 'SYSTEM_BD', master: 'MASTER_BD',
        user_bd: 'user_bd', clave: 'clave',
        legajo: 'legajo', biometrico: 'biometrico', gastronomia: 'gastronomia',
        maximo: 'maximo', complementario: 'complementario',
        ruta_archivo: 'ruta_archivo', version_nro: 'version_nro', autorizado: 'autorizado',
        contabilidad: 'contabilidad', talento_humano: 'talento_humano',
        dias_inactividad: 'dias_inactividad',
        crear_sin_rol: 'crear_sin_rol',
        clonar: 'clonar', replicar: 'replicar',
        metadata_ejecutado: 'metadata_ejecutado',
      };
      const sets = [];
      const params = [];
      for (const [key, col] of Object.entries(MAP)) {
        if (data[key] !== undefined) { sets.push(`${col} = ?`); params.push(data[key]); }
      }
      // Cambio de IP (renombrar PK natural)
      if (data.ip !== undefined && data.ip !== ip) {
        sets.push('ip = ?');
        params.push(data.ip);
      }
      if (!sets.length) return 0;
      params.push(ip);
      await tx.query(
        `UPDATE configuracion_usuario SET ${sets.join(', ')} WHERE ip = ?`,
        params,
      );
      return 1;
    });
  },

  async eliminar(ip) {
    return transaction('server', async (tx) => {
      await tx.query('DELETE FROM configuracion_usuario WHERE ip = ?', [ip]);
      return 1;
    });
  },

  /** Devuelve true si el usuario es Admin o coincide con el campo AUTORIZADO. */
  async isAutorizado(iduser) {
    if (!iduser) return false;
    if (iduser.trim().toUpperCase() === 'ADMIN') return true;
    const rows = await query(
      'server',
      `SELECT FIRST 1 ip FROM configuracion_usuario
        WHERE UPPER(TRIM(autorizado)) = UPPER(TRIM(?))`,
      [iduser],
    );
    return rows.length > 0;
  },

  /**
   * Devuelve los flags de módulos (contabilidad / talento_humano) para una IP.
   * Si no existe la fila, se asume todo desactivado.
   */
  async modulosPorIp(ip) {
    if (!ip) return { contabilidad: 0, talento_humano: 0 };
    const rows = await query(
      'server',
      `SELECT FIRST 1 COALESCE(contabilidad,0) AS contabilidad,
              COALESCE(talento_humano,0) AS talento_humano
         FROM configuracion_usuario WHERE ip = ?`,
      [ip],
    );
    return rows[0] || { contabilidad: 0, talento_humano: 0 };
  },
  /**
   * Umbral configurado (en días) para considerar a un usuario "sin actividad".
   * Se toma la primera fila de CONFIGURACION_USUARIO. Default 90.
   */
  async umbralInactividad() {
    try {
      const rows = await query(
        'server',
        `SELECT FIRST 1 COALESCE(dias_inactividad, 90) AS dias
           FROM configuracion_usuario ORDER BY ip`,
      );
      return Number(rows[0]?.dias) || 90;
    } catch (_) { return 90; }
  },
};

module.exports = ConfiguracionModel;
