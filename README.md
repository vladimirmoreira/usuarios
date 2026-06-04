# Módulo Usuarios — Plataforma de Administración

> Refactorización moderna del formulario `frm_principal` / **Menú de Accesos** del sistema legado (Delphi/WinForms sobre Firebird) hacia un stack **Node.js + Express + React/TypeScript**, arquitectura **MVC**, autenticación **JWT** y codificación **UTF‑8** end‑to‑end.

Última actualización: **31‑05‑2026** (sesión 6).

---

## 1. Resumen ejecutivo

El módulo administra el ciclo de vida completo de los **usuarios** y sus **accesos** distribuidos en múltiples ejes, replicando 1‑a‑1 la lógica de negocio del sistema legado pero con una capa de UI/UX moderna, API REST tipada y validación exhaustiva.

### 1.1 Funcionalidades implementadas

| # | Módulo | Estado | Descripción |
|---|---|---|---|
| 1 | **Login / JWT** | ✅ | Access (15 min) + refresh (7 d), guard de rutas, claims `iduser/idperfil/idempresa`. Audita éxitos (op 12) y fallos (op 13) en `HISTORIAL_USUARIO`. |
| 2 | **Usuarios — CRUD** | ✅ | Alta (SP `PCD_USUARIO`), baja lógica, edición, sugerencia de `iduser`, validación de documento. |
| 3 | **Usuarios — Operaciones** | ✅ | Reset clave, reasignar sucursal, cambiar perfil — todas vía `PCD_OPERACIONES` (auditadas). |
| 4 | **Usuarios — DataGrid** | ✅ | Buscador, filtros por columna (perfil, estado, texto libre), selección naranja, accesos directos. Filtro rápido **Sin documento** con toggle en toolbar. Barra de leyenda de badges siempre visible. |
| 5 | **Usuarios — Badges informativos** | ✅ | `Database` (violeta) = replica a BD Master · `AlertTriangle` ámbar = sin menús configurados · `AlertTriangle` azul = sin documento · `Sliders` ámbar = permisos personalizados (excluido de última propagación). |
| 6 | **Usuarios — Complemento** | ✅ | `modo_print`, `talonario`, `descuento` opcionales por usuario. |
| 7 | **Usuarios — Historial** | ✅ | Modal paginado (25/50/100 filas) con navegación `«/»` y descripción de operaciones desde `HISTORIAL_USUARIO` JOIN `TIPO_OPERACION`. |
| 8 | **Usuarios — Export CSV** | ✅ | Descarga `usuarios_YYYY-MM-DD.csv` (BOM UTF-8, separador `;`) con los mismos filtros de la grilla, incluyendo columna `perfil`. Requiere autorización. |
| 9 | **Usuarios — Inactividad** | ✅ | Detección de cuentas sin actividad en `REGISTRO` (BD server) según umbral configurable. Vista dedicada con selección múltiple, inhabilitación unitaria y por lote (máx 100). |
| 10 | **Usuarios — Sucursal actual** | ✅ | `EditarUsuarioModal` muestra sucursal principal (orden 1) en campo solo-lectura, cargada lazy. Texto hint orienta al botón de reasignación. |
| 11 | **Usuarios — Reasignación de Sucursal + Calendario** | ✅ | `ReasignarSucursalModal` con dos secciones: (a) **Reasignar ahora** (efecto inmediato con auditoría OP.5); (b) **Calendario mensual** con tres modos de selección (Día / Rango / Semanal), paleta de 8 colores por sucursal, clic derecho para quitar, **Limpiar mes** (vacía todo el mes de un click), **Copiar al siguiente mes** (replica asignaciones preservando días válidos). |
| 12 | **Roles / Perfiles** | ✅ | CRUD de `TIPO_USUARIO` + edición de plantilla compartiendo el editor de Accesos. Badge `Database` en roles con flag `MASTER=1`. |
| 13 | **Roles — Propagación de permisos** | ✅ | `PropagateRolModal` con checkboxes individuales por usuario, pre-marcado de excluidos (`exclusion_permisos=1`). Se auto-dispara tras cada guardado exitoso en `RoleAccesosPage`. Procesamiento tolerante a fallos: errores por usuario se acumulan (no abortan el resto). Usuarios **sin documento** se procesan parcialmente (menus/permisos copiados, `exclusion_permisos` omitido por constraint Firebird) y se informan en panel ámbar separado. |
| 14 | **Accesos — Menú Gestión** | ✅ | `MENU_GENERAL` jerárquico con flag `PERMISO 0/1`. |
| 15 | **Accesos — Permisos Generales** | ✅ | `USUARIOEMPRESA.PERMISOS` (string S/N de 50 posiciones). |
| 16 | **Accesos — Movimientos** | ✅ | `USUARIOEMPRESA.MOVIMIENTOS` (string S/N) + sincronización con `mnuAdmMovimientos{N}`. |
| 17 | **Accesos — Conceptos** | ✅ | `USUARIO_CONCEPTO` por tipo de movimiento: permiso + `permiso_varios` (15 chars). |
| 18 | **Accesos — Personalización por usuario** | ✅ | 5 overrides en `USUARIO_CONCEPTO`: talonario, vendedor, persona, planventa, condición. |
| 19 | **Accesos — Punto de Venta** | ✅ | `USUARIOEMPRESA.MENU_GG_2` + catálogo `TMP$USUARIO_PERMISOS_PDV`. |
| 20 | **Accesos — Contab. / RRHH** | ✅ | `USUARIOEMPRESA.PERMISO_GG` por módulo con sub‑permisos. |
| 21 | **Accesos — Sucursales** | ✅ | `USUARIO_SUCURSAL` (DELETE+INSERT, sin PK en legacy). |
| 22 | **Accesos — Depósitos** | ✅ | `USUARIO_DEPOSITO` (salida) + `USUARIO_DEPOSITO1` (entrada). |
| 23 | **Accesos — Dirty detection real** | ✅ | `AccesosEditor` usa snapshots `JSON.stringify` vía `useRef` para detectar cambios reales. No genera falsos positivos al navegar entre pestañas sin modificar datos. |
| 24 | **Catálogos públicos** | ✅ | Perfiles, sucursales, depósitos, talonarios, vendedores, planventas, condiciones, operaciones. |
| 25 | **Catálogo de operaciones** | ✅ | `GET /api/catalogos/operaciones` — devuelve el catálogo declarativo con descripción de efectos y BD afectada por operación. Consumido en modal "¿Qué ocurre?". |
| 26 | **Configuración del entorno** | ✅ | `CONFIGURACION_USUARIO` por IP (admite `localhost`), flag `AUTORIZADO/MASTER`, umbral de inactividad `DIAS_INACTIVIDAD` (default 90). |
| 27 | **Auditoría — Viewer global** | ✅ | Módulo dedicado `GET /auditoria` con datagrid paginado (server-side) sobre `HISTORIAL_USUARIO`. Filtros: usuario (CONTAINING), operación (combo 13 tipos), autorización, rango de fechas. Ordenación por cualquier columna. Exportación CSV página actual + CSV todos (máx. 5 000 filas). Botón Imprimir/PDF via `window.print()`. |
| 27b | **Reportes — Ficha Usuario** | ✅ | Informe completo de un usuario: datos básicos, sucursales, depósitos, complemento, vínculos (legajo RH + mesero GG), permisos chips, menú habilitado, conceptos por tipo, historial reciente (25 filas). Botón Imprimir/PDF. |
| 27c | **Reportes — Ficha Rol** | ✅ | Informe completo de un rol/perfil: datos básicos, permisos/movimientos/PDV/GG chips, menú, conceptos, usuarios asignados (con badge de exclusión). Reutiliza helpers de `FichaUsuarioReporte`. |
| 28 | **Job cron — Inactividad** | ✅ | Escaneo automático de inactividad (lunes 06:00). Solo registra candidatos en log; no inhabilita automáticamente. Controlado por `ENABLE_INACTIVIDAD_JOB=1`. |
| 29 | **Job cron — Calendario de sucursal** | ✅ | Aplica diariamente (04:00 AM por defecto) las asignaciones programadas en `USUARIO_TURNO_SUCURSAL`. Verifica estado activo del usuario **en tiempo de ejecución** (BD system) — usuarios dados de baja a mitad de mes son omitidos aunque tengan días en el calendario. Llama `OperacionesService.reasignarSucursal()` (incluye GG_MESERO + auditoría OP.5). Configurable con `ENABLE_TURNO_SUCURSAL_JOB=1` / `TURNO_SUCURSAL_CRON`. |
| 30 | **Importación masiva** | ✅ | CSV/TSV/TXT (separador auto: TAB/`;`/`,`), cabecera opcional, hasta 200 filas. Pre-validación cliente (duplicados de documento, campos vacíos). Validación server (perfil habilitado+plantilla, documento único, sucursal activa). Alta atómica — un solo `TRANSACTION` system: si falla cualquier fila, ROLLBACK de todo el lote. Errores detallan tabla exacta (`[USUARIO]`, `[MENU_GENERAL]`, etc.). TXT de errores en Escritorio. Post-effects (legajo, gastronomía, masterSync, auditoría) fuera de la tx en best-effort. |
| 31 | **Legajos** | 🟡 pendiente | Datos de RRHH del usuario (vinculación con `LEGAJO`). |
| 32 | **Biometría** | 🟡 pendiente | Captura/enrollment huella + sincronización dispositivos. |
| 33 | **Tests E2E** | 🟡 pendiente | Playwright cubriendo flujos críticos. |

### 1.2 Mejoras frente al sistema original

- **UI minimalista, densa y responsive** (React + Tailwind), reemplazando el WinForms con grillas compactas tipo legado pero con tipografía consistente.
- **Capa de servicio** que oculta los strings posicionales (`S/N`, `0/1`) y expone JSON tipado.
- **JWT** en lugar de sesiones Firebird directas.
- **Transacciones explícitas** desde Node (`node-firebird`) en vez de `AUTONOMOUS TRANSACTION` anidadas dentro de SPs.
- **Validación Zod** simétrica en cliente y servidor; errores normalizados.
- **Multi-cliente / multi-empresa** vía `.env` (un par de BDs `system` + `server` por instalación).
- **Auditoría completa** de login y todas las operaciones en `HISTORIAL_USUARIO`.
- **Detección de inactividad** basada en datos reales de `REGISTRO`, con umbral configurable.
- **Export CSV** de usuarios con todos los filtros activos.
- **Calendario de sucursal** con programación mensual, modos Día/Rango/Semanal, paleta visual, copia entre meses y aplicación automática diaria vía cron.
- **Propagación de permisos tolerante a fallos**: errores por usuario individualizados; usuarios sin documento procesados parcialmente sin abortar el resto.
- **Snapshots de dirty detection**: sin falsos positivos en el editor de accesos.
- **Leyenda de badges** permanente en la grilla de usuarios.
- **Módulo Auditoría** con datagrid global de `HISTORIAL_USUARIO`, filtros CONTAINING (Firebird), paginación server-side y exportación CSV doble (página/todos).
- **Módulo Reportes** (Ficha Usuario + Ficha Rol) imprimibles/PDF con todos los accesos, permisos y vínculos.

---

## 2. Arquitectura

