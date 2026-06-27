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
 * Mapper de filas (node-firebird conecta como NONE sobre BD ASCII):
 *   - BLOB        → función (stream) → se lee vía emitter (texto utf8).
 *   - OCTETS      → Buffer           → se decodifica latin1 (acentos/ñ legacy).
 *   - resto       → tal cual.
 * Las columnas de texto se castean a OCTETS en el SQL para evitar el error
 * "Cannot transliterate"; acá se reconstruye el string.
 */
function readBlob(blobFn) {
  return new Promise((resolve) => {
    try {
      blobFn((err, _name, emitter) => {
        if (err) return resolve('');
        const chunks = [];
        emitter.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
        emitter.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        emitter.on('error', () => resolve(''));
      });
    } catch { resolve(''); }
  });
}

async function resolveRow(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (typeof v === 'function')      out[k] = await readBlob(v);
    else if (Buffer.isBuffer(v))      out[k] = v.toString('latin1').replace(/ +$/g, '');
    else                              out[k] = v;
  }
  return out;
}

async function mapRows(rows) {
  const arr = Array.isArray(rows) ? rows : (rows ? [rows] : []);
  const out = [];
  for (const row of arr) out.push(await resolveRow(row));
  return out;
}

/**
 * Ejecuta una consulta y devuelve filas. Cierra (devuelve al pool) automáticamente.
 */
async function query(scope, sql, params = []) {
  const db = await getConnection(scope);
  return new Promise((resolve, reject) => {
    db.query(sql, params, async (err, rows) => {
      if (err) {
        db.detach();
        logger.error({ err, sql }, 'Firebird query error');
        return reject(err);
      }
      try {
        const out = await mapRows(rows);
        db.detach();
        resolve(out);
      } catch (e) {
        db.detach();
        reject(e);
      }
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
            tx.query(sql, params, async (e, rows) => {
              if (e) return rej(e);
              try { res(await mapRows(rows)); } catch (er) { rej(er); }
            }),
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

/**
 * Lee un BLOB **binario crudo** (imágenes/archivos) sin pasar por el mapper de texto.
 * Devuelve el Buffer del primer campo BLOB de la primera fila, o null.
 * Usar para datos binarios (p. ej. USUARIO.FOTO); NO usar query() porque decodifica a texto.
 */
function readBinaryBlob(scope, sql, params = []) {
  return new Promise((resolve, reject) => {
    getConnection(scope)
      .then((db) => {
        db.query(sql, params, (err, rows) => {
          if (err) { db.detach(); return reject(err); }
          const arr = Array.isArray(rows) ? rows : (rows ? [rows] : []);
          if (!arr.length) { db.detach(); return resolve(null); }
          const blob = Object.values(arr[0]).find((v) => typeof v === 'function');
          if (typeof blob !== 'function') { db.detach(); return resolve(null); }
          const chunks = [];
          blob((be, _bn, em) => {
            if (be) { db.detach(); return resolve(null); }
            em.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
            em.on('end', () => { db.detach(); resolve(Buffer.concat(chunks)); });
            em.on('error', () => { db.detach(); resolve(null); });
          });
        });
      })
      .catch(reject);
  });
}

function shutdown() {
  Object.values(pools).forEach((p) => p && p.destroy && p.destroy());
}

module.exports = { getConnection, query, transaction, readBinaryBlob, shutdown };
