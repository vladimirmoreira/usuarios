#!/bin/bash
cd /opt/usuarios/server
pm2 restart usuarios-api --update-env >/dev/null 2>&1
sleep 2
printf '%s' '{"iduser":"AFRANCO","pass":"2149259"}' > /tmp/a.json
printf '%s' '{"iduser":"Admin","pass":"xx"}' > /tmp/b.json
echo -n 'AFRANCO (valido) -> '; curl -sk -m 12 -o /dev/null -w '%{http_code}\n' -X POST https://127.0.0.1:10025/api/auth/login -H 'Content-Type: application/json' --data @/tmp/a.json
echo -n 'Admin (empresa 26, sin gate) -> '; curl -sk -m 12 -o /dev/null -w '%{http_code}\n' -X POST https://127.0.0.1:10025/api/auth/login -H 'Content-Type: application/json' --data @/tmp/b.json
rm -f /tmp/a.json /tmp/b.json
echo "--- err log reciente ---"
pm2 logs usuarios-api --err --lines 5 --nostream 2>/dev/null | tail -6
echo DONE