```
Usuarios/
├── README.md
├── BaseDatos.txt              # notas de DDL del sistema legado
├── package.json               # monorepo (scripts dev/build)
├── server/                    # API REST (Node 20 + Express 4) — MVC
│   ├── package.json
│   ├── sql/                       # migraciones idempotentes
│   │   ├── run-migration.js       # runner: OK / WARN(duplicado) / FAIL
│   │   ├── 03_login_audit.sql     # pobla TIPO_OPERACION (13 tipos)
│   │   └── 04_inactividad.sql     # DIAS_INACTIVIDAD column + 2 índices REGISTRO
│   └── src/
│       ├── app.js                 # bootstrap Express (helmet, cors, rate-limit)
│       ├── server.js              # listen + arranca job cron
│       ├── config/
│       │   ├── env.js             # carga + valida .env
│       │   ├── firebird.js        # pools system + server + master, helpers query/transaction
│       │   └── operaciones.config.js  # catálogo declarativo de 13 operaciones (fuente de verdad)
│       ├── middlewares/
│       │   ├── auth.js            # verify JWT
│       │   ├── error.js           # handler central
│       │   ├── validate.js        # Zod
│       │   └── requireAuthorized.js   # verifica flag AUTORIZADO en CONFIGURACION_USUARIO
│       ├── jobs/
│       │   ├── inactividad.job.js         # cron lunes 06:00 — solo log
│       │   └── turnoSucursal.job.js       # cron 04:00 — aplica USUARIO_TURNO_SUCURSAL
│       ├── models/                # acceso a datos
│       │   ├── usuario.model.js       # _listar(opts), listar(), exportar()
│       │   ├── operaciones.model.js   # altaCompleta / altaCompletaEnTx / _altaWork (labeled steps)
│       │   ├── inactividad.model.js   # listar(umbralDias?, {idperfilFiltro})
│       │   ├── historial.model.js     # registrar() + listarGlobal(filtros+paginación)
│       │   ├── menu.model.js
│       │   ├── permiso.model.js
│       │   ├── catalogo.model.js
│       │   ├── concepto.model.js
│       │   ├── configuracion.model.js # + umbralInactividad()
│       │   ├── rol.model.js           # listarUsuariosPorRol — usa NOT EXISTS + estado=1
│       │   ├── usuarioSucursal.model.js
│       │   ├── usuarioDeposito.model.js
│       │   └── usuarioTurno.model.js  # listarMes / reemplazarMes (USUARIO_TURNO_SUCURSAL)
│       ├── controllers/
│       │   ├── auth.controller.js         # login + auditoría OP 12/13
│       │   ├── usuario.controller.js      # listar, exportCsv, historial, sucursalPrincipal, turnosMes, guardarTurnosMes
│       │   ├── inactividad.controller.js  # listar, inhabilitar (1 o lote)
│       │   ├── accesos.controller.js
│       │   ├── rol.controller.js          # + listarUsuarios, propagar
│       │   ├── catalogo.controller.js     # + operaciones()
│       │   ├── auditoria.controller.js    # listar global con filtros
│       │   ├── reportes.controller.js     # fichaUsuario + fichaRol
│       │   └── configuracion.controller.js
│       ├── services/
│       │   ├── permisos.service.js    # encode/decode strings posicionales
│       │   ├── operaciones.service.js # altaUsuario / altasBatch / baja / reset / reasignarSucursal
│       │   ├── masterSync.service.js  # sincronización BD master
│       │   ├── accesos.service.js     # obtenerCompleto / guardar / propagarDesdeRol (tolerante a fallos + sin_documento[])
│       │   └── reportes.service.js    # fichaUsuario + fichaRol (paralleliza fetches)
│       ├── routes/
│       │   ├── index.js
│       │   ├── auth.routes.js
│       │   ├── usuario.routes.js      # + /:iduser/sucursal-principal + /:iduser/turnos
│       │   ├── accesos.routes.js
│       │   ├── rol.routes.js          # + /:idperfil/usuarios + /:idperfil/propagar
│       │   ├── catalogo.routes.js
│       │   ├── auditoria.routes.js    # GET /auditoria
│       │   ├── reportes.routes.js     # GET /reportes/usuario/:id + /reportes/rol/:id
│       │   └── configuracion.routes.js
│       └── utils/
│           ├── logger.js          # pino
│           ├── jwt.js
│           └── audit.js           # auditar(req) / auditarDirecto() — best-effort
│
└── client/                    # SPA React 18 + Vite + TS + Tailwind
    ├── package.json
    ├── tailwind.config.js
    ├── vite.config.ts
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx                        # rutas: /usuarios/inactividad añadida
        ├── api/
        │   ├── client.ts                  # axios + interceptor JWT
        │   └── endpoints.ts               # tipos + funciones API (incl. exportCsv, inactividad, historial)
        ├── auth/
        │   └── AuthContext.tsx
        ├── components/
        │   ├── layout/AppLayout.tsx       # nav: UserMinus → /usuarios/inactividad
        │   └── OperacionesInfoModal.tsx   # modal "¿Qué ocurre?" — lista operaciones con badges BD
        ├── features/
        │   ├── login/LoginPage.tsx
        │   ├── usuarios/
        │   │   ├── UsuariosPage.tsx               # botones: Agregar → Importar → Exportar CSV; + ReasignarSucursalModal
        │   │   ├── UsuariosDataGrid.tsx            # filtros columna, barra de leyenda, sin-doc toggle, MapPin, History, Power
        │   │   ├── HistorialUsuarioModal.tsx       # historial paginado
        │   │   ├── InactividadPage.tsx             # detección y gestión de cuentas inactivas
        │   │   ├── ReasignarSucursalModal.tsx      # reasignación inmediata + calendario mensual + copiar mes
        │   │   ├── AgregarUsuarioModal.tsx
        │   │   ├── EditarUsuarioModal.tsx          # muestra sucursal actual (lazy)
        │   │   └── ImportarUsuariosModal.tsx
        │   ├── roles/RolesPage.tsx
        │   ├── auditoria/
        │   │   └── AuditoriaPage.tsx              # datagrid global HISTORIAL_USUARIO + filtros + CSV + print
        │   ├── reportes/
        │   │   ├── ReportesPage.tsx               # selector tipo (usuario/rol) + buscador + imprimir
        │   │   ├── FichaUsuarioReporte.tsx         # informe completo + helpers exportados
        │   │   └── FichaRolReporte.tsx             # informe de rol (reutiliza helpers)
        │   ├── configuracion/ConfiguracionPage.tsx
        │   └── accesos/
        │       ├── AccesosPage.tsx
        │       ├── RoleAccesosPage.tsx             # auto-propaga después de cada guardado exitoso
        │       ├── AccesosEditor.tsx               # snapshot dirty detection; prop onGuardadoExitoso
        │       ├── PropagateRolModal.tsx           # checkboxes por usuario; panel errores; panel sin-documento
        │       └── tabs/
        │           ├── MenuTab.tsx
        │           ├── FlagsTab.tsx
        │           ├── PdvTab.tsx
        │           ├── ConceptosTab.tsx
        │           ├── MasterPanel.tsx
        │           ├── SucursalesTab.tsx
        │           └── DepositosTab.tsx
        └── styles/index.css
```

### 2.1 Flujo de datos

```mermaid
flowchart LR
    UI[React SPA] -- JWT Bearer --> API[Express API]
    API --> SYS[(Firebird: system_*)]
    API --> SRV[(Firebird: server_*)]
    API -.opcional.-> MST[(Firebird: master_*)]
    SYS -.SP PCD_USUARIO.-> SRV
    SRV -.SP PCD_OPERACIONES.-> SYS
    SRV -- REGISTRO --> INV[Inactividad Model]
    SRV -- HISTORIAL_USUARIO --> AUD[Audit / Historial]
    SRV -- USUARIO_TURNO_SUCURSAL --> CRON[turnoSucursal.job]
    CRON --> OP[OperacionesService.reasignarSucursal]
    SYS -- estado=1 check --> CRON
```

### 2.2 Convención clave: rol == usuario plantilla

En el legacy, los roles **son usuarios sintéticos** con un `iduser` propio almacenado en `tipo_usuario.iduser`. Las tablas `usuario_concepto`, `usuario_sucursal`, `usuario_deposito*`, `menu_general`, `usuarioempresa` se llenan tanto para usuarios reales como para roles‑plantilla. El SP `PCD_OPERACIONES idoperacion=6` (cambio de perfil) **replica todos los registros desde la plantilla del rol al usuario** — esto se mantuvo, así "cambiar de perfil" es **Reemplazar todo**.

El componente `AccesosEditor` recibe una prop `scope: 'rol' | 'usuario'` que activa/desactiva la personalización por usuario sin duplicar código.

### 2.3 Exclusión de plantillas de rol en grillas y módulos

Los usuarios que son plantilla de rol se excluyen de:
- `UsuariosDataGrid` (lista general)
- `InactividadPage` (detección de inactividad)
- `exportar()` (CSV)

Filtro triple aplicado en `_listar`:
```sql
COALESCE(u.idtipo_usuario, 0) <> -1                             -- nueva convención
AND u.iduser NOT IN (SELECT iduser FROM tipo_usuario WHERE iduser IS NOT NULL)  -- datos legacy
AND UPPER(TRIM(u.iduser)) <> 'ADMIN'                            -- superusuario reservado
```

---

## 3. Tecnologías

| Capa | Tecnología | Motivo |
|---|---|---|
| Frontend | **React 18 + Vite + TypeScript** | DX rápida, build optimizado, tipado estricto. |
| UI | **Tailwind CSS** + **lucide-react** | Diseño consistente, iconos vectoriales. |
| Estado servidor | **@tanstack/react-query v5** | Cache, invalidaciones, lazy loading por pestaña. |
| Tablas | **@tanstack/react-table** | Grillas virtualizadas con paginación, sort, filtros y drag‑and‑drop de columnas. |
| Notificaciones | **react-hot-toast** | Toasts no bloqueantes. |
| Validación | **Zod v3** | Esquemas compartidos client/server. |
| HTTP | **axios** | Interceptores, manejo de errores, `responseType: 'blob'` para CSV. |
| Backend | **Node.js 20 + Express 4** | Maduro, ecosistema amplio. |
| DB driver | **node-firebird** | Driver puro JS para Firebird 2.5+. |
| Auth | **jsonwebtoken** + bcrypt | JWT HS256 + hash de claves. |
| Logs | **pino** | JSON estructurado, alto rendimiento. |
| Jobs | **node-cron ^3** | Job semanal de detección de inactividad. |
| Lint | **eslint** + **prettier** | Estilo uniforme. |
| Encoding | **UTF‑8** end‑to‑end | Charset Firebird `UTF8`, headers HTTP, BOM en CSV. |

---

## 4. Configuración multi-cliente

Cada instalación se gestiona con un `.env` por backend cambiando los nombres de base.

