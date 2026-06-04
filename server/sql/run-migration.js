'use strict';

/**
 * Runner sencillo para aplicar migraciones DDL/DML contra las BDs configuradas en .env.
 * Uso:  node sql/run-migration.js <archivo.sql>
 *
 * Convenci\u00f3n del archivo .sql:
 *   - Las sentencias se delimitan con ';' al final de l\u00ednea.
 *   - Cada bloque se ejecuta contra el pool indicado por un comentario:
 *         -- [system] | [server] | [master]
 *     Permanece vigente hasta el siguiente comentario de scope.
 *   - L\u00edneas en blanco y comentarios '--' se ignoran.
 *
 * Las sentencias que fallen por "ya existe" (columna/tabla) se reportan como WARN y siguen.
 */

const fs = require('fs');
const path = require('path');
const { getConnection } = require('../src/config/firebird');

const file = process.argv[2];
if (!file) {
  console.error('Uso: node sql/run-migration.js <archivo.sql>');
  process.exit(1);
}

const full = path.isAbsolute(file) ? file : path.join(__dirname, file);
const raw = fs.readFileSync(full, 'utf8');

// Parser: separa por scope y sentencias.
const lines = raw.split(/\r?\n/);
const blocks = []; // [{ scope, sql }]
let scope = 'system';
let buffer = '';

for (const lineRaw of lines) {
  const line = lineRaw.trim();
  const scopeMatch = line.match(/^--\s*\[(system|server|master)\]/i);
  if (scopeMatch) {
    scope = scopeMatch[1].toLowerCase();
    continue;
  }
  if (line.startsWith('--') || line === '') continue;
  buffer += ' ' + lineRaw;
  if (line.endsWith(';')) {
    const sql = buffer.replace(/;\s*$/, '').trim();
    if (sql) blocks.push({ scope, sql });
    buffer = '';
  }
}

function run(scope, sql) {
  return new Promise((resolve, reject) => {
    getConnection(scope)
      .then((db) => {
        db.query(sql, [], (err) => {
          db.detach();
          if (err) return reject(err);
          resolve();
        });
      })
      .catch(reject);
  });
}

(async () => {
  let okCount = 0;
  let warnCount = 0;
  for (const { scope, sql } of blocks) {
    const short = sql.replace(/\s+/g, ' ').slice(0, 80);
    try {
      await run(scope, sql);
      okCount++;
      console.log(`  OK   [${scope}] ${short}`);
    } catch (err) {
      const msg = (err && err.message) || String(err);
      // Tolerar "ya existe"
      if (/already exists|attempt to store duplicate value|duplicate name/i.test(msg)) {
        warnCount++;
        console.warn(`  WARN [${scope}] ${short}  ->  ${msg.split('\n')[0]}`);
      } else {
        console.error(`  FAIL [${scope}] ${short}\n         ${msg}`);
        process.exitCode = 1;
        break;
      }
    }
  }
  console.log(`\nResultado: ${okCount} OK, ${warnCount} ya existentes.`);
  // node-firebird mantiene los pools abiertos: forzamos salida.
  setTimeout(() => process.exit(process.exitCode || 0), 200);
})();
