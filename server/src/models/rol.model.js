'use strict';

const { query, transaction } = require('../config/firebird');

const RolModel = {
  /** Devuelve el iduser plantilla del rol (tipo_usuario.iduser).
   *  idperfil = 0 es el superusuario Admin (no vive en tipo_usuario). */
  async templateIduser(idperfil) {
    if (idperfil === 0) {
      const rows = await query(
        'system',
        `SELECT FIRST 1 iduser, 0 AS idtipo_usuario, nombre AS descripcion, 0 AS tipo, COALESCE(estado,0) AS estado, 0 AS master
           FROM usuario WHERE UPPER(TRIM(iduser)) = 'ADMIN'`,
      );
      return rows[0] || null;
    }
    const rows = await query(
      'system',
      `SELECT FIRST 1 iduser, idtipo_usuario, descripcion, tipo, estado,
              COALESCE(master,0) AS master, COALESCE(edicion_rol,0) AS edicion_rol
         FROM tipo_usuario WHERE idtipo_usuario = ?`,
      [idperfil],
    );
    return rows[0] || null;
  },

  /** Próximo id disponible (MAX + 1, nunca negativo). */
  async nextId() {
    const rows = await query('system', 'SELECT MAX(idtipo_usuario) AS mx FROM tipo_usuario');
    const mx = rows[0]?.mx ?? 0;
    return mx < 0 ? 1 : mx + 1;
  },

  async crear({ descripcion, iduser, tipo, master = 0 }) {
    const id = await this.nextId();
    await transaction('system', async (tx) => {
      // Fila en tipo_usuario
      await tx.query(
        `INSERT INTO tipo_usuario (idtipo_usuario, descripcion, iduser, tipo, estado, master)
         VALUES (?, ?, ?, ?, 1, ?)`,
        [id, descripcion.trim(), iduser.trim(), tipo, master ? 1 : 0],
      );
      // Fila en usuario para que sirva de plantilla
      await tx.query(
        `INSERT INTO usuario (iduser, nombre, apellido, idtipo_usuario, estado)
         VALUES (?, ?, 'PLANTILLA', -1, 1)`,
        [iduser.trim(), descripcion.trim()],
      );
    });
    return id;
  },

  async actualizar(idperfil, { descripcion, tipo, estado, master, edicion_rol }) {
    const sets = ['descripcion = ?', 'tipo = ?', 'estado = ?'];
    const params = [descripcion.trim(), tipo, estado];
    if (master !== undefined) { sets.push('master = ?'); params.push(master ? 1 : 0); }
    if (edicion_rol !== undefined) { sets.push('edicion_rol = ?'); params.push(edicion_rol ? 1 : 0); }
    params.push(idperfil);
    await query(
      'system',
      `UPDATE tipo_usuario SET ${sets.join(', ')} WHERE idtipo_usuario = ?`,
      params,
    );
  },

  /** Soft-delete: estado = 0. */
  async eliminar(idperfil) {
    await query(
      'system',
      `UPDATE tipo_usuario SET estado = 0 WHERE idtipo_usuario = ?`,
      [idperfil],
    );
  },

  /**
   * Lista todos los usuarios asignados a un rol (idtipo_usuario = idperfil),
   * incluyendo activos, bloqueados e inactivos.
   * Excluye filas plantilla (las que figuran en tipo_usuario.iduser).
   * Incluye el flag exclusion_permisos para saber si tienen permisos personalizados.
   */
  async listarUsuariosPorRol(idperfil) {
    return query(
      'system',
      `SELECT u.iduser, u.nombre, u.apellido, u.estado,
              COALESCE(u.exclusion_permisos, 0) AS exclusion_permisos
         FROM usuario u
        WHERE u.idtipo_usuario = ?
          AND NOT EXISTS (SELECT 1 FROM tipo_usuario t WHERE t.iduser = u.iduser)
          AND UPPER(TRIM(u.iduser)) <> 'ADMIN'
        ORDER BY u.apellido, u.nombre`,
      [idperfil],
    );
  },
};

module.exports = RolModel;