```env
# server/.env
PORT=3001
NODE_ENV=production
JWT_SECRET=cambiar_por_secreto_largo
JWT_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d
CORS_ORIGIN=http://localhost:5173
DEFAULT_IDEMPRESA=1

# Base 'system' (autenticación + tipo_usuario + menu_general)
SYSTEM_HOST=192.168.0.10
SYSTEM_PORT=3050
SYSTEM_DATABASE=C:/BD/system_empresa1.fdb
SYSTEM_USER=SYSDBA
SYSTEM_PASSWORD=masterkey
SYSTEM_CHARSET=UTF8

# Base 'server' (datos operativos: conceptos, sucursales, depósitos, configuración, historial)
SERVER_HOST=192.168.0.10
SERVER_PORT=3050
SERVER_DATABASE=C:/BD/server_empresa1.fdb
SERVER_USER=SYSDBA
SERVER_PASSWORD=masterkey
SERVER_CHARSET=UTF8

# Base 'master' (replicación Contabilidad/RRHH — opcional)
MASTER_HOST=192.168.0.10
MASTER_PORT=3050
MASTER_DATABASE=C:/BD/master_empresa1.fdb
MASTER_USER=SYSDBA
MASTER_PASSWORD=masterkey
MASTER_CHARSET=WIN1252

# Job de inactividad (opcional — deshabilitado por defecto)
ENABLE_INACTIVIDAD_JOB=1        # omitir o poner 0 para deshabilitar
INACTIVIDAD_CRON=0 6 * * 1      # default: lunes 06:00
TZ=America/Asuncion
```

> **Configuración del entorno** (tabla `CONFIGURACION_USUARIO` en BD `server`): se administra desde la UI; admite `localhost` como IP. Incluye `DIAS_INACTIVIDAD INTEGER DEFAULT 90` para el umbral de inactividad.

---

## 5. Reglas de negocio críticas

### 5.1 Strings posicionales

| Campo | Long. | Codificación |
|---|---|---|
| `USUARIOEMPRESA.PERMISOS` | 50 | `S/N` por posición (Permisos Generales). |
| `USUARIOEMPRESA.MOVIMIENTOS` | 20 | `S/N`; el índice = valor `tipo` en `TIPOMOVIMIENTO`. |
| `USUARIOEMPRESA.PERMISO_GG` | 50 | `S/N` por módulo (contabilidad/RRHH). |
| `USUARIOEMPRESA.MENU_GG_2` | 100 | `S/N` PDV. |
| `USUARIO_CONCEPTO.PERMISO_VARIOS` | 15 | **`'0' = elegido`**, **`'1' = no elegido`** (invertido). |

El **service** `permisos.service.js` expone `decodeSN/encodeSN`, `decode01/encode01`, `decodeConcepto/encodeConcepto`. **Nunca** manipular estos strings desde controladores ni desde el cliente.

### 5.2 Tablas sin PK (DELETE + INSERT obligatorio)

Por herencia del legacy, las siguientes tablas **no tienen primary key** y no pueden actualizarse fila por fila. El patrón es siempre **DELETE all by iduser + INSERT** los nuevos valores, dentro de una sola transacción:

- `USUARIO_CONCEPTO` — actualmente con upsert tolerante (PK lógica `iduser + idtipomovimiento`); migrar a DELETE+INSERT si se reportan inconsistencias.
- `USUARIO_SUCURSAL` — implementado DELETE+INSERT.
- `USUARIO_DEPOSITO` (salida) — implementado DELETE+INSERT.
- `USUARIO_DEPOSITO1` (entrada) — implementado DELETE+INSERT.

### 5.3 Depósito de salida ⇔ sucursal habilitada

Un usuario sólo puede tener un depósito como **salida** si su sucursal correspondiente está marcada como habilitada en `USUARIO_SUCURSAL`. Validación:

- **Cliente**: checkbox bloqueado + banner de advertencia para filas en conflicto.
- **Servidor**: el modelo `usuarioDeposito.replaceAll()` valida en la misma transacción y descarta silenciosamente las filas inválidas, devolviendo `salidaDescartados[]`.

La **entrada** no tiene esta restricción (el receptor puede pertenecer a otra sucursal).

### 5.4 Pestaña Movimientos visible sólo si el menú lo permite

`AccesosEditor` oculta la pestaña Movimientos si `mnuAdminMovimientos` está deshabilitado en Menú Gestión. Al togglear flags de movimientos en `FlagsTab`, se **sincroniza** automáticamente con los items `mnuAdmMovimientos{0..16}` del menú.

### 5.5 Personalización por usuario sobre rol

Cuando `scope === 'usuario'`, la pestaña Movimientos añade dentro de cada concepto expandido un panel ámbar con 5 controles:

| Campo | UI | Catálogo |
|---|---|---|
| `idtalonario` | Select | `talonario WHERE estado='A'` JOIN `sucursal`. |
| `idvendedor` | Select | `vendedor WHERE estado=1`. |
| `idpersona` | Input numérico | (1M+ registros, no select). |
| `idplanventa` | Select | `planventa WHERE estado=1`. |
| `idcondicion` | Select | `condicion WHERE estado=1`. |

En `scope === 'rol'` los 5 campos no se muestran ni se envían — así, guardar permisos a nivel rol **no pisa** la personalización por usuario (el modelo sólo actualiza columnas presentes en el payload).

### 5.6 Inicialización perezosa

- Si un usuario no tiene fila en `usuarioempresa`, se crea con valores en blanco al primer `GET /accesos/:iduser`.
- Si no tiene filas en `menu_general`, se **copia desde Admin** con `permiso=0` (todo bloqueado por defecto).

### 5.7 Inicialización perezosa

Toda alta/baja/cambio operativo (reset clave, reasignación, cambio de perfil) pasa por la función `auditar()` / `auditarDirecto()` en `utils/audit.js`, que llama a `HistorialModel.registrar()` con `idoperacion` de `operaciones.config.js`. La auditoría es **best-effort**: nunca bloquea la operación de negocio en caso de error.

**Tabla `TIPO_OPERACION`** (BD server) — 13 tipos:

| ID | Descripción |
|----|-------------|
| 1  | Alta de Usuario |
| 2  | Baja de Usuario |
| 3  | Reinicio de Clave |
| 4  | Eliminación de Huella |
| 5  | Reasignación de Sucursal |
| 6  | Cambio de Perfil |
| 7  | Actualización de Cuenta |
| 8  | Vinculación con Legajo |
| 9  | Exclusion de Cuenta |
| 10 | Migración de Datos |
| 11 | Re-Activar Cuenta |
| 12 | Inicio de Sesión |
| 13 | Intento de Login Fallido |

### 5.8 Auditoría de operaciones

El modelo `InactividadModel.listar(umbralDias?, {idperfilFiltro?})`:

1. **Query 1 — BD server**: `SELECT TRIM(UPPER(usuario)), MAX(fecha) FROM REGISTRO GROUP BY ... HAVING MAX(fecha) < DATEADD(-N DAY TO CURRENT_DATE)` → set de usuarios inactivos.
2. **Query 2 — BD system**: cruza con `usuario WHERE estado=1 AND exclusion=0` excluyendo plantillas de rol y Admin.
3. Combina, calcula `diasInactivo` y ordena descendente.

El umbral `N` se toma de `CONFIGURACION_USUARIO.DIAS_INACTIVIDAD` (via `ConfiguracionModel.umbralInactividad()`) cuando no se pasa explícitamente. Fallback: 90 días.

La inhabilitación pasa siempre por `OperacionesService.bajaUsuario()` (cadena completa: `estado=0` + GG_MESERO + biometría + master + auditoría). El lote se re-valida antes de procesar cada usuario para evitar race conditions. Límite `MAX_BATCH=100`.

### 5.9 Detección de inactividad

Rutas sensibles (`/inactividad`, `/inactividad/inhabilitar`, `/export.csv`) requieren que el usuario autenticado tenga `CONFIGURACION_USUARIO.AUTORIZADO = 1` para su IP. Devuelve `403` si no tiene ese flag.

### 5.10 Middleware `requireAuthorized`

- Charset `UTF8` en pool y request.
- **No usar comillas dobles** alrededor de identificadores en minúscula: Firebird hace case‑sensitive y rompe la búsqueda.
- **No usar `AUTONOMOUS TRANSACTION`** desde Node: una transacción por request.
- CSV exportado con BOM `\uFEFF` + separador `;` + CRLF para máxima compatibilidad con Excel en Windows.

### 5.11 Encoding / Firebird 2.5

1. **Validación en dos fases**: cliente (duplicados de documento, campos vacíos) y server (perfil habilitado y con plantilla configurada, documento no duplicado en BD, sucursal activa, iduser generado sin colisión de lote).
2. **Perfil sin plantilla** (`tipo_usuario.iduser IS NULL`): detectado en la fase de validación con mensaje `"perfil X no tiene usuario-plantilla configurado"`. No llega a ejecución.
3. **Perfil inactivo** vs **inexistente**: mensajes diferenciados para orientar al operador.
4. **iduser único por lote**: `_sugerirUnico(nombre, apellido, reservadosEnLote)` consulta la BD y lleva un `Set` interno para evitar colisiones entre filas del mismo archivo.
5. **Transacción atómica**: `OperacionesService.altasBatch()` ejecuta todos los `INSERT` en una única `TRANSACTION('system')`. Si cualquier paso falla, ROLLBACK completo — ningún usuario queda a medias.
6. **Logging de tabla**: cada INSERT está envuelto en `step(label, sql, params)` que enriquece el error con `[TABLA_AFECTADA]` para diagnóstico rápido.
7. **Post-effects best-effort**: auditoría, legajo, GG_MESERO y masterSync se ejecutan fuera de la transacción principal. Errores en post-effects se reportan pero no revierten la importación.
8. **TXT de errores en Escritorio**: si hay errores de validación, se escribe `errImportacionUsuario_DDMMAAAA.txt`. En Windows usa `USERPROFILE` (tolera OneDrive/redirección).

### 5.12 Importación masiva — reglas de negocio

1. **Validación en dos fases**: cliente (duplicados de documento, campos vacíos) y server (perfil habilitado y con plantilla configurada, documento no duplicado en BD, sucursal activa, iduser generado sin colisión de lote).
2. **Perfil sin plantilla** (`tipo_usuario.iduser IS NULL`): detectado en la fase de validación con mensaje `"perfil X no tiene usuario-plantilla configurado"`. No llega a ejecución.
3. **Perfil inactivo** vs **inexistente**: mensajes diferenciados para orientar al operador.
4. **iduser único por lote**: `_sugerirUnico(nombre, apellido, reservadosEnLote)` consulta la BD y lleva un `Set` interno para evitar colisiones entre filas del mismo archivo.
5. **Transacción atómica**: `OperacionesService.altasBatch()` ejecuta todos los `INSERT` en una única `TRANSACTION('system')`. Si cualquier paso falla, ROLLBACK completo — ningún usuario queda a medias.
6. **Logging de tabla**: cada INSERT está envuelto en `step(label, sql, params)` que enriquece el error con `[TABLA_AFECTADA]` para diagnóstico rápido.
7. **Post-effects best-effort**: auditoría, legajo, GG_MESERO y masterSync se ejecutan fuera de la transacción principal. Errores en post-effects se reportan pero no revierten la importación.
8. **TXT de errores en Escritorio**: si hay errores de validación, se escribe `errImportacionUsuario_DDMMAAAA.txt`. En Windows usa `USERPROFILE` (tolera OneDrive/redirección).

### 5.13 Configuración — "¿Qué Ocurre?"

