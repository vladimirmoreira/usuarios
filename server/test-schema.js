'use strict';
require('dotenv').config();
const { query } = require('./src/config/firebird');

async function main() {
  const tablas = [
    { scope: 'server', tabla: 'CONFIGURACION_USUARIO' },
    { scope: 'system', tabla: 'TIPO_USUARIO' },
    { scope: 'system', tabla: 'USUARIO' },
  ];

  for (const { scope, tabla } of tablas) {
    try {
      const rows = await query(scope,
        `SELECT r.RDB$FIELD_NAME, r.RDB$FIELD_POSITION
           FROM RDB$RELATION_FIELDS r
          WHERE TRIM(r.RDB$RELATION_NAME) = ?
          ORDER BY r.RDB$FIELD_POSITION`,
        [tabla]
      );
      console.log(`\n=== ${scope}.${tabla} ===`);
      rows.forEach(r => console.log(`  ${r['rdb$field_position']}: ${r['rdb$field_name'].trim()}`));
    } catch (e) {
      console.error(`ERROR ${scope}.${tabla}: ${e.message}`);
    }
  }
  process.exit(0);
}

main();
