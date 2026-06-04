const {query}=require('./src/config/firebird');
const sql = 'SELECT RDB$RELATION_NAME FROM RDB$RELATIONS WHERE RDB$SYSTEM_FLAG=0 ORDER BY 1';
query('server', sql).then(r=>r.forEach(x=>console.log(Object.values(x)[0]))).catch(e=>console.error(e.message)).finally(()=>process.exit());