Cada fila de la tabla de Configuración del entorno tiene un botón `HelpCircle` ("¿Qué Ocurre?") que abre un modal mostrando:
- Los flags activos de esa configuración (siempre, legajo, biométrico, gastronomía, master) con badges coloreados.
- El catálogo de operaciones filtrado por esos flags — muestra qué tablas/BDs se afectan en cada operación cuando se ejecuta desde ese entorno.

### 5.14 `exclusion_permisos` — rastreo de personalización

Campo `INTEGER DEFAULT 0` en la tabla `USUARIO` (BD system). Controla el flujo de propagación de roles:

- Se pone en `1` cuando el operador **desmarca** a un usuario en `PropagateRolModal` — indica que tiene permisos que no coinciden con el rol.
- Se pone en `0` cuando el usuario es **incluido** en una propagación exitosa — vuelve a estar sincronizado con el rol.
- El badge `Sliders` ámbar en `UsuariosDataGrid` se muestra cuando `exclusion_permisos = 1`.
- **Constraint Firebird**: el `UPDATE usuario SET exclusion_permisos = ?` falla si `documento` es NULL (validación a nivel BD). Para estos usuarios el campo se omite y se reportan en `sin_documento[]`.

### 5.15 Propagación de permisos — flujo y tolerancia a fallos

1. `PropagateRolModal` carga la lista de usuarios activos del rol.
2. Los usuarios con `exclusion_permisos=1` aparecen pre-desmarcados.
3. Al **Aplicar**: `POST /api/roles/:idperfil/propagar` con `{ excluidos: string[] }`.
4. El servicio itera usuario por usuario en `try/catch` independientes:
   - Incluidos **sin documento**: copia menus/permisos en transacción, omite el UPDATE de `exclusion_permisos`. Se devuelven en `sin_documento[]`.
   - Incluidos **con documento**: copia completa + `exclusion_permisos = 0`.
   - Excluidos **con documento**: marca `exclusion_permisos = 1`.
   - Excluidos **sin documento**: cuenta como excluido, no toca la tabla `usuario`.
   - Cualquier error inesperado: acumulado en `errores[]`, proceso continúa con el siguiente.
5. Response: `{ propagados, excluidos, errores[], sin_documento[] }` — siempre HTTP 200.
6. El modal muestra panel ámbar para `sin_documento` y panel rojo para `errores`. Solo cierra si no hay ninguno de los dos.
7. `RoleAccesosPage` dispara el modal automáticamente vía `onGuardadoExitoso` en `AccesosEditor`.

### 5.16 Calendario de sucursal — programación mensual

Permite asignar a qué sucursal trabaja un usuario en cada día del mes, con aplicación automática vía cron.

**Estructura de datos**: `USUARIO_TURNO_SUCURSAL` (BD server).
- `FECHA` almacenada como `VARCHAR(10)` en formato `'YYYY-MM-DD'` (tipo `DATE` no soportado en Firebird dialect 1 DSQL).
- Una fila por (iduser, fecha); única asignación diaria.
- Operación de escritura: DELETE mes + INSERT todos los días en una sola transacción (`reemplazarMes`).

**UI — `ReasignarSucursalModal`**:
- **Reasignar ahora**: efecto inmediato (llama `OperacionesService.reasignarSucursal`, auditoría OP.5).
- **Calendario**: cuadrícula 7 columnas, navegación mes a mes.
- Tres modos de selección: **Día** (toggle individual), **Rango** (clic inicio + clic fin), **Semanal** (asigna todos los mismos días de la semana del mes).
- **Clic derecho**: quita un día. **Limpiar mes**: borra todas las asignaciones del mes visible de un click.
- **Copiar al siguiente mes**: replica las asignaciones actuales (omite días que no existen en el mes destino, ej. día 31 en mes de 30 días).
- Paleta de 8 colores por sucursal; indicador de cambios pendientes sin guardar.

**Cron — `turnoSucursal.job.js`**:
- Horario: `04:00 AM` (expresión `0 4 * * *`). Sobreescribible con `TURNO_SUCURSAL_CRON`.
- Habilitar con `ENABLE_TURNO_SUCURSAL_JOB=1`.
- **Verificación de estado en tiempo de ejecución**: consulta la BD de sistema por separado antes de procesar. Si el usuario fue dado de baja a mitad de mes, no recibe la reasignación aunque tenga días en el calendario.
- Llama `OperacionesService.reasignarSucursal()` (cadena completa: USUARIO_SUCURSAL, USUARIO_DEPOSITO, USUARIO_DEPOSITO1, GG_MESERO, auditoría OP.5).
- Omite usuarios donde la sucursal programada ya es la actual (orden=1) — no genera operaciones innecesarias.

### 5.17 Filtro rápido "Sin documento" en UsuariosDataGrid

Botón toggle en el toolbar de la grilla que usa un `filterFn` personalizada sobre la columna `documento`. Al activarse muestra únicamente usuarios donde `!documento?.trim()`. El header de la columna cambia a un indicador visual. Se desactiva volviendo a clickear.

### 5.18 Barra de leyenda de badges

Porción estática debajo del toolbar en `UsuariosDataGrid` que explica los cuatro indicadores visuales de la columna `iduser`. Siempre visible sin necesidad de tooltip o documentación externa.

---

## 6. Buenas prácticas aplicadas

- **MVC** estricto: `routes → controller → service → model`.
- **Validación temprana** con Zod en cada endpoint (params + body + query).
- **JWT** firmados con `HS256`, claims mínimos, expiración corta + refresh.
- **bcrypt** para claves (rehash transparente en login si vienen del legacy).
- **Helmet, CORS, rate‑limit, compression** activos en producción.
- **Manejo central de errores** con códigos HTTP semánticos (`error.middleware`).
- **Logs estructurados** (pino) con `request-id`.
- **Separación de credenciales** por `.env`; jamás en código.
- **Frontend desacoplado**: contrato vía JSON, sin acoplamiento a la BD.
- **requireAuthorized**: operaciones destructivas (inhabilitación, export) requieren flag `AUTORIZADO` en `CONFIGURACION_USUARIO`.
- **Auditoría best-effort**: todo evento de negocio se registra en `HISTORIAL_USUARIO` sin bloquear el flujo principal.
- **Job cron sin baja automática**: el escaneo semanal sólo loguea — la decisión de inhabilitar siempre requiere intervención humana desde la UI.
- **Accesibilidad** (a11y): labels, foco visible, navegación por teclado, contraste ≥ 4.5:1.
- **Lazy loading** por pestaña en `AccesosEditor` (conceptos, sucursales y depósitos sólo se piden al activar la pestaña).
- **Optimistic UI con `dirty set`**: cada pestaña marca su flag de cambios sin bloquear navegación entre tabs.
- **Transacciones explícitas** desde Node, commit/rollback controlado.
- **Índices en REGISTRO**: `IDX_REGISTRO_USUARIO` (ascendente) + `IDX_REGISTRO_FECHA_DESC` (descendente) para agilizar el escaneo de inactividad.
- **Alta atómica por lote**: `altasBatch()` envuelve todos los INSERTs del batch en una única tx `system` — todo o nada.
- **Logging de pasos en `_altaWork`**: cada INSERT está etiquetado con el nombre de la tabla para diagnóstico inmediato de errores de truncamiento u otros errores de BD.
- **Perfil sin plantilla detectado antes de ejecución**: la validación del `importar` verifica `tipo_usuario.iduser IS NOT NULL` en la fase de validación, no en ejecución.

---

## 7. Endpoints

### 7.1 Autenticación

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/auth/login` | iduser + pass → access + refresh. Audita `OP.LOGIN` (ok) o `OP.LOGIN_FALLIDO` (error) con IP. |
| `POST` | `/api/auth/refresh` | Renueva access token. |

### 7.2 Usuarios

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET`   | `/api/usuarios?busqueda=&idperfil=&estado=` | 🔒 | Lista filtrada (máx 200, excluye plantillas y Admin). |
| `GET`   | `/api/usuarios/export.csv?busqueda=&idperfil=&estado=` | 🔒🛡️ | Export CSV sin tope, con columna `perfil`. |
| `GET`   | `/api/usuarios/inactividad?dias=&idperfil=` | 🔒🛡️ | Candidatos a inhabilitar por inactividad. |
| `POST`  | `/api/usuarios/inactividad/inhabilitar` | 🔒🛡️ | Inhabilita uno (`iduser`) o lote (`ids[]`, máx 100). |
| `GET`   | `/api/usuarios/sugerir?nombre=&apellido=` | 🔒 | Sugiere iduser. |
| `GET`   | `/api/usuarios/check-documento?documento=` | 🔒 | Disponibilidad de CI/RUC. |
| `GET`   | `/api/usuarios/:iduser` | 🔒 | Ficha. |
| `POST`  | `/api/usuarios` | 🔒 | Alta (invoca `PCD_USUARIO`). |
| `PATCH` | `/api/usuarios/:iduser` | 🔒 | Modificación (nombre, apellido, documento). |
| `POST`  | `/api/usuarios/:iduser/baja` | 🔒 | Baja (`PCD_OPERACIONES` idop=2). |
| `POST`  | `/api/usuarios/:iduser/reactivar` | 🔒 | Re-activa (idop=11). |
| `POST`  | `/api/usuarios/:iduser/reset-clave` | 🔒 | Reset clave (idop=3). |
| `POST`  | `/api/usuarios/:iduser/reasignar-sucursal` | 🔒 | (idop=5). |
| `POST`  | `/api/usuarios/:iduser/cambiar-perfil` | 🔒 | (idop=6 — reemplaza todo). |
| `POST`  | `/api/usuarios/bloquear-sin-menu` | 🔒 | Bloqueo masivo de usuarios sin `menu_general`. |
| `GET`   | `/api/usuarios/:iduser/complemento` | 🔒 | `modo_print/talonario/descuento`. |
| `PATCH` | `/api/usuarios/:iduser/complemento` | 🔒 | Actualiza complemento. |
| `GET`   | `/api/usuarios/:iduser/historial?page=&pageSize=` | 🔒 | Historial paginado (25/50/100). |
| `POST`  | `/api/usuarios/importar` | 🔒🛡️ | Alta masiva atómica. Body: `{ filas: FilaImportacion[] }` (máx 200). Valida perfiles/sucursales, genera iduser por lote. 422 si hay errores de validación + TXT en Escritorio. 200 con `{ importados, erroresPostefecto }`. |
| `GET`   | `/api/usuarios/:iduser/sucursal-principal` | 🔒 | Sucursal de orden 1 del usuario. Devuelve `{ idsucursal, nombre }` o `null`. |
| `GET`   | `/api/usuarios/:iduser/turnos?anio=&mes=` | 🔒 | Asignaciones de sucursal del mes (`USUARIO_TURNO_SUCURSAL`). |
| `POST`  | `/api/usuarios/:iduser/turnos` | 🔒 | Reemplaza el mes completo. Body: `{ anio, mes, items: [{idsucursal, fecha}] }`. |

> 🔒 = requiere JWT · 🛡️ = además requiere `AUTORIZADO=1` en `CONFIGURACION_USUARIO`

