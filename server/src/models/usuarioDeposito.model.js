'use strict';

const { query, transaction } = require('../config/firebird');

/**
 * USUARIO_DEPOSITO  (iduser, iddeposito, orden) — DEPÓSITO de SALIDA.
 * USUARIO_DEPOSITO1 (iduser, iddeposito, orden) — DEPÓSITO de ENTRADA.
 * Ninguna tiene PK en el legacy. Patrón: DELETE all + INSERT.
 *
 * Regla de negocio (salida):
 *   Solo se insertan depósitos cuya sucursal esté marcada como habilitada
 *   para el usuario. La verificación se hace contra USUARIO_SUCURSAL en la
 *   misma transacción.
 *
 * Entrada: sin restricción — el receptor puede pertenecer a otra sucursal.
 */
const UsuarioDepositoModel = {
  listarPorUsuario: async (iduser) => {
    const [salida, entrada] = await Promise.all([
      query(
        'server',
        `SELECT iddeposito, orden FROM usuario_deposito
          WHERE UPPER(iduser) = UPPER(?)
          ORDER BY orden, iddeposito`,
        [iduser],
      ).catch(() => []),
      query(
        'server',
        `SELECT iddeposito, orden FROM usuario_deposito1
          WHERE UPPER(iduser) = UPPER(?)
          ORDER BY orden, iddeposito`,
        [iduser],
      ).catch(() => []),
    ]);
    return { salida, entrada };
  },

  /**
   * Reemplaza por completo ambos depósitos del usuario.
   * @param {string} iduser
   * @param {{ salida: Array<{iddeposito:number, orden:number}>,
   *           entrada: Array<{iddeposito:number, orden:number}> }} payload
   * @returns {Promise<{salida:number, entrada:number, salidaDescartados:number[]}>}
   *   salidaDescartados: depósitos de salida ignorados por no tener su sucursal habilitada.
   */
  replaceAll: (iduser, { salida = [], entrada = [] }) =>
    transaction('server', async (tx) => {
      // Resolver sucursales habilitadas para el usuario (en la misma TX).
      const sucs = await tx.query(
        `SELECT idsucursal FROM usuario_sucursal WHERE UPPER(iduser) = UPPER(?)`,
        [iduser],
      );
      const sucursalesHabilitadas = new Set(sucs.map((r) => Number(r.idsucursal)));

      // Resolver mapa iddeposito -> idsucursal (catálogo).
      const idsSalida = salida.map((d) => Number(d.iddeposito));
      let mapDepSuc = new Map();
      if (idsSalida.length) {
        const placeholders = idsSalida.map(() => '?').join(',');
        const deps = await tx.query(
          `SELECT iddeposito, idsucursal FROM deposito WHERE iddeposito IN (${placeholders})`,
          idsSalida,
        );
        mapDepSuc = new Map(deps.map((d) => [Number(d.iddeposito), Number(d.idsucursal)]));
      }

      const salidaValida = [];
      const salidaDescartados = [];
      for (const d of salida) {
        const idsuc = mapDepSuc.get(Number(d.iddeposito));
        if (idsuc != null && sucursalesHabilitadas.has(idsuc)) {
          salidaValida.push(d);
        } else {
          salidaDescartados.push(Number(d.iddeposito));
        }
      }

      // SALIDA: USUARIO_DEPOSITO
      await tx.query(
        `DELETE FROM usuario_deposito WHERE UPPER(iduser) = UPPER(?)`,
        [iduser],
      );
      for (const { iddeposito, orden } of salidaValida) {
        await tx.query(
          `INSERT INTO usuario_deposito (iduser, iddeposito, orden) VALUES (?, ?, ?)`,
          [iduser, iddeposito, orden ?? 0],
        );
      }

      // ENTRADA: USUARIO_DEPOSITO1 (sin restricción)
      await tx.query(
        `DELETE FROM usuario_deposito1 WHERE UPPER(iduser) = UPPER(?)`,
        [iduser],
      );
      for (const { iddeposito, orden } of entrada) {
        await tx.query(
          `INSERT INTO usuario_deposito1 (iduser, iddeposito, orden) VALUES (?, ?, ?)`,
          [iduser, iddeposito, orden ?? 0],
        );
      }

      return {
        salida: salidaValida.length,
        entrada: entrada.length,
        salidaDescartados,
      };
    }),
};

module.exports = UsuarioDepositoModel;
