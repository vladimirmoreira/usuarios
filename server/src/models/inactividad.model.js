'use strict';

const { query } = require('../config/firebird');
const ConfiguracionModel = require('./configuracion.model');

/**
 * Detección de inactividad usando tabla REGISTRO (BD server).
 *
 * Reglas:
 *   - Umbral por defecto: CONFIGURACION_USUARIO.DIAS_INACTIVIDAD (fallback 90).
 *   - Sólo se consideran usuarios con al menos un registro y última fecha
 *     anterior al umbral.
 *   - Se excluyen:
 *       • cuentas con estado != 1 o exclusion = 1
 *       • ADMIN
 *       • todos los IDUSER referenciados desde TIPO_USUARIO (plantillas
 *         de rol, que nunca se loguean por diseño)
 */
const InactividadModel = {
  /**
   * @param {number?} umbralDias  Si null/undefined se usa el de CONFIGURACION_USUARIO.
   * @param {object} opts
   * @param {number?} opts.idperfilFiltro
   */
  async listar(umbralDias, { idperfilFiltro = null } = {}) {
    const efectivo = umbralDias != null
      ? Number(umbralDias)
      : await ConfiguracionModel.umbralInactividad();
    const dias = Math.max(1, Math.min(3650, efectivo || 90));

    // 1) Última fecha por usuario en BD `server`, ya filtrada por umbral.
    const ultimos = await query(
      'server',
      `SELECT TRIM(UPPER(usuario)) AS iduser,
              MAX(fecha) AS ultima_fecha
         FROM registro
        WHERE usuario IS NOT NULL
        GROUP BY TRIM(UPPER(usuario))
        HAVING MAX(fecha) < DATEADD(-${dias} DAY TO CURRENT_DATE)`,
    );
    if (!ultimos.length) return { dias, rows: [] };

    // 2) Cruzamos con BD `system` para traer datos del usuario y filtrar:
    //    activos, no excluidos, no ADMIN y no plantillas de TIPO_USUARIO.
    const ids = ultimos.map((r) => r.iduser);
    const placeholders = ids.map(() => '?').join(',');
    const perfilCond = idperfilFiltro != null ? 'AND u.idtipo_usuario = ?' : '';

    const usuarios = await query(
      'system',
      `SELECT TRIM(UPPER(u.iduser)) AS iduser, u.nombre, u.apellido,
              u.idtipo_usuario
         FROM usuario u
        WHERE COALESCE(u.estado,0) = 1
          AND COALESCE(u.exclusion,0) = 0
          AND UPPER(TRIM(u.iduser)) <> 'ADMIN'
          AND TRIM(UPPER(u.iduser)) NOT IN (
                SELECT TRIM(UPPER(t.iduser)) FROM tipo_usuario t
                 WHERE t.iduser IS NOT NULL
              )
          AND TRIM(UPPER(u.iduser)) IN (${placeholders})
          ${perfilCond}`,
      idperfilFiltro != null ? [...ids, idperfilFiltro] : ids,
    );

    const fechaPorUser = new Map(ultimos.map((r) => [r.iduser, r.ultima_fecha]));
    const hoy = new Date();
    const out = usuarios.map((u) => {
      const f = fechaPorUser.get(u.iduser);
      const dt = f instanceof Date ? f : new Date(f);
      const diff = Math.floor((hoy.getTime() - dt.getTime()) / 86400000);
      return {
        iduser: u.iduser,
        nombre: u.nombre,
        apellido: u.apellido,
        idtipo_usuario: u.idtipo_usuario,
        ultimaFecha: dt.toISOString().slice(0, 10),
        diasInactivo: diff,
      };
    });
    out.sort((a, b) => b.diasInactivo - a.diasInactivo);
    return { dias, rows: out };
  },
};

module.exports = InactividadModel;