### 7.3 Accesos (por usuario)

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/accesos/:iduser` | Estado completo (menu + flags + pdv + gg). |
| `PUT` | `/api/accesos/:iduser/menu` | Flags `MENU_GENERAL`. |
| `PUT` | `/api/accesos/:iduser/permisos-generales` | String `PERMISOS`. |
| `PUT` | `/api/accesos/:iduser/movimientos` | String `MOVIMIENTOS`. |
| `PUT` | `/api/accesos/:iduser/pdv` | `MENU_GG_2`. |
| `PUT` | `/api/accesos/:iduser/permiso-gg` | `PERMISO_GG`. |
| `GET` | `/api/accesos/:iduser/conceptos` | Grupos con `permiso_varios` y 5 campos extra. |
| `PUT` | `/api/accesos/:iduser/conceptos` | Upsert tolerante (preserva campos si no vienen). |
| `GET` | `/api/accesos/:iduser/sucursales` | Catálogo × asignación. |
| `PUT` | `/api/accesos/:iduser/sucursales` | DELETE+INSERT. |
| `GET` | `/api/accesos/:iduser/depositos` | Catálogo × salida × entrada. |
| `PUT` | `/api/accesos/:iduser/depositos` | DELETE+INSERT, valida regla salida↔sucursal. |

### 7.4 Roles (mismas operaciones contra el iduser de la plantilla)

| Método | Ruta | Descripción |
|---|---|---|
| `GET`    | `/api/roles?estado=` | Lista. |
| `POST`   | `/api/roles` | Alta. |
| `PUT`    | `/api/roles/:idperfil` | Edición. |
| `DELETE` | `/api/roles/:idperfil` | Baja. |
| `GET`    | `/api/roles/:idperfil/accesos` | Estado completo de la plantilla. |
| `PUT`    | `/api/roles/:idperfil/{menu\|permisos-generales\|movimientos\|pdv\|permiso-gg\|conceptos\|sucursales\|depositos}` | Mismos payloads que `/accesos/:iduser/...`. |
| `GET`    | `/api/roles/:idperfil/usuarios` | Usuarios activos del rol con `exclusion_permisos` y `documento`. |
| `POST`   | `/api/roles/:idperfil/propagar` | Propaga permisos del rol. Body: `{ excluidos: string[] }`. Response: `{ propagados, excluidos, errores[], sin_documento[] }`. |

### 7.5 Catálogos

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/catalogos/perfiles` | `TIPO_USUARIO` + `Admin` sintético. |
| `GET` | `/api/catalogos/operaciones` | Catálogo de 13 operaciones con descripción y efectos declarativos. |
| `GET` | `/api/catalogos/sucursales` | `SUCURSAL WHERE estado=1`. |
| `GET` | `/api/catalogos/depositos` | `DEPOSITO WHERE estado=1` (incluye `idsucursal`). |
| `GET` | `/api/catalogos/talonarios` | `TALONARIO WHERE estado='A'` JOIN `SUCURSAL`. |
| `GET` | `/api/catalogos/vendedores` | `VENDEDOR WHERE estado=1`. |
| `GET` | `/api/catalogos/planventas` | `PLANVENTA WHERE estado=1`. |
| `GET` | `/api/catalogos/condiciones` | `CONDICION WHERE estado=1`. |
| `GET` | `/api/catalogos/permisos-generales` | `TMP$USUARIO_PERMISOS_GENERALES`. |
| `GET` | `/api/catalogos/permisos-pdv` | `TMP$USUARIO_PERMISOS_PDV`. |
| `GET` | `/api/catalogos/menu-base/:idperfil` | Plantilla de menú del perfil. |

### 7.6 Configuración del entorno

| Método | Ruta | Descripción |
|---|---|---|
| `GET`    | `/api/configuracion` | Lista todas las IPs. |
| `GET`    | `/api/configuracion/:ip` | Detalle (incluye `dias_inactividad`). |
| `POST`   | `/api/configuracion` | Alta. |
| `PUT`    | `/api/configuracion/:ip` | Edición. |
| `DELETE` | `/api/configuracion/:ip` | Baja. |
| `GET`    | `/api/configuracion/autorizado` | Verifica si la IP cliente está autorizada (flag `AUTORIZADO`). |

---

## 8. Migraciones SQL

Las migraciones viven en `server/sql/` y se ejecutan con el runner idempotente:

```powershell
cd server
node sql/run-migration.js 03_login_audit.sql
node sql/run-migration.js 04_inactividad.sql
```

El runner imprime `OK` / `WARN (duplicate)` / `FAIL` por sentencia y siempre continúa, nunca aborta.

| Archivo | BD | Qué hace |
|---|---|---|
| `03_login_audit.sql` | server | Inserta 13 filas en `TIPO_OPERACION`. |
| `04_inactividad.sql` | server | `ALTER TABLE CONFIGURACION_USUARIO ADD DIAS_INACTIVIDAD INTEGER DEFAULT 90 NOT NULL`; crea `IDX_REGISTRO_USUARIO` e `IDX_REGISTRO_FECHA_DESC`. |

---

## 9. Puesta en marcha

### Requisitos

- Node.js **≥ 20**, npm ≥ 10.
- Firebird **2.5 / 3.0 / 4.0** accesible por TCP/3050.
- BDs `system_*.fdb` y `server_*.fdb` del cliente.

### Instalación

```powershell
# 1) Dependencias
npm install              # raíz (monorepo)
npm install --prefix server
npm install --prefix client

# 2) .env
Copy-Item server\.env.example server\.env
# editar credenciales y parámetros

# 3) Migraciones SQL (primera vez o al actualizar)
cd server
node sql/run-migration.js 03_login_audit.sql
node sql/run-migration.js 04_inactividad.sql
cd ..

# 4) Dev (ambos en paralelo)
npm run dev
```

| Script raíz | Acción |
|---|---|
| `npm run dev` | Inicia `server` (puerto 3001) + `client` (puerto 5173) en paralelo. |
| `npm run build` | Build de producción del cliente. |
| `npm run lint` | ESLint en ambos workspaces. |

### Troubleshooting frecuente

| Síntoma | Causa común | Solución |
|---|---|---|
| `error interno del servidor` en Configuración | Tabla referenciada en otra BD | Verificar pool correcto (`server`/`system`); quitar comillas dobles en identificadores. |
| Puerto 5175 ocupado | Otra instancia de Vite corriendo | `Get-NetTCPConnection -LocalPort 5175` → `Stop-Process` por PID. |
| Toast "Error guardando" en Accesos | Validación Zod rechazó payload | Revisar logs pino: muestra el path del campo inválido. |
| Pestaña Movimientos no aparece | `mnuAdminMovimientos` deshabilitado en Menú | Habilitarlo y guardar; la pestaña reaparece. |
| `403 Forbidden` en `/inactividad` o `/export.csv` | IP del operador no tiene `AUTORIZADO=1` | En Configuración del entorno, habilitar el flag `Autorizado` para la IP correspondiente. |
| Job cron no arranca | `ENABLE_INACTIVIDAD_JOB` o `ENABLE_TURNO_SUCURSAL_JOB` no está en `.env` | Agregar las variables al `.env` del server. |
| Historial sin descripción de operación | `TIPO_OPERACION` vacía | Ejecutar `node sql/run-migration.js 03_login_audit.sql`. |
| DDL falla con error `-817` en Firebird | `run-migration.js` usa `db.query()` que rechaza DDL en dialect 1 | Usar `db.execute()` en un script separado (ver `server/sql/06_run_turno_sucursal.js` como modelo). |
| Propagación muestra panel ámbar con usuarios | Usuarios sin `documento` en BD — constraint Firebird impide UPDATE | Completar documento en cada usuario afectado y volver a propagar. |

---

## 10. Backlog / Próximos pasos

| Prioridad | Ítem | Notas |
|---|---|---|
| Alta | **Legajos** | Vinculación con `LEGAJO` (talento humano): datos personales extendidos, foto, contrato. |
| Alta | **Prueba‑error** | Dado un usuario y un movimiento, visualizar cada flag evaluado paso a paso. |
| Media | **Biometría** | Enrollment de huellas, sincronización con Suprema / ZKTeco, tabla `BIOMETRICO`. |
| Baja | **Tests E2E** | Playwright: login → alta usuario → asignar rol → editar accesos → verificar persistencia. |
| Baja | **Migrar `USUARIO_CONCEPTO` a DELETE+INSERT** | Consistencia con sucursales/depósitos, preservando 5 campos extra. |

### Decisiones tomadas (no revisitar)

- Cambio de rol = **Reemplazar todo** (idop=6 ya lo hace en el SP).

---

## 11. Propuestas de mejora

Las siguientes ideas están fuera del backlog inmediato pero potencian el módulo considerando los patrones ya establecidos (especialmente el calendario, la propagación y la auditoría).

### 11.1 Plantillas de calendario reutilizables

Actualmente el calendario se configura usuario a usuario. Se podría definir **plantillas de turno** a nivel rol (ej. "Turno A: lunes a viernes en sucursal Centro") y aplicarlas en bloque a todos los usuarios del rol. Similar al flujo de `propagarDesdeRol` pero sobre `USUARIO_TURNO_SUCURSAL`.

DDL requerido: tabla `PLANTILLA_TURNO` (id, nombre, idperfil) + `PLANTILLA_TURNO_DIA` (id_plantilla, dia_semana, idsucursal). Acción: `POST /api/roles/:idperfil/turnos/aplicar-plantilla`.

### 11.2 Detección de conflictos en el calendario

Hoy es posible asignar a un usuario en una sucursal un día donde ya tiene una operación auditada en otra. Un job o endpoint de validación podría cruzar `USUARIO_TURNO_SUCURSAL` con `HISTORIAL_USUARIO` (OP.5) para detectar inconsistencias antes de que el cron aplique cambios.

### 11.3 Aprobación de operaciones sensibles (workflow)

Agregar una tabla `SOLICITUD_OPERACION` (iduser_solicitante, iduser_objetivo, idoperacion, estado, fecha_solicitud, fecha_resolucion, aprobado_por). Las operaciones de baja, reset de clave y cambio de perfil podrían pasar por una cola de aprobación donde un supervisor autoriza antes de ejecutar. El cron o una acción manual procesaría la cola.

### 11.4 Dashboard de auditoría

Vista agregada sobre `HISTORIAL_USUARIO`: top de operaciones por período, mapa de calor de actividad por hora, alertas de operaciones fuera de horario laboral, detección de múltiples resets en poco tiempo (posible abuso). Implementable con un endpoint `GET /api/auditoria/resumen?desde=&hasta=` + gráficos Recharts en el cliente.

### 11.5 Vencimiento programado de accesos

Agregar columna `fecha_vencimiento DATE` a `USUARIO`. El cron de `turnoSucursal` (o uno nuevo) verificaría diariamente y ejecutaría baja automática con `OperacionesService.bajaUsuario()` para cuentas vencidas. Útil para accesos temporales (proveedores, pasantes, contratos fijos).

### 11.6 Notificaciones internas / webhooks

Cuando el cron aplica reasignaciones, o cuando se inhabilita un lote por inactividad, enviar una notificación (correo, webhook, Telegram bot) al administrador del sistema con el resumen: `N reasignados, M omitidos, K errores`. El `turnoSucursal.job.js` ya tiene la estructura del resumen — solo falta el canal de salida.

