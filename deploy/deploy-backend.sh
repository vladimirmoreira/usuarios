#!/bin/bash
set -e
mkdir -p /opt/usuarios
rm -rf /opt/usuarios/server
cp -r /tmp/usuarios-deploy/server /opt/usuarios/server
cd /opt/usuarios/server
cp /tmp/usuarios-deploy/env.production.server .env
S1=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
S2=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$S1|" .env
sed -i "s|^JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=$S2|" .env
echo "=== npm install ==="
npm install --omit=dev --no-audit --no-fund 2>&1 | tail -6
echo "=== pm2 (re)start ==="
pm2 delete usuarios-api >/dev/null 2>&1 || true
pm2 start src/server.js --name usuarios-api --time
pm2 save >/dev/null
pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true
pm2 save >/dev/null
sleep 2
echo "=== pm2 list ==="
pm2 list
echo "=== backend health (127.0.0.1:10024/health) ==="
curl -s -m 8 http://127.0.0.1:10024/health; echo
echo "=== LOGIN e2e via nginx (10025 -> /api/auth/login) ==="
curl -s -m 12 -o /tmp/login_resp.txt -w "HTTP %{http_code}\n" -X POST http://127.0.0.1:10025/api/auth/login -H "Content-Type: application/json" -d '{"iduser":"AFRANCO","pass":"2149259"}'
echo "resp (recortado):"; head -c 300 /tmp/login_resp.txt; echo
echo "=== DONE ==="
