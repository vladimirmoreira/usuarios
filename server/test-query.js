'use strict';
require('dotenv').config();
const { query } = require('./src/config/firebird');

query('system',
  "SELECT FIRST 20 idmenu, titulo FROM menu_general WHERE UPPER(TRIM(iduser)) = 'ADMIN' AND idempresa = '1' ORDER BY idmenu_principal",
  []
).then(r => {
  console.log('Menu rows:', r.length);
  r.forEach(x => console.log(` ${x.idmenu}: ${x.titulo}`));
}).catch(e => console.error('ERR:', e.message));