### 11.7 Exportación del calendario a iCal / CSV

Desde `ReasignarSucursalModal`, botón "Exportar mes" que descarga un archivo `.ics` (estándar iCalendar) o `.csv` con las asignaciones del mes visible. Útil para que el usuario o supervisor vea el turno en Google Calendar / Outlook.

### 11.8 Historial de cambios del calendario

Actualmente `USUARIO_TURNO_SUCURSAL` se reemplaza completamente cada vez que se guarda (DELETE + INSERT). Agregar una tabla de auditoría `HISTORIAL_TURNO` que registre quién modificó el calendario, cuándo y qué cambió (mes anterior vs nuevo). Permite rastrear si un supervisor alteró los turnos sin aviso.

### 11.9 Bloqueo de acceso por horario

Extender `CONFIGURACION_USUARIO` o crear `USUARIO_HORARIO_ACCESO` (iduser, hora_desde, hora_hasta, dias_semana) para restringir el login a franjas horarias. El middleware `auth.js` verificaría la franja antes de emitir el token. Caso de uso: usuarios de solo turno mañana no pueden iniciar sesión de noche.

### 11.10 Sincronización bidireccional con el sistema legado

El módulo actualmente replica **hacia** el legado (master sync, GG_MESERO). Una mejora sería implementar **escucha de cambios**: un polling o trigger Firebird que detecte modificaciones directas al legado (ej. alguien usó el WinForms) y las refleje en `HISTORIAL_USUARIO` para mantener consistencia de auditoría.

---

## 10. Backlog / Próximos pasos

| Prioridad | Ítem | Notas |
|---|---|---|
| Alta | **Legajos** | Vinculación con `LEGAJO` (talento humano): datos personales extendidos, foto, contrato. |
| Alta | **Prueba‑error** | Dado un usuario y un movimiento, visualizar cada flag evaluado paso a paso. |
| Media | **Biometría** | Enrollment de huellas, sincronización con Suprema / ZKTeco, tabla `BIOMETRICO`. |
| Media | **Importación masiva** | ✅ Implementado. Ver sección 5.11. |
| Baja | **Tests E2E** | Playwright: login → alta usuario → asignar rol → editar accesos → verificar persistencia. |
| Baja | **Migrar `USUARIO_CONCEPTO` a DELETE+INSERT** | Consistencia con sucursales/depósitos, preservando 5 campos extra. |

### Decisiones tomadas (no revisitar)

- Cambio de rol = **Reemplazar todo** (idop=6 ya lo hace en el SP).
- `PERSONA` es input numérico, no select (1M+ registros).
- Botón Accesos en el datagrid + fila naranja al seleccionar.
- Talonario display: `[Sucursal] #IdTalonario (Desde–Hasta) vence DD/MM/AAAA`.
- 5 campos extra de `USUARIO_CONCEPTO` sólo se envían en `scope='usuario'`; en `scope='rol'` se preservan los del usuario.
- Configuración acepta `localhost` además de IPv4.
- Tabla `CONFIGURACION_USUARIO` vive en BD `server` (no `system`), sin columna `version`, sí `version_nro`.
- Job cron = solo log, nunca baja automática.
- CSV = BOM UTF-8 + separador `;` (compatible Excel en español).
- `TIPO_OPERACION` como tabla real en BD server (no catálogo embebido); `operaciones.config.js` sigue siendo fuente de verdad para la lógica JS.
- Importación masiva = **todo o nada** (rollback atómico); post-effects quedan fuera de la tx en best-effort.
- Separador CSV de importación auto-detectado (TAB → `;` → `,`); cabecera case-insensitive y opcionalmente posicional.

---

## 11. Convenciones de código

- **Imports absolutos** desde `src/` en el cliente.
- **Sin docstrings en código que no se tocó**.
- **No crear archivos markdown** salvo que se pidan explícitamente.
- Componentes React: nombre `PascalCase`, archivo igual al componente.
- Endpoints: kebab-case en URL, camelCase en JSON.
- Toasts en español, mensajes cortos.
- Tipografía compacta en grillas (`text-xs`, `py-0.5`) — imita la densidad del legacy.
- Rutas que puedan colisionar con `/:param` (ej. `/inactividad`, `/export.csv`) deben declararse **antes** del wildcard en el router.

---

> Para dudas sobre BD legada o lógica de negocio histórica, consultar `BaseDatos.txt` y el SP `PCD_OPERACIONES` (BD `server`).

---

## 12. Tareas pendientes — próxima sesión (30-05-2026)

### 🔴 Bloqueantes

| # | Tarea | Contexto |
|---|---|---|
| 1 | **Diagnosticar SQL -303 en `_altaWork`** | Los 4 usuarios de prueba fallan con *string right truncation*. El label del error indica la tabla exacta. Causa probable: columna `iduser` definida como `CHAR(8)` en `USUARIO_CONCEPTO`, `MENU_GENERAL` u otra tabla cuando el iduser generado puede superar 8 chars. Verificar DDL y ajustar cap en `_sugerirUnico` (actualmente sin límite explícito). |
| 2 | **Confirmar importación masiva end-to-end** | Una vez resuelto el -303, importar los 4 registros de prueba y verificar: usuarios creados, idusers asignados, auditoría en `HISTORIAL_USUARIO`, TXT no generado. |

### 🟡 Pendientes de revisión

| # | Tarea | Contexto |
|---|---|---|
| 3 | **Longitud máxima de `iduser` en tablas del sistema** | Ejecutar `SELECT RDB$FIELD_LENGTH FROM RDB$RELATION_FIELDS WHERE RDB$RELATION_NAME = 'USUARIO' AND RDB$FIELD_NAME = 'IDUSER'` (y lo mismo para las tablas que aparecen en el label del -303). Si es 8, reducir el cap de `_sugerirUnico`. |
| 4 | **Campo `pass` en INSERT USUARIO** | El alta usa `documento` como contraseña inicial. Verificar que `usuario.pass` admite la longitud máxima de `documento` (12 chars). |
| 5 | **TXT en Escritorio del servidor** | Confirmar que el archivo `errImportacionUsuario_*.txt` se crea correctamente cuando hay errores de validación. Verificar que `USERPROFILE` apunta al escritorio correcto en el entorno del servidor. |

### 🟢 Mejoras opcionales

| # | Tarea | Contexto |
|---|---|---|
| 6 | **Botón "Descargar errores" en el modal** | Actualmente el TXT solo se escribe en el servidor. Agregar descarga Blob client-side para que el operador no tenga que ir al Escritorio del servidor. |
| 7 | **`iduser sugerido` en tabla de errores de ejecución** | Ya está disponible en `erroresEjecucion[].iduser`; mostrarlo prominentemente en la grilla del modal. |
| 8 | **Legajos** | Alta prioridad del roadmap. Vinculación con `RH_CARGO.user_system` y datos de persona. |

## 1. Resumen ejecutivo

El módulo administra el ciclo de vida completo de los **usuarios** y sus **accesos** distribuidos en múltiples ejes, replicando 1‑a‑1 la lógica de negocio del sistema legado pero con una capa de UI/UX moderna, API REST tipada y validación exhaustiva.

### 1.1 Funcionalidades implementadas

| # | Módulo | Estado | Descripción |
|---|---|---|---|
| 1 | **Login / JWT** | ✅ | Access (15 min) + refresh (7 d), guard de rutas, claims `iduser/idperfil/idempresa`. |
| 2 | **Usuarios — CRUD** | ✅ | Alta (SP `PCD_USUARIO`), baja lógica, edición, sugerencia de `iduser`, validación de documento. |
| 3 | **Usuarios — Operaciones** | ✅ | Reset clave, reasignar sucursal, cambiar perfil — todas vía `PCD_OPERACIONES` (auditadas). |
| 4 | **Usuarios — DataGrid** | ✅ | Buscador, filtros (perfil, estado), selección naranja, accesos directos a edición y permisos. |
| 5 | **Usuarios — Complemento** | ✅ | `modo_print`, `talonario`, `descuento` opcionales por usuario. |
| 6 | **Roles / Perfiles** | ✅ | CRUD de `TIPO_USUARIO` + edición de plantilla compartiendo el editor de Accesos. |
| 7 | **Accesos — Menú Gestión** | ✅ | `MENU_GENERAL` jerárquico con flag `PERMISO 0/1`. |
| 8 | **Accesos — Permisos Generales** | ✅ | `USUARIOEMPRESA.PERMISOS` (string S/N de 50 posiciones). |
| 9 | **Accesos — Movimientos** | ✅ | `USUARIOEMPRESA.MOVIMIENTOS` (string S/N) + sincronización con `mnuAdmMovimientos{N}`. |
| 10 | **Accesos — Conceptos** | ✅ | `USUARIO_CONCEPTO` por tipo de movimiento: permiso + `permiso_varios` (15 chars). |
| 11 | **Accesos — Personalización por usuario** | ✅ | 5 overrides en `USUARIO_CONCEPTO`: talonario, vendedor, persona, planventa, condición. |
| 12 | **Accesos — Punto de Venta** | ✅ | `USUARIOEMPRESA.MENU_GG_2` + catálogo `TMP$USUARIO_PERMISOS_PDV`. |
| 13 | **Accesos — Contab. / RRHH** | ✅ | `USUARIOEMPRESA.PERMISO_GG` por módulo con sub‑permisos. |
| 14 | **Accesos — Sucursales** | ✅ | `USUARIO_SUCURSAL` (DELETE+INSERT, sin PK en legacy). |
| 15 | **Accesos — Depósitos** | ✅ | `USUARIO_DEPOSITO` (salida) + `USUARIO_DEPOSITO1` (entrada). |
| 16 | **Catálogos públicos** | ✅ | Perfiles, sucursales, depósitos, talonarios, vendedores, planventas, condiciones. |
| 17 | **Configuración del entorno** | ✅ | `CONFIGURACION_USUARIO` por IP (admite `localhost`), flag `AUTORIZADO/MASTER`. |
| 18 | **Auditoría** | 🟡 pendiente | Pestaña de visualización de `HISTORIAL_USUARIO`. |
| 19 | **Legajos** | 🟡 pendiente | Datos de RRHH del usuario (vinculación con `LEGAJO`). |
| 20 | **Biometría** | 🟡 pendiente | Captura/enrollment huella + sincronización dispositivos. |
| 21 | **Importación masiva** | 🟡 pendiente | CSV/Excel para alta batch. |
| 22 | **Tests E2E** | 🟡 pendiente | Playwright cubriendo flujos críticos. |

### 1.2 Mejoras frente al sistema original

- **UI minimalista, densa y responsive** (React + Tailwind), reemplazando el WinForms con grillas compactas tipo legado pero con tipografía consistente.
- **Capa de servicio** que oculta los strings posicionales (`S/N`, `0/1`) y expone JSON tipado.
- **JWT** en lugar de sesiones Firebird directas.
- **Transacciones explícitas** desde Node (`node-firebird`) en vez de `AUTONOMOUS TRANSACTION` anidadas dentro de SPs (se mantiene compatibilidad con los SP existentes cuando aportan valor — ej. `PCD_OPERACIONES`).
- **Validación Zod** simétrica en cliente y servidor; errores normalizados.
- **Multi-cliente / multi-empresa** vía `.env` (un par de BDs `system` + `server` por instalación).

