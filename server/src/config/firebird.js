'use strict';

const Firebird = require('node-firebird');
const env = require('./env');
const logger = require('../utils/logger');

const POOL_SIZE = 10;

function buildOptions(prefix) {
  return {
    host: env[`${prefix}_HOST`],
    port: env[`${prefix}_PORT`],
    database: env[`${prefix}_DATABASE`],
    user: env[`${prefix}_USER`],
    password: env[`${prefix}_PASSWORD`],
    lowercase_keys: true,
    role: null,
    pageSize: 4096,
    encoding: env[`${prefix}_CHARSET`] || 'NONE',
  };
}

const pools = {
  system: Firebird.pool(POOL_SIZE, buildOptions('SYSTEM')),
  server: Firebird.pool(POOL_SIZE, buildOptions('SERVER')),
};

// El pool MASTER se inicializa sólo si las variables están definidas.
if (env.MASTER_HOST && env.MASTER_DATABASE) {
  pools.master = Firebird.pool(POOL_SIZE, buildOptions('MASTER'));
}

/**
 * Obtiene una conexión del pool (system|server).
 */
function getConnection(scope = 'system') {
  return new Promise((resolve, reject) => {
    const pool = pools[scope];
    if (!pool) return reject(new Error(`Pool desconocido: ${scope}`));
    pool.get((err, db) => (err ? reject(err) : resolve(db)));
  });
}

/**
 * Ejecuta una consulta y devuelve filas. Cierra (devuelve al pool) automáticamente.
 */
async function query(scope, sql, params = []) {
  const db = await getConnection(scope);
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => {
      db.detach();
      if (err) {
        logger.error({ err, sql }, 'Firebird query error');
        return reject(err);
      }
      resolve(rows || []);
    });
  });
}

/**
 * Ejecuta varias sentencias en una única transacción explícita.
 * @param {'system'|'server'} scope
 * @param {(tx: {query: Function}) => Promise<any>} work
 */
async function transaction(scope, work) {
  const db = await getConnection(scope);
  return new Promise((resolve, reject) => {
    db.transaction(Firebird.ISOLATION_READ_COMMITTED, async (err, tx) => {
      if (err) {
        db.detach();
        return reject(err);
      }
      const txWrapper = {
        query: (sql, params = []) =>
          new Promise((res, rej) =>
            tx.query(sql, params, (e, rows) => (e ? rej(e) : res(rows || []))),
          ),
      };
      try {
        const result = await work(txWrapper);
        tx.commit((cErr) => {
          db.detach();
          if (cErr) return reject(cErr);
          resolve(result);
        });
      } catch (workErr) {
        tx.rollback(() => db.detach());
        reject(workErr);
      }
    });
  });
}

function shutdown() {
  Object.values(pools).forEach((p) => p && p.destroy && p.destroy());
}

module.exports = { getConnection, query, transaction, shutdown };
