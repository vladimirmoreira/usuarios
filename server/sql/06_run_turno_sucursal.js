'use strict';
/**
 * Crea la tabla USUARIO_TURNO_SUCURSAL y su generador en la BD SERVER.
 * Usa executeImmediate para DDL en dialectos 1.
 */
const Firebird = require('node-firebird');
const env      = require('../src/config/env');

const opts = {
  host:           env.SERVER_HOST,
  port:           env.SERVER_PORT,
  database:       env.SERVER_DATABASE,
  user:           env.SERVER_USER,
  password:       env.SERVER_PASSWORD,
  lowercase_keys: true,
  role:           null,
  pageSize:       4096,
};

const DDL = [
  `CREATE TABLE USUARIO_TURNO_SUCURSAL (
     ID         INTEGER     NOT NULL,
     IDUSER     VARCHAR(10) NOT NULL,
     IDSUCURSAL INTEGER     NOT NULL,
     FECHA      VARCHAR(10) NOT NULL,
     CONSTRAINT PK_UTS PRIMARY KEY (ID)
  )`,
  `CREATE GENERATOR GEN_USUARIO_TURNO_SUCURSAL`,
  `SET GENERATOR GEN_USUARIO_TURNO_SUCURSAL TO 0`,
  `CREATE INDEX IDX_UTS_USER_FECHA ON USUARIO_TURNO_SUCURSAL (IDUSER, FECHA)`,
];

Firebird.attach(opts, (attachErr, db) => {
  if (attachErr) {
    console.error('Error al conectar:', attachErr.message);
    process.exit(1);
  }

  let idx = 0;

  function next() {
    if (idx >= DDL.length) {
      console.log('Migración completada.');
      db.detach(() => process.exit(0));
      return;
    }
    const sql = DDL[idx++];
    const short = sql.replace(/\s+/g, ' ').slice(0, 70);

    db.execute(sql, [], (err) => {
      if (err) {
        const msg = err.message || String(err);
        if (/already exists|duplicate name/i.test(msg)) {
          console.warn(`  WARN [server] ${short}  ->  ya existe`);
          next();
        } else {
          console.error(`  FAIL [server] ${short}\n       ${msg}`);
          db.detach(() => process.exit(1));
        }
      } else {
        console.log(`  OK   [server] ${short}`);
        next();
      }
    });
  }

  next();
});
