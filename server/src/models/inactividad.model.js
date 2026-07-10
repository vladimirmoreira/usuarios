'use strict';

const { query } = require('../config/firebird');
const { decodeRows } = require('../utils/charset');
const ConfiguracionModel = require('./configuracion.model');

/**
 * ¿Existe USUARIO.EXCLUSION en la BD system? (cacheado).
 * Algunas instalaciones legacy solo tienen EXCLUSION_PERMISOS; en ese caso el
 * filtro por exclusión de cuenta se omite en vez de romper con -206 Column unknown.
 */
let _tieneExclusion = null;
async function usuarioTieneExclusion() {
  if (_tieneExclusion !== null) return _tieneExclusion;
  try {
    const r = await query(
      'system',
      `SELECT COUNT(*) AS n FROM RDB$RELATION_FIELDS
        WHERE RDB$RELATION_NAME = 'USUARIO' AND RDB$FIELD_NAME = 'EXCLUSION'`,
    );
    _tieneExclusion = Number(r[0]?.n || 0) > 0;
  } catch (_) {
    _tieneExclusion = false;
  }
  return _tieneExclusion;
}

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
        HAVING MAX(fecha) < DATEADD(-${dias} DAY TO CURRENT_TIMESTAMP)`,  /* dialect 1 */
    );
    if (!ultimos.length) return { dias, rows: [] };

    // 2) Cruzamos con BD `system` para traer datos del usuario y filtrar:
    //    activos, no excluidos, no ADMIN y no plantillas de TIPO_USUARIO.
    const ids = ultimos.map((r) => r.iduser);
    const placeholders = ids.map(() => '?').join(',');
    const perfilCond = idperfilFiltro != null ? 'AND u.idtipo_usuario = ?' : '';
    // Filtro de exclusión de cuenta solo si la columna existe en esta BD.
    const exclusionCond = (await usuarioTieneExclusion()) ? 'AND COALESCE(u.exclusion,0) = 0' : '';

    const usuarios = decodeRows(await query(
      'system',
      `SELECT TRIM(UPPER(u.iduser)) AS iduser,
              CAST(u.nombre   AS VARCHAR(120) CHARACTER SET OCTETS) AS nombre,
              CAST(u.apellido AS VARCHAR(120) CHARACTER SET OCTETS) AS apellido,
              u.idtipo_usuario
         FROM usuario u
        WHERE COALESCE(u.estado,0) = 1
          ${exclusionCond}
          AND UPPER(TRIM(u.iduser)) <> 'ADMIN'
          AND TRIM(UPPER(u.iduser)) NOT IN (
                SELECT TRIM(UPPER(t.iduser)) FROM tipo_usuario t
                 WHERE t.iduser IS NOT NULL
              )
          AND TRIM(UPPER(u.iduser)) IN (${placeholders})
          ${perfilCond}`,
      idperfilFiltro != null ? [...ids, idperfilFiltro] : ids,
    ), ['nombre', 'apellido']);

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

  /**
   * Vista unificada de "incidencias" de cuentas: combina
   *   - inactividad por falta de actividad (motivo 'inactividad'),
   *   - caducidad de vigencia ya vencida (motivo 'caducado'),
   *   - vigencia próxima a vencer (motivo 'por_caducar').
   * Un usuario aparece una sola vez; prioridad caducado > inactividad > por_caducar.
   * @param {object} opts
   * @param {number?} opts.diasInactividad  umbral de inactividad (fallback config)
   * @param {number}  opts.diasPorCaducar   ventana de "próximo a caducar" (default 30)
   * @param {number?} opts.idperfilFiltro
   */
  async listarIncidencias({ diasInactividad = null, diasPorCaducar = 30, idperfilFiltro = null } = {}) {
    const dpc = Math.max(0, Math.min(3650, Number(diasPorCaducar) || 30));

    // 1) Inactividad por actividad (reutiliza el método existente).
    const { dias: diasInact, rows: inactivos } = await this.listar(diasInactividad, { idperfilFiltro });

    // 2) Vigencia: caducados + próximos a caducar (activos, no Admin, no plantillas).
    const perfilCond = idperfilFiltro != null ? 'AND u.idtipo_usuario = ?' : '';
    const vigRows = decodeRows(await query(
      'system',
      `SELECT TRIM(UPPER(u.iduser)) AS iduser,
              CAST(u.nombre   AS VARCHAR(120) CHARACTER SET OCTETS) AS nombre,
              CAST(u.apellido AS VARCHAR(120) CHARACTER SET OCTETS) AS apellido,
              u.idtipo_usuario, u.hasta_vigencia
         FROM usuario u
        WHERE COALESCE(u.estado,0) = 1
          AND u.hasta_vigencia IS NOT NULL
          AND u.hasta_vigencia < DATEADD(${dpc} DAY TO CURRENT_TIMESTAMP)
          AND UPPER(TRIM(u.iduser)) <> 'ADMIN'
          AND TRIM(UPPER(u.iduser)) NOT IN (
                SELECT TRIM(UPPER(t.iduser)) FROM tipo_usuario t WHERE t.iduser IS NOT NULL
              )
          ${perfilCond}`,
      idperfilFiltro != null ? [idperfilFiltro] : [],
    ), ['nombre', 'apellido']);

    // 3) Merge por iduser.
    const map = new Map();
    for (const r of inactivos) map.set(r.iduser, { ...r, motivo: 'inactividad' });

    const hoy = new Date();
    for (const v of vigRows) {
      const dt = v.hasta_vigencia instanceof Date ? v.hasta_vigencia : new Date(v.hasta_vigencia);
      const diasParaCaducar = Math.floor((dt.getTime() - hoy.getTime()) / 86400000);
      const caducado = dt.getTime() < hoy.getTime();
      const vigData = { hastaVigencia: dt.toISOString().slice(0, 10), diasParaCaducar };
      const prev = map.get(v.iduser);
      if (prev) {
        Object.assign(prev, vigData);
        if (caducado) prev.motivo = 'caducado'; // eleva por sobre 'inactividad'
      } else {
        map.set(v.iduser, {
          iduser: v.iduser, nombre: v.nombre, apellido: v.apellido,
          idtipo_usuario: v.idtipo_usuario,
          motivo: caducado ? 'caducado' : 'por_caducar',
          ...vigData,
        });
      }
    }

    const rank = { caducado: 0, inactividad: 1, por_caducar: 2 };
    const rows = Array.from(map.values()).sort((a, b) => {
      if (rank[a.motivo] !== rank[b.motivo]) return rank[a.motivo] - rank[b.motivo];
      if (a.motivo === 'inactividad') return (b.diasInactivo || 0) - (a.diasInactivo || 0);
      return (a.diasParaCaducar ?? 0) - (b.diasParaCaducar ?? 0);
    });

    return { diasInactividad: diasInact, diasPorCaducar: dpc, rows };
  },
};

module.exports = InactividadModel;
