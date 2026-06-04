'use strict';

/**
 * Acceso a la BD MASTER (Contabilidad / RRHH).
 * Tablas:
 *   - USUARIO         (IDUSUARIO, NOMBRE, APELLIDO, CLAVE, ESTADO, MENUVER, IDEMPRESA)
 *   - USUARIOEMPRESA  (IDUSUARIO, IDEMPRESA, IDGRUPOUSUARIO, PERMISOS, MENU, ESTADO, MODULOS)
 *
 * Strings posicionales (0/1, idx 1-based, no espacios):
 *   - USUARIO.MENUVER          (10)  pos1=Contabilidad, pos2=Talento Humano
 *   - USUARIOEMPRESA.PERMISOS  ( 9)  ver TMP$USUARIO_PERMISOS_MASTER
 *   - USUARIOEMPRESA.MENU      (19)  ver TMP$USUARIO_MENU_MASTER
 *   - USUARIOEMPRESA.MODULOS   ( 3)  pos1=Sistema(1), pos2=Contab, pos3=RRHH
 */

const { transaction, query } = require('../config/firebird');
const env = require('../config/env');

const IDGRUPO_DEFAULT = 1;

const MasterModel = {
  /** ¿El pool master está activo en este entorno? */
  habilitado() {
    return !!(env.MASTER_HOST && env.MASTER_DATABASE);
  },

  async obtenerUsuario(iduser) {
    if (!this.habilitado()) return null;
    const rows = await query(
      'master',
      `SELECT FIRST 1 idusuario, nombre, apellido, clave, estado, menuver, idempresa
         FROM usuario WHERE UPPER(TRIM(idusuario)) = UPPER(TRIM(?))`,
      [iduser],
    );
    return rows[0] || null;
  },

  async obtenerUsuarioEmpresa(iduser, idempresa) {
    if (!this.habilitado()) return null;
    const rows = await query(
      'master',
      `SELECT FIRST 1 idusuario, idempresa, idgrupousuario, permisos, menu, estado, modulos
         FROM usuarioempresa
        WHERE UPPER(TRIM(idusuario)) = UPPER(TRIM(?)) AND idempresa = ?`,
      [iduser, idempresa],
    );
    return rows[0] || null;
  },

  /** Upsert sobre MASTER.USUARIO (no toca MENUVER si ya existe y no se manda). */
  async upsertUsuario({ iduser, nombre, apellido, clave, estado, idempresa, menuver }) {
    if (!this.habilitado()) return 0;
    return transaction('master', async (tx) => {
      const existe = await tx.query(
        `SELECT FIRST 1 idusuario, menuver FROM usuario
          WHERE UPPER(TRIM(idusuario)) = UPPER(TRIM(?))`,
        [iduser],
      );
      if (existe.length) {
        const sets = ['nombre = ?', 'apellido = ?', 'estado = ?', 'idempresa = ?'];
        const params = [nombre || '', apellido || '', estado ?? 0, idempresa];
        if (clave != null) { sets.push('clave = ?'); params.push(clave); }
        if (menuver != null) { sets.push('menuver = ?'); params.push(menuver); }
        params.push(iduser);
        await tx.query(
          `UPDATE usuario SET ${sets.join(', ')}
            WHERE UPPER(TRIM(idusuario)) = UPPER(TRIM(?))`,
          params,
        );
      } else {
        await tx.query(
          `INSERT INTO usuario (idusuario, nombre, apellido, clave, estado, menuver, idempresa)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            iduser,
            nombre || '',
            apellido || '',
            clave || '',
            estado ?? 1,
            menuver || '1100000000',
            idempresa,
          ],
        );
      }
      return 1;
    });
  },

  /** Upsert sobre MASTER.USUARIOEMPRESA. */
  async upsertUsuarioEmpresa({ iduser, idempresa, permisos, menu, modulos, estado }) {
    if (!this.habilitado()) return 0;
    return transaction('master', async (tx) => {
      const existe = await tx.query(
        `SELECT FIRST 1 idusuario FROM usuarioempresa
          WHERE UPPER(TRIM(idusuario)) = UPPER(TRIM(?)) AND idempresa = ?`,
        [iduser, idempresa],
      );
      if (existe.length) {
        const sets = [];
        const params = [];
        if (permisos != null) { sets.push('permisos = ?'); params.push(permisos); }
        if (menu     != null) { sets.push('menu = ?');     params.push(menu); }
        if (modulos  != null) { sets.push('modulos = ?');  params.push(modulos); }
        if (estado   != null) { sets.push('estado = ?');   params.push(estado); }
        if (!sets.length) return 0;
        params.push(iduser, idempresa);
        await tx.query(
          `UPDATE usuarioempresa SET ${sets.join(', ')}
            WHERE UPPER(TRIM(idusuario)) = UPPER(TRIM(?)) AND idempresa = ?`,
          params,
        );
      } else {
        await tx.query(
          `INSERT INTO usuarioempresa
             (idusuario, idempresa, idgrupousuario, permisos, menu, estado, modulos)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            iduser,
            idempresa,
            IDGRUPO_DEFAULT,
            permisos || '',
            menu || '',
            estado ?? 1,
            modulos || '100',
          ],
        );
      }
      return 1;
    });
  },
};

module.exports = MasterModel;
