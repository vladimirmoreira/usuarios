# Despliegue Usuarios — producción (servidor 192.168.0.200)

**Acceso:** SSH/SCP por el host público en el puerto **2022**
(`d43b0e3c7530.sn.mynetname.net:2022`). La IP LAN `192.168.0.200` no es alcanzable desde afuera.
Reemplazá `USUARIO` por tu usuario SSH real.

**Paquete ya generado (local):** `usuarios-deploy.zip` contiene:
- `frontend-dist/` → build estático del cliente (API embebida como `/api`)
- `server/` → backend Node sin `node_modules`
- `nginx-usuarios.conf`, `env.production.server`

---

## 0) Subir el paquete

```powershell
# Desde Windows (PowerShell), en C:\Users\hp\Documents\DESARROLLOS\Usuarios
scp -P 2022 .\usuarios-deploy.zip USUARIO@d43b0e3c7530.sn.mynetname.net:/tmp/
```

En el servidor:
```bash
ssh -p 2022 USUARIO@d43b0e3c7530.sn.mynetname.net
cd /tmp && rm -rf usuarios-deploy && unzip -o usuarios-deploy.zip -d usuarios-deploy
```

---

## 1) Frontend → /opt/nginx/usuarios

```bash
sudo mkdir -p /opt/nginx/usuarios
sudo cp -r /tmp/usuarios-deploy/frontend-dist/* /opt/nginx/usuarios/

# Permisos para el worker de nginx
sudo chmod 755 /opt /opt/nginx /opt/nginx/usuarios
sudo find /opt/nginx/usuarios -type d -exec chmod 755 {} \;
sudo find /opt/nginx/usuarios -type f -exec chmod 644 {} \;
# (opcional) sudo chown -R nginx:nginx /opt/nginx/usuarios
```

## 2) nginx (sitio :10025 + proxy /api → 10024)

```bash
sudo cp /tmp/usuarios-deploy/nginx-usuarios.conf /etc/nginx/conf.d/usuarios.conf
sudo nginx -t && sudo systemctl reload nginx
```

## 3) Backend Node → /opt/usuarios/server

```bash
sudo mkdir -p /opt/usuarios
sudo cp -r /tmp/usuarios-deploy/server /opt/usuarios/server
cd /opt/usuarios/server

# .env de producción (revisar secretos JWT y datos de Firebird)
sudo cp /tmp/usuarios-deploy/env.production.server .env
sudo nano .env        # CAMBIAR JWT_SECRET / JWT_REFRESH_SECRET; confirmar DBs/charset

# Dependencias (Node 20+; ya viene del setup del sistema)
npm install --omit=dev

# Arranque persistente con pm2
sudo npm i -g pm2      # si no está
pm2 start src/server.js --name usuarios-api
pm2 save
pm2 startup            # seguir la instrucción que imprime, para arranque en boot
```

Alternativa sin pm2 (systemd o prueba rápida):
```bash
PORT=10024 node src/server.js   # prueba en foreground
```

---

## 4) Verificación

```bash
# Backend responde local
curl -s http://127.0.0.1:10024/api/health

# A través de nginx (mismo origen)
curl -s http://127.0.0.1:10025/api/health
```

En el navegador: `http://192.168.0.200:10025/`
Login de prueba (usuarios con `mnuArchivoPanelControl` permiso=1, empresa 1):
- **AFRANCO** / `2149259`
- **JTORRES** / `2802`

> Recordá que el gate de login exige el menú `mnuArchivoPanelControl` (permiso=1) en
> `menu_general` para la empresa 1. Usuarios sin ese permiso reciben 403 "No tiene acceso al módulo".

---

## Notas
- Firebird es **local** al servidor → `SYSTEM/SERVER/MASTER_HOST=127.0.0.1`.
- `orgonita_system` es **CHARACTER SET ASCII**; el login usa casts a OCTETS. Si alguna
  pantalla puntual diera "Cannot transliterate", se corrige ese query con el mismo patrón.
- Re-deploy del frontend: recompilar local (`npm run build`) y repetir pasos 0–1.
- Re-deploy del backend: re-subir `server/` y `pm2 restart usuarios-api`.
