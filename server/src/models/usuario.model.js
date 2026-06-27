'use strict';

const { query, transaction, readBinaryBlob } = require('../config/firebird');
const { decodeRows } = require('../utils/charset');

const UsuarioModel = {
  async findByCredentials(iduser, idempresa) {
    // BD system (orgonita_system) es CHARACTER SET ASCII y node-firebird conecta en NONE:
    // hay que comparar los parámetros de texto casteando ambos lados a OCTETS, si no Firebird
    // lanza "Cannot transliterate character between character sets".
    const idu = String(iduser || '').trim().toUpperCase();
    const emp = String(idempresa || '').trim();
    const rows = await query(
      'system',
      `SELECT FIRST 1 u.iduser, u.nombre, u.apellido, u.idempresa, u.idtipo_usuario, u.estado, u.pass, u.hasta_vigencia,
              (SELECT COUNT(*) FROM menu_general mg
                 WHERE UPPER(TRIM(mg.iduser)) = UPPER(TRIM(u.iduser))
                   AND CAST(TRIM(mg.idmenu) AS VARCHAR(30) CHARACTER SET OCTETS) = CAST(? AS VARCHAR(30) CHARACTER SET OCTETS)
                   AND mg.permiso = 1
                   AND mg.idempresa = u.idempresa) AS acceso_modulo
         FROM usuario u
        WHERE CAST(UPPER(TRIM(u.iduser)) AS VARCHAR(30) CHARACTER SET OCTETS) = CAST(? AS VARCHAR(30) CHARACTER SET OCTETS)
          AND CAST(TRIM(u.idempresa) AS VARCHAR(2) CHARACTER SET OCTETS) = CAST(? AS VARCHAR(2) CHARACTER SET OCTETS)
          AND COALESCE(u.estado,0) = 1`,
      ['mnuArchivoPanelControl', idu, emp],
    );
    if (!rows.length) return null;
    const u = rows[0];
    // pass se compara fuera (bcrypt o legacy plano).
    // acceso_modulo > 0 → el usuario tiene el menú 'mnuArchivoPanelControl' habilitado.
    return u;
  },

  async findById(iduser) {
    const rows = await query(
      'system',
      `SELECT CAST(iduser   AS VARCHAR(10)  CHARACTER SET OCTETS) AS iduser,
              CAST(nombre   AS VARCHAR(120) CHARACTER SET OCTETS) AS nombre,
              CAST(apellido AS VARCHAR(120) CHARACTER SET OCTETS) AS apellido,
              idempresa, idtipo_usuario, estado,
              CAST(documento AS VARCHAR(40) CHARACTER SET OCTETS) AS documento,
              control, exclusion, hasta_vigencia
         FROM usuario
        WHERE CAST(UPPER(TRIM(iduser)) AS VARCHAR(10) CHARACTER SET OCTETS) = CAST(? AS VARCHAR(10) CHARACTER SET OCTETS)`,
      [String(iduser || '').trim().toUpperCase()],
    );
    return rows[0] ? decodeRows([rows[0]], ['iduser', 'nombre', 'apellido', 'documento'])[0] : null;
  },

  async listar({ busqueda, idperfil, estado }) {
    return UsuarioModel._listar({ busqueda, idperfil, estado, limit: 200 });
  },

  /**
   * Variante para export: sin tope de filas y con JOIN al perfil (descripción).
   */
  async exportar({ busqueda, idperfil, estado } = {}) {
    return UsuarioModel._listar({ busqueda, idperfil, estado, limit: null, conPerfil: true });
  },

  async _listar({ busqueda, idperfil, estado, limit, conPerfil = false }) {
    const where = [
      // Excluir usuarios reservados:
      //   1. Marcados con idtipo_usuario=-1 (nueva convención de plantillas de roles).
      //   2. Que existan como plantilla en tipo_usuario.iduser (datos pre-existentes).
      //   3. El superusuario Admin (case-insensitive), reservado solo para Roles.
      'COALESCE(u.idtipo_usuario, 0) <> -1',
      'u.iduser NOT IN (SELECT iduser FROM tipo_usuario WHERE iduser IS NOT NULL)',
      "UPPER(TRIM(u.iduser)) <> 'ADMIN'",
    ];
    const params = [];
    if (busqueda) {
      where.push('(UPPER(u.iduser) LIKE ? OR UPPER(u.nombre) LIKE ? OR UPPER(u.apellido) LIKE ? OR u.documento LIKE ?)');
      const like = `%${busqueda.toUpperCase()}%`;
      params.push(like, like, like, `%${busqueda}%`);
    }
    if (idperfil != null) {
      where.push('u.idtipo_usuario = ?');
      params.push(idperfil);
    }
    if (estado != null) {
      where.push('COALESCE(u.estado,0) = ?');
      params.push(estado);
    }
    const first = limit != null ? `FIRST ${Number(limit)}` : '';
    // BD ASCII: castear texto a OCTETS para evitar "Cannot transliterate" al leer acentos/ñ.
    const extraCols = conPerfil
      ? ', CAST(COALESCE(t.descripcion, \'-\') AS VARCHAR(120) CHARACTER SET OCTETS) AS perfil' : '';
    const extraJoin = conPerfil
      ? 'LEFT JOIN tipo_usuario t ON t.idtipo_usuario = u.idtipo_usuario' : '';
    const sql = `
      SELECT ${first}
             CAST(u.iduser    AS VARCHAR(30)  CHARACTER SET OCTETS) AS iduser,
             CAST(u.nombre    AS VARCHAR(120) CHARACTER SET OCTETS) AS nombre,
             CAST(u.apellido  AS VARCHAR(120) CHARACTER SET OCTETS) AS apellido,
             CAST(u.documento AS VARCHAR(40)  CHARACTER SET OCTETS) AS documento,
             u.idtipo_usuario, u.estado, u.hasta_vigencia,
             IIF((SELECT COUNT(*) FROM menu_general mg WHERE UPPER(TRIM(mg.iduser)) = UPPER(TRIM(u.iduser))) = 0, 1, 0) AS sin_menu,
             COALESCE(u.exclusion_permisos, 0) AS exclusion_permisos
             ${extraCols}
        FROM usuario u
        ${extraJoin}
       WHERE ${where.join(' AND ')}
       ORDER BY u.iduser`;
    const rows = await query('system', sql, params);
    return decodeRows(rows, ['iduser', 'nombre', 'apellido', 'documento', 'perfil']);
  },

  /** Llama al SP que orquesta el alta completa en server + system. */
  async altaPorSp({ iduser, idperfil, nombre, apellido, documento, idsucursal, rptUser }) {
    const rows = await query(
      'server',
      `SELECT mensaje FROM PCD_USUARIO(?, ?, ?, ?, ?, ?, NULL, ?)`,
      [iduser, nombre, apellido, documento, idperfil, idsucursal, rptUser],
    );
    return rows[0]?.mensaje || 'ERROR';
  },

  async operacion({ iduser, idoperacion, rptUser, idsucursal = null, idperfil = null, nombre = null, apellido = null, documento = null }) {
    const rows = await query(
      'server',
      `SELECT mensaje FROM PCD_OPERACIONES(?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      [iduser, idoperacion, rptUser, idsucursal, idperfil, nombre, apellido, documento],
    );
    return rows[0]?.mensaje || 'ERROR';
  },

  async actualizarBasicos(iduser, { nombre, apellido, documento }) {
    return transaction('system', async (tx) => {
      const sets = [];
      const params = [];
      if (nombre != null) { sets.push('nombre = ?'); params.push(nombre); }
      if (apellido != null) { sets.push('apellido = ?'); params.push(apellido); }
      if (documento != null) { sets.push('documento = ?'); params.push(documento); }
      if (!sets.length) return 0;
      params.push(iduser);
      await tx.query(`UPDATE usuario SET ${sets.join(', ')} WHERE iduser = ?`, params);
      return 1;
    });
  },

  /**
   * Genera la lista de candidatos de iduser según la regla:
   *   1ª fase: N letras del nombre + 1er apellido (creciente, máx 10)
   *   2ª fase: N letras del nombre + 1er apellido + 2do apellido (si existe)
   * Devuelve el primer candidato que NO exista en la BD, o null si todos están ocupados.
   */
  async sugerirIduser(nombre, apellido) {
    const n = nombre.trim().toUpperCase().replace(/[^A-Z]/g, '');
    const partes = apellido.trim().toUpperCase()
      .split(/\s+/).map((p) => p.replace(/[^A-Z]/g, '')).filter(Boolean);
    const ap1 = partes[0] || '';
    const ap2 = partes[1] || '';

    const visto = new Set();
    const candidatos = [];
    const add = (raw) => {
      const c = raw.slice(0, 10);
      if (!visto.has(c)) { visto.add(c); candidatos.push(c); }
    };

    for (let i = 1; i <= n.length; i++) add(n.slice(0, i) + ap1);
    if (ap2) {
      for (let i = 1; i <= n.length; i++) add(n.slice(0, i) + ap1 + ap2);
    }

    if (!candidatos.length) return null;

    const placeholders = candidatos.map(() => '?').join(', ');
    const rows = await query(
      'system',
      `SELECT UPPER(TRIM(iduser)) AS iduser FROM usuario WHERE UPPER(TRIM(iduser)) IN (${placeholders})`,
      candidatos,
    );
    const existentes = new Set(rows.map((r) => String(r.iduser).toUpperCase().trim()));
    for (const c of candidatos) {
      if (!existentes.has(c)) return c;
    }
    return null;
  },

  /** Verifica si el documento ya está registrado en otro usuario. */
  async existeDocumento(documento, excludeIduser) {
    const sql = excludeIduser
      ? 'SELECT FIRST 1 iduser FROM usuario WHERE documento = ? AND UPPER(TRIM(iduser)) <> UPPER(TRIM(?))'
      : 'SELECT FIRST 1 iduser FROM usuario WHERE documento = ?';
    const params = excludeIduser ? [documento, excludeIduser] : [documento];
    const rows = await query('system', sql, params);
    return rows.length > 0;
  },

  async actualizarFoto(iduser, fotoBase64) {
    const buffer = Buffer.from(fotoBase64, 'base64');
    return transaction('system', async (tx) => {
      await tx.query(
        'UPDATE usuario SET foto = ? WHERE UPPER(iduser) = UPPER(?)',
        [buffer, iduser],
      );
      return 1;
    });
  },

  /** Define (o limpia con null) la fecha de vigencia 'YYYY-MM-DD' del usuario. */
  async setVigencia(iduser, hasta) {
    return query(
      'system',
      `UPDATE usuario SET hasta_vigencia = CAST(? AS TIMESTAMP)
        WHERE CAST(UPPER(TRIM(iduser)) AS VARCHAR(10) CHARACTER SET OCTETS) = CAST(? AS VARCHAR(10) CHARACTER SET OCTETS)`,
      [hasta || null, String(iduser || '').trim().toUpperCase()],
    );
  },

  /** Caduca (estado=0) los usuarios activos cuya vigencia ya venció. Devuelve los iduser afectados. */
  async caducarVencidos() {
    const cond = `hasta_vigencia IS NOT NULL AND hasta_vigencia < CURRENT_TIMESTAMP AND COALESCE(estado,0) = 1`;
    const venc = await query('system',
      `SELECT CAST(iduser AS VARCHAR(10) CHARACTER SET OCTETS) AS iduser FROM usuario WHERE ${cond}`);
    if (!venc.length) return [];
    await query('system', `UPDATE usuario SET estado = 0 WHERE ${cond}`);
    return venc.map((v) => v.iduser);
  },

  /** Lee el BLOB binario crudo de la foto (Buffer) o null si no tiene. */
  async getFotoRaw(iduser) {
    return readBinaryBlob(
      'system',
      `SELECT foto FROM usuario
        WHERE CAST(UPPER(TRIM(iduser)) AS VARCHAR(10) CHARACTER SET OCTETS) = CAST(? AS VARCHAR(10) CHARACTER SET OCTETS)`,
      [String(iduser || '').trim().toUpperCase()],
    );
  },

  /**
   * Bloquea (estado=2) todos los usuarios activos (estado=1) que no tienen
   * ninguna entrada en menu_general. Excluye plantillas de roles y Admin.
   */
  async bloquearSinMenu() {
    return query(
      'system',
      `UPDATE usuario SET estado = 2
         WHERE COALESCE(estado, 0) = 1
           AND COALESCE(idtipo_usuario, 0) <> -1
           AND documento IS NOT NULL
           AND UPPER(TRIM(iduser)) <> 'ADMIN'
           AND iduser NOT IN (SELECT iduser FROM tipo_usuario WHERE iduser IS NOT NULL)
           AND NOT EXISTS (
                 SELECT 1 FROM menu_general mg
                  WHERE UPPER(TRIM(mg.iduser)) = UPPER(TRIM(usuario.iduser))
           )`,
      [],
    );
  },

  async getComplemento(iduser) {
    const rows = await query(
      'system',
      `SELECT FIRST 1 modo_print, talonario, descuento
         FROM usuarioempresa
        WHERE CAST(UPPER(TRIM(iduser)) AS VARCHAR(30) CHARACTER SET OCTETS) = CAST(? AS VARCHAR(30) CHARACTER SET OCTETS)`,
      [String(iduser || '').trim().toUpperCase()],
    );
    return rows[0] || { modo_print: null, talonario: null, descuento: null };
  },

  async updateComplemento(iduser, { modo_print, talonario, descuento }) {
    return transaction('system', async (tx) => {
      const sets = [];
      const params = [];
      if (modo_print !== undefined) { sets.push('modo_print = ?'); params.push(modo_print); }
      if (talonario  !== undefined) { sets.push('talonario = ?');  params.push(talonario); }
      if (descuento  !== undefined) { sets.push('descuento = ?');  params.push(descuento); }
      if (!sets.length) return 0;
      params.push(String(iduser || '').trim().toUpperCase());
      await tx.query(
        `UPDATE usuarioempresa SET ${sets.join(', ')}
          WHERE CAST(UPPER(TRIM(iduser)) AS VARCHAR(30) CHARACTER SET OCTETS) = CAST(? AS VARCHAR(30) CHARACTER SET OCTETS)`,
        params,
      );
      return 1;
    });
  },

  async historial(iduser, { page = 1, pageSize = 50 } = {}) {
    const p = Math.max(1, Number(page) || 1);
    const size = Math.min(200, Math.max(1, Number(pageSize) || 50));
    const offset = (p - 1) * size;
    const [rows, totalRows] = await Promise.all([
      query(
        'server',
        `SELECT h.id,
                CAST(h.usuario AS VARCHAR(10) CHARACTER SET OCTETS) AS usuario,
                h.idoperacion,
                CAST(COALESCE(t.descripcion, CAST(h.idoperacion AS VARCHAR(10))) AS VARCHAR(120) CHARACTER SET OCTETS) AS descripcion,
                h.fecha,
                CAST(h.autorizacion AS VARCHAR(10) CHARACTER SET OCTETS) AS autorizacion,
                h.observacion
           FROM historial_usuario h
           LEFT JOIN tipo_operacion t ON t.idtipo_operacion = h.idoperacion
          WHERE CAST(UPPER(TRIM(h.usuario)) AS VARCHAR(10) CHARACTER SET OCTETS) = CAST(? AS VARCHAR(10) CHARACTER SET OCTETS)
          ORDER BY h.id DESC
          ROWS ? TO ?`,
        [String(iduser || '').trim().toUpperCase(), offset + 1, offset + size],
      ),
      query(
        'server',
        `SELECT COUNT(*) AS total FROM historial_usuario
          WHERE CAST(UPPER(TRIM(usuario)) AS VARCHAR(10) CHARACTER SET OCTETS) = CAST(? AS VARCHAR(10) CHARACTER SET OCTETS)`,
        [String(iduser || '').trim().toUpperCase()],
      ),
    ]);
    const total = Number(totalRows[0]?.total || 0);
    return {
      rows: decodeRows(rows, ['usuario', 'descripcion', 'autorizacion', 'observacion']),
      page: p, pageSize: size, total, totalPages: Math.ceil(total / size) || 1,
    };
  },
};

module.exports = UsuarioModel;
