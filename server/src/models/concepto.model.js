'use strict';

const { query, transaction } = require('../config/firebird');

const ConceptoModel = {
  /**
   * Devuelve todos los registros de tipomovimiento WHERE estado = 1
   * ordenados por tipo y descripcion.
   */
  listarTiposMovimiento: () =>
    query(
      'server',
      `SELECT idtipomovimiento, descripcion, tipo
         FROM tipomovimiento
        WHERE estado = 1
        ORDER BY tipo, descripcion`,
    ).catch(() => []),

  /**
   * Devuelve los registros de USUARIO_CONCEPTO para un usuario dado.
   * Incluye los 5 campos de personalización por usuario:
   *   idtalonario, idvendedor, idpersona, idplanventa, idcondicion.
   */
  listarPorUsuario: (iduser) =>
    query(
      'server',
      `SELECT idtipomovimiento, permiso, permiso_varios,
              idtalonario, idvendedor, idpersona, idplanventa, idcondicion
         FROM usuario_concepto
        WHERE UPPER(iduser) = UPPER(?)
        ORDER BY idtipomovimiento`,
      [iduser],
    ).catch(() => []),

  /**
   * Upsert masivo en una sola transacción.
   * Los 5 campos extra son opcionales: si vienen como `undefined` se preservan
   * (no se incluyen en el UPDATE / se insertan como NULL).
   * @param {string} iduser
   * @param {Array<{idtipomovimiento:number, permiso:number, permisoVarios:string,
   *                idtalonario?:number|null, idvendedor?:number|null,
   *                idpersona?:number|null, idplanventa?:number|null,
   *                idcondicion?:number|null}>} items
   */
  upsertBatch: (iduser, items) =>
    transaction('server', async (tx) => {
      const EXTRA_COLS = ['idtalonario', 'idvendedor', 'idpersona', 'idplanventa', 'idcondicion'];
      for (const item of items) {
        const { idtipomovimiento, permiso, permisoVarios } = item;
        const existe = await tx.query(
          `SELECT FIRST 1 iduser FROM usuario_concepto
            WHERE UPPER(iduser) = UPPER(?) AND idtipomovimiento = ?`,
          [iduser, idtipomovimiento],
        );

        // Construir SET dinámico: solo incluir los campos extra que vienen definidos
        const extraSets = [];
        const extraVals = [];
        for (const col of EXTRA_COLS) {
          if (item[col] !== undefined) {
            extraSets.push(`${col} = ?`);
            extraVals.push(item[col]);
          }
        }

        if (existe.length) {
          await tx.query(
            `UPDATE usuario_concepto
                SET permiso = ?, permiso_varios = ?${extraSets.length ? ', ' + extraSets.join(', ') : ''}
              WHERE UPPER(iduser) = UPPER(?) AND idtipomovimiento = ?`,
            [permiso, permisoVarios, ...extraVals, iduser, idtipomovimiento],
          );
        } else {
          // INSERT: usar NULL para los extras no provistos
          const valoresExtras = EXTRA_COLS.map((col) =>
            item[col] !== undefined ? item[col] : null,
          );
          await tx.query(
            `INSERT INTO usuario_concepto
               (iduser, idtipomovimiento, permiso, permiso_varios,
                idtalonario, idvendedor, idpersona, idplanventa, idcondicion)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [iduser, idtipomovimiento, permiso, permisoVarios, ...valoresExtras],
          );
        }
      }
      return items.length;
    }),
};

module.exports = ConceptoModel;
