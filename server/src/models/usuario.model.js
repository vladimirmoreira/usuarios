'use strict';

const { query, transaction } = require('../config/firebird');

const UsuarioModel = {
  async findByCredentials(iduser, idempresa) {
    const rows = await query(
      'system',
      `SELECT FIRST 1 iduser, nombre, apellido, idempresa, idtipo_usuario, estado, pass
         FROM usuario WHERE UPPER(iduser) = UPPER(?) AND idempresa = ? AND COALESCE(estado,0) = 1`,
      [iduser, idempresa],
    );
    if (!rows.length) return null;
    const u = rows[0];
    // pass se compara fuera (bcrypt o legacy plano)
    return u;
  },

  async findById(iduser) {
    const rows = await query(
      'system',
      `SELECT iduser, nombre, apellido, idempresa, idtipo_usuario, estado, documento, control, exclusion
         FROM usuario WHERE UPPER(iduser) = UPPER(?)`,
      [iduser],
    );
    return rows[0] || null;
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
    const extraCols = conPerfil ? ', COALESCE(t.descripcion, \'-\') AS perfil' : '';
    const extraJoin = conPerfil
      ? 'LEFT JOIN tipo_usuario t ON t.idtipo_usuario = u.idtipo_usuario' : '';
    const sql = `
      SELECT ${first} u.iduser, u.nombre, u.apellido, u.documento, u.idtipo_usuario, u.estado,
             IIF((SELECT COUNT(*) FROM menu_general mg WHERE UPPER(TRIM(mg.iduser)) = UPPER(TRIM(u.iduser))) = 0, 1, 0) AS sin_menu,
             COALESCE(u.exclusion_permisos, 0) AS exclusion_permisos
             ${extraCols}
        FROM usuario u
        ${extraJoin}
       WHERE ${where.join(' AND ')}
       ORDER BY u.iduser`;
    return query('system', sql, params);
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
        WHERE UPPER(TRIM(iduser)) = UPPER(TRIM(?))`,
      [iduser],
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
      params.push(iduser);
      await tx.query(
        `UPDATE usuarioempresa SET ${sets.join(', ')} WHERE UPPER(TRIM(iduser)) = UPPER(TRIM(?))`,
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
        `SELECT h.id, h.usuario, h.idoperacion,
                COALESCE(t.descripcion, CAST(h.idoperacion AS VARCHAR(10))) AS descripcion,
                h.fecha, h.autorizacion, h.observacion
           FROM historial_usuario h
           LEFT JOIN tipo_operacion t ON t.idtipo_operacion = h.idoperacion
          WHERE UPPER(h.usuario) = UPPER(?)
          ORDER BY h.id DESC
          ROWS ? TO ?`,
        [iduser, offset + 1, offset + size],
      ),
      query(
        'server',
        'SELECT COUNT(*) AS total FROM historial_usuario WHERE UPPER(usuario) = UPPER(?)',
        [iduser],
      ),
    ]);
    const total = Number(totalRows[0]?.total || 0);
    return { rows, page: p, pageSize: size, total, totalPages: Math.ceil(total / size) || 1 };
  },
};

module.exports = UsuarioModel;