---

## 2. Arquitectura

```
Usuarios/
├── README.md
├── BaseDatos.txt              # notas de DDL del sistema legado
├── package.json               # monorepo (scripts dev/build)
├── server/                    # API REST (Node 20 + Express 4) — MVC
│   ├── package.json
│   ├── src/
│   │   ├── app.js                 # bootstrap Express (helmet, cors, rate-limit)
│   │   ├── server.js              # listen
│   │   ├── config/
│   │   │   ├── env.js             # carga + valida .env
│   │   │   └── firebird.js        # pools system + server, helpers query/transaction
│   │   ├── middlewares/
│   │   │   ├── auth.js            # verify JWT
│   │   │   ├── error.js           # handler central
│   │   │   └── validate.js        # Zod
│   │   ├── models/                # acceso a datos
│   │   │   ├── usuario.model.js
│   │   │   ├── menu.model.js
│   │   │   ├── permiso.model.js
│   │   │   ├── catalogo.model.js
│   │   │   ├── concepto.model.js
│   │   │   ├── configuracion.model.js
│   │   │   ├── rol.model.js
│   │   │   ├── usuarioSucursal.model.js
│   │   │   └── usuarioDeposito.model.js
│   │   ├── controllers/
│   │   │   ├── auth.controller.js
│   │   │   ├── usuario.controller.js
│   │   │   ├── accesos.controller.js
│   │   │   ├── rol.controller.js
│   │   │   ├── catalogo.controller.js
│   │   │   └── configuracion.controller.js
│   │   ├── services/              # lógica de negocio (encode/decode posicional)
│   │   │   ├── permisos.service.js
│   │   │   └── accesos.service.js
│   │   ├── routes/
│   │   │   ├── index.js
│   │   │   ├── auth.routes.js
│   │   │   ├── usuario.routes.js
│   │   │   ├── accesos.routes.js
│   │   │   ├── rol.routes.js
│   │   │   ├── catalogo.routes.js
│   │   │   └── configuracion.routes.js
│   │   └── utils/
│   │       ├── logger.js          # pino
│   │       └── jwt.js
│   └── test-query.js              # script de prueba de queries
│
└── client/                    # SPA React 18 + Vite + TS + Tailwind
    ├── package.json
    ├── tailwind.config.js
    ├── vite.config.ts
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── api/
        │   ├── client.ts          # axios + interceptor JWT
        │   └── endpoints.ts       # tipos + funciones API
        ├── auth/
        │   └── AuthContext.tsx
        ├── components/
        │   └── layout/AppLayout.tsx
        ├── features/
        │   ├── login/LoginPage.tsx
        │   ├── usuarios/
        │   │   ├── UsuariosPage.tsx
        │   │   └── UsuariosDataGrid.tsx
        │   ├── roles/RolesPage.tsx
        │   ├── auditoria/
        │   │   └── AuditoriaPage.tsx      # datagrid global HISTORIAL_USUARIO + filtros + CSV + print
        │   ├── reportes/
        │   │   ├── ReportesPage.tsx       # selector tipo (usuario/rol) + buscador + imprimir
        │   │   ├── FichaUsuarioReporte.tsx
        │   │   └── FichaRolReporte.tsx
        │   ├── configuracion/ConfiguracionPage.tsx
        │   └── accesos/
        │       ├── AccesosPage.tsx       # editor modo "usuario"
        │       ├── RoleAccesosPage.tsx   # editor modo "rol"
        │       ├── AccesosEditor.tsx     # contenedor con tabs
        │       └── tabs/
        │           ├── MenuTab.tsx
        │           ├── FlagsTab.tsx           # reusado por Permisos, Movimientos, etc.
        │           ├── PdvTab.tsx
        │           ├── ConceptosTab.tsx       # + ConfigAdicionalesPanel
        │           ├── SucursalesTab.tsx
        │           └── DepositosTab.tsx
        └── styles/index.css
```

### 2.1 Flujo de datos

```mermaid
flowchart LR
    UI[React SPA] -- JWT Bearer --> API[Express API]
    API --> SYS[(Firebird: system_*)]
    API --> SRV[(Firebird: server_*)]
    SYS -.SP PCD_USUARIO.-> SRV
    SRV -.SP PCD_OPERACIONES.-> SYS
```

### 2.2 Convención clave: rol == usuario plantilla

En el legacy, los roles **son usuarios sintéticos** con un `iduser` propio almacenado en `tipo_usuario.iduser`. Las tablas `usuario_concepto`, `usuario_sucursal`, `usuario_deposito*`, `menu_general`, `usuarioempresa` se llenan tanto para usuarios reales como para roles‑plantilla. El SP `PCD_OPERACIONES idoperacion=6` (cambio de perfil) **replica todos los registros desde la plantilla del rol al usuario** — esto se mantuvo, así "cambiar de perfil" es **Reemplazar todo**.

El componente `AccesosEditor` recibe una prop `scope: 'rol' | 'usuario'` que activa/desactiva la personalización por usuario sin duplicar código.

---

## 3. Tecnologías

| Capa | Tecnología | Motivo |
|---|---|---|
| Frontend | **React 18 + Vite + TypeScript** | DX rápida, build optimizado, tipado estricto. |
| UI | **Tailwind CSS** + **lucide-react** | Diseño consistente, iconos vectoriales. |
| Estado servidor | **@tanstack/react-query v5** | Cache, invalidaciones, lazy loading por pestaña. |
| Tablas | **@tanstack/react-table** | Grillas virtualizadas. |
| Notificaciones | **react-hot-toast** | Toasts no bloqueantes. |
| Validación | **Zod v3** | Esquemas compartidos client/server. |
| HTTP | **axios** | Interceptores, manejo de errores. |
| Backend | **Node.js 20 + Express 4** | Maduro, ecosistema amplio. |
| DB driver | **node-firebird** | Driver puro JS para Firebird 2.5+. |
| Auth | **jsonwebtoken** + bcrypt | JWT HS256 + hash de claves. |
| Logs | **pino** | JSON estructurado, alto rendimiento. |
| Lint | **eslint** + **prettier** | Estilo uniforme. |
| Encoding | **UTF‑8** end‑to‑end | Charset Firebird `UTF8`, headers HTTP. |

---

## 4. Configuración multi-cliente

Cada instalación se gestiona con un `.env` por backend cambiando los nombres de base.

```env
# server/.env
PORT=3001
NODE_ENV=production
JWT_SECRET=cambiar_por_secreto_largo
JWT_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d
CORS_ORIGIN=http://localhost:5173
DEFAULT_IDEMPRESA=1

# Base 'system' (autenticación + tipo_usuario + menu_general)
SYSTEM_HOST=192.168.0.10
SYSTEM_PORT=3050
SYSTEM_DATABASE=C:/BD/system_empresa1.fdb
SYSTEM_USER=SYSDBA
SYSTEM_PASSWORD=masterkey
SYSTEM_CHARSET=UTF8

# Base 'server' (datos operativos: conceptos, sucursales, depósitos, configuración)
SERVER_HOST=192.168.0.10
SERVER_PORT=3050
SERVER_DATABASE=C:/BD/server_empresa1.fdb
SERVER_USER=SYSDBA
SERVER_PASSWORD=masterkey
SERVER_CHARSET=UTF8
```

> **Configuración del entorno** (tabla `CONFIGURACION_USUARIO` en BD `server`): se administra desde la UI; admite `localhost` como IP.

---

## 5. Reglas de negocio críticas

### 5.1 Strings posicionales

| Campo | Long. | Codificación |
|---|---|---|
| `USUARIOEMPRESA.PERMISOS` | 50 | `S/N` por posición (Permisos Generales). |
| `USUARIOEMPRESA.MOVIMIENTOS` | 20 | `S/N`; el índice = valor `tipo` en `TIPOMOVIMIENTO`. |
| `USUARIOEMPRESA.PERMISO_GG` | 50 | `S/N` por módulo (contabilidad/RRHH). |
| `USUARIOEMPRESA.MENU_GG_2` | 100 | `S/N` PDV. |
| `USUARIO_CONCEPTO.PERMISO_VARIOS` | 15 | **`'0' = elegido`**, **`'1' = no elegido`** (invertido). |

El **service** `permisos.service.js` expone `decodeSN/encodeSN`, `decode01/encode01`, `decodeConcepto/encodeConcepto`. **Nunca** manipular estos strings desde controladores ni desde el cliente.

### 5.2 Tablas sin PK (DELETE + INSERT obligatorio)

Por herencia del legacy, las siguientes tablas **no tienen primary key** y no pueden actualizarse fila por fila. El patrón es siempre **DELETE all by iduser + INSERT** los nuevos valores, dentro de una sola transacción:

- `USUARIO_CONCEPTO` — actualmente con upsert tolerante (PK lógica `iduser + idtipomovimiento`); migrar a DELETE+INSERT si se reportan inconsistencias.
- `USUARIO_SUCURSAL` — implementado DELETE+INSERT.
- `USUARIO_DEPOSITO` (salida) — implementado DELETE+INSERT.
- `USUARIO_DEPOSITO1` (entrada) — implementado DELETE+INSERT.

### 5.3 Depósito de salida ⇔ sucursal habilitada

Un usuario sólo puede tener un depósito como **salida** si su sucursal correspondiente está marcada como habilitada en `USUARIO_SUCURSAL`. Validación:

- **Cliente**: checkbox bloqueado + banner de advertencia para filas en conflicto.
- **Servidor**: el modelo `usuarioDeposito.replaceAll()` valida en la misma transacción y descarta silenciosamente las filas inválidas, devolviendo `salidaDescartados[]`.

La **entrada** no tiene esta restricción (el receptor puede pertenecer a otra sucursal).

### 5.4 Pestaña Movimientos visible sólo si el menú lo permite

`AccesosEditor` oculta la pestaña Movimientos si `mnuAdminMovimientos` está deshabilitado en Menú Gestión. Al togglear flags de movimientos en `FlagsTab`, se **sincroniza** automáticamente con los items `mnuAdmMovimientos{0..16}` del menú.

### 5.5 Personalización por usuario sobre rol

Cuando `scope === 'usuario'`, la pestaña Movimientos añade dentro de cada concepto expandido un panel ámbar con 5 controles:

| Campo | UI | Catálogo |
|---|---|---|
| `idtalonario` | Select | `talonario WHERE estado='A'` JOIN `sucursal`. |
| `idvendedor` | Select | `vendedor WHERE estado=1`. |
| `idpersona` | Input numérico | (1M+ registros, no select). |
| `idplanventa` | Select | `planventa WHERE estado=1`. |
| `idcondicion` | Select | `condicion WHERE estado=1`. |

En `scope === 'rol'` los 5 campos no se muestran ni se envían — así, guardar permisos a nivel rol **no pisa** la personalización por usuario (el modelo sólo actualiza columnas presentes en el payload).

### 5.6 Inicialización perezosa

- Si un usuario no tiene fila en `usuarioempresa`, se crea con valores en blanco al primer `GET /accesos/:iduser`.
- Si no tiene filas en `menu_general`, se **copia desde Admin** con `permiso=0` (todo bloqueado por defecto).

### 5.7 Auditoría

Toda alta/baja/cambio operativo (reset clave, reasignación, cambio de perfil) pasa por **`PCD_OPERACIONES`** que registra en `HISTORIAL_USUARIO` (BD `server`). La consulta/visualización del historial está **pendiente**.

### 5.8 Encoding / Firebird 2.5

- Charset `UTF8` en pool y request.
- **No usar comillas dobles** alrededor de identificadores en minúscula: Firebird hace case‑sensitive y rompe la búsqueda. La palabra `SYSTEM` **no es reservada** en 2.5.
- **No usar `AUTONOMOUS TRANSACTION`** desde Node: una transacción por request.

---

## 6. Buenas prácticas aplicadas

- **MVC** estricto: `routes → controller → service → model`.
- **Validación temprana** con Zod en cada endpoint (params + body).
- **JWT** firmados con `HS256`, claims mínimos, expiración corta + refresh.
- **bcrypt** para claves (rehash transparente en login si vienen del legacy).
- **Helmet, CORS, rate‑limit, compression** activos en producción.
- **Manejo central de errores** con códigos HTTP semánticos (`error.middleware`).
- **Logs estructurados** (pino) con `request-id`.
- **Separación de credenciales** por `.env`; jamás en código.
- **Frontend desacoplado**: contrato vía JSON, sin acoplamiento a la BD.
- **Accesibilidad** (a11y): labels, foco visible, navegación por teclado, contraste ≥ 4.5:1.
- **i18n‑ready**: textos en `es` centralizados, fácil migración a `i18next`.
- **Lazy loading** por pestaña en `AccesosEditor` (conceptos, sucursales y depósitos sólo se piden al activar la pestaña).
- **Optimistic UI con `dirty set`**: cada pestaña marca su flag de cambios sin bloquear navegación entre tabs.
- **Transacciones explícitas** desde Node, commit/rollback controlado.

---

## 7. Endpoints

### 7.1 Autenticación

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/auth/login` | iduser + pass → access + refresh. |
| `POST` | `/api/auth/refresh` | Renueva access token. |

### 7.2 Usuarios

| Método | Ruta | Descripción |
|---|---|---|
| `GET`   | `/api/usuarios?busqueda=&idperfil=&estado=` | Lista filtrada. |
| `GET`   | `/api/usuarios/:iduser` | Ficha. |
| `POST`  | `/api/usuarios` | Alta (invoca `PCD_USUARIO`). |
| `PATCH` | `/api/usuarios/:iduser` | Modificación (nombre, apellido, documento). |
| `POST`  | `/api/usuarios/:iduser/baja` | Baja (`PCD_OPERACIONES` idop=2). |
| `POST`  | `/api/usuarios/:iduser/reset-clave` | Reset clave (idop=3). |
| `POST`  | `/api/usuarios/:iduser/reasignar-sucursal` | (idop=5). |
| `POST`  | `/api/usuarios/:iduser/cambiar-perfil` | (idop=6 — reemplaza todo). |
| `POST`  | `/api/usuarios/bloquear-sin-menu` | Bloqueo masivo de usuarios sin `menu_general`. |
| `GET`   | `/api/usuarios/sugerir?nombre=&apellido=` | Sugiere iduser. |
| `GET`   | `/api/usuarios/check-documento?documento=` | Disponibilidad de CI/RUC. |
| `GET`   | `/api/usuarios/:iduser/complemento` | `modo_print/talonario/descuento`. |
| `PATCH` | `/api/usuarios/:iduser/complemento` | Actualiza complemento. |

### 7.3 Accesos (por usuario)

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/accesos/:iduser` | Estado completo (menu + flags + pdv + gg). |
| `PUT` | `/api/accesos/:iduser/menu` | Flags `MENU_GENERAL`. |
| `PUT` | `/api/accesos/:iduser/permisos-generales` | String `PERMISOS`. |
| `PUT` | `/api/accesos/:iduser/movimientos` | String `MOVIMIENTOS`. |
| `PUT` | `/api/accesos/:iduser/pdv` | `MENU_GG_2`. |
| `PUT` | `/api/accesos/:iduser/permiso-gg` | `PERMISO_GG`. |
| `GET` | `/api/accesos/:iduser/conceptos` | Grupos de tipo de movimiento con `permiso_varios` y 5 campos extra. |
| `PUT` | `/api/accesos/:iduser/conceptos` | Upsert tolerante (preserva los 5 campos si no vienen). |
| `GET` | `/api/accesos/:iduser/sucursales` | Catálogo × asignación. |
| `PUT` | `/api/accesos/:iduser/sucursales` | DELETE+INSERT. |
| `GET` | `/api/accesos/:iduser/depositos` | Catálogo × salida × entrada. |
| `PUT` | `/api/accesos/:iduser/depositos` | DELETE+INSERT en ambas tablas, valida regla salida↔sucursal. |

### 7.4 Roles (mismas operaciones contra el iduser de la plantilla)

| Método | Ruta | Descripción |
|---|---|---|
| `GET`    | `/api/roles?estado=` | Lista. |
| `POST`   | `/api/roles` | Alta. |
| `PUT`    | `/api/roles/:idperfil` | Edición. |
| `DELETE` | `/api/roles/:idperfil` | Baja. |
| `GET`    | `/api/roles/:idperfil/accesos` | Estado completo de la plantilla. |
| `PUT`    | `/api/roles/:idperfil/{menu\|permisos-generales\|movimientos\|pdv\|permiso-gg\|conceptos\|sucursales\|depositos}` | Mismos payloads que `/accesos/:iduser/...`. |

### 7.5 Catálogos

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/catalogos/perfiles` | `TIPO_USUARIO` + `Admin` sintético. |
| `GET` | `/api/catalogos/sucursales` | `SUCURSAL WHERE estado=1`. |
| `GET` | `/api/catalogos/depositos` | `DEPOSITO WHERE estado=1` (incluye `idsucursal`). |
| `GET` | `/api/catalogos/talonarios` | `TALONARIO WHERE estado='A'` JOIN `SUCURSAL`. |
| `GET` | `/api/catalogos/vendedores` | `VENDEDOR WHERE estado=1`. |
| `GET` | `/api/catalogos/planventas` | `PLANVENTA WHERE estado=1`. |
| `GET` | `/api/catalogos/condiciones` | `CONDICION WHERE estado=1`. |
| `GET` | `/api/catalogos/permisos-generales` | `TMP$USUARIO_PERMISOS_GENERALES`. |
| `GET` | `/api/catalogos/permisos-pdv` | `TMP$USUARIO_PERMISOS_PDV`. |
| `GET` | `/api/catalogos/menu-base/:idperfil` | Plantilla de menú del perfil. |

### 7.6 Configuración del entorno

| Método | Ruta | Descripción |
|---|---|---|
| `GET`    | `/api/configuracion` | Lista todas las IPs. |
| `GET`    | `/api/configuracion/:ip` | Detalle. |
| `POST`   | `/api/configuracion` | Alta. |
| `PUT`    | `/api/configuracion/:ip` | Edición. |
| `DELETE` | `/api/configuracion/:ip` | Baja. |
| `GET`    | `/api/configuracion/autorizado` | Verifica si la IP cliente está autorizada (flag `AUTORIZADO`). |

---

## 8. Puesta en marcha

### Requisitos

- Node.js **≥ 20**, npm ≥ 10.
- Firebird **2.5 / 3.0 / 4.0** accesible por TCP/3050.
- BDs `system_*.fdb` y `server_*.fdb` del cliente.

### Instalación

```powershell
# 1) Dependencias
npm install              # raíz (monorepo)
npm install --prefix server
npm install --prefix client

# 2) .env
Copy-Item server\.env.example server\.env
Copy-Item client\.env.example client\.env
# editar credenciales

# 3) Dev (ambos en paralelo)
npm run dev
```

| Script raíz | Acción |
|---|---|
| `npm run dev` | Inicia `server` (puerto 3001) + `client` (puerto 5173) en paralelo. |
| `npm run build` | Build de producción del cliente; copia a `server/public/` si corresponde. |
| `npm run lint` | ESLint en ambos workspaces. |

### Troubleshooting frecuente

| Síntoma | Causa común | Solución |
|---|---|---|
| `error interno del servidor` en Configuración | Tabla referenciada en otra BD; comillas `"system"` case-sensitive | Verificar `BD` correcta (`server`/`system`); quitar comillas en identificadores. |
| Puerto 5175 ocupado | Otra instancia de Vite corriendo | `Get-NetTCPConnection -LocalPort 5175` → `Stop-Process` por PID. |
| Toast "Error guardando" en Accesos | Validación Zod rechazó payload | Revisar logs `pino`: muestra el path del campo inválido. |
| Pestaña Movimientos no aparece | `mnuAdminMovimientos` deshabilitado en Menú | Habilitarlo y guardar; la pestaña se mostrará. |

---

## 9. Backlog / Próximos pasos

Orden sugerido para retomar mañana:

1. **Auditoría / Historial** — pestaña que consulta `HISTORIAL_USUARIO` filtrando por `iduser`, con paginación y filtro por `idoperacion`.
2. **Prueba‑error** — formulario de simulación: dado un usuario y un movimiento, verificar si tiene los permisos necesarios paso a paso (visualización de cada flag evaluado).
3. **Legajos** — vinculación con `LEGAJO` (talento humano): datos personales extendidos, foto, contacto de emergencia, contrato.
4. **Biometría** — enrollment de huellas, sincronización con dispositivos (Suprema / ZKTeco), tabla `BIOMETRICO`.
5. **Importación masiva** — CSV/Excel con validación previa, dry‑run y rollback.
6. **Tests E2E** — Playwright cubriendo: login → alta usuario → asignar rol → editar accesos → guardar → verificar persistencia.
7. **Migrar `USUARIO_CONCEPTO` a DELETE+INSERT** (consistencia con sucursales/depósitos), preservando los 5 campos extra leyendo previamente del DB.

### Decisiones tomadas (no revisitar)

- Cambio de rol = **Reemplazar todo** (idop=6 ya lo hace en el SP).
- `PERSONA` es input numérico, no select (1M+ registros).
- Botón Accesos en el datagrid + fila naranja al seleccionar.
- Talonario display: `[Sucursal] #IdTalonario (Desde–Hasta) vence DD/MM/AAAA`.
- 5 campos extra de `USUARIO_CONCEPTO` sólo se envían en `scope='usuario'`; en `scope='rol'` se preservan los del usuario.
- Configuración acepta `localhost` además de IPv4.
- Tabla `CONFIGURACION_USUARIO` vive en BD `server` (no `system`), sin columna `version`, sí `version_nro`.

---

## 10. Convenciones de código

- **Imports absolutos** desde `src/` en el cliente.
- **Sin docstrings en código que no se tocó**.
- **No crear archivos markdown** salvo que se pidan explícitamente.
- Componentes React: nombre `PascalCase`, archivo igual al componente.
- Endpoints: kebab-case en URL, camelCase en JSON.
- Toasts en español, mensajes cortos.
- Tipografía compacta en grillas (`text-xs`, `py-0.5`) — imita la densidad del legacy.

---

> Para dudas sobre BD legada o lógica de negocio histórica, consultar `BaseDatos.txt` y el SP `PCD_OPERACIONES` (BD `server`).
