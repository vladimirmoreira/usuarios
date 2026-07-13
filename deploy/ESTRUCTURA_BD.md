# Estructura de BD — Módulo USUARIO (deploy en cliente nuevo)

Referencia de **qué objetos de base de datos necesita** el módulo USUARIO para
funcionar sobre un cliente nuevo (BD legacy tipo *orgonita*). Todo lo **nuevo** que
agrega el módulo está automatizado en `MetadataService` (`server/src/services/metadata.service.js`)
y se aplica **idempotente** con un endpoint. Este documento sirve como checklist y
para aplicarlo a mano si hiciera falta.

> **Los SP `PCD_USUARIO` / `PCD_OPERACIONES` quedaron DEPRECADOS.** La lógica de alta/
> bajas/operaciones vive ahora en Node (`operaciones.service.js`). El módulo web **no
> los invoca**. No hace falta crearlos en el cliente nuevo (pueden seguir existiendo
> para el Delphi legacy; conviven escribiendo las mismas tablas).

---

## 0) Cómo aplicarlo (camino automático)

El módulo trae un "metadata seed" que crea tablas TMP$, agrega columnas faltantes y
siembra los catálogos. Es **idempotente** e ignora errores de "columna/tabla ya existe".

1. Apuntá el `.env` del server a las 3 BD del cliente (`SYSTEM/SERVER/MASTER_*`).
2. Levantá el backend y logueate como Admin (o un usuario con `AUTORIZADO=1`).
3. Ejecutá:
   - `GET  /api/configuracion/metadata`          → estado (`{ ejecutado }`).
   - `POST /api/configuracion/metadata/ejecutar` → aplica DDL + seeds.
     (Se bloquea si `CONFIGURACION_USUARIO.METADATA_EJECUTADO = 1`.)

Cerrojo: `CONFIGURACION_USUARIO.METADATA_EJECUTADO` (0 = pendiente, 1 = ya corrido).

> ⚠️ **Cuidado:** re-ejecutar **re-siembra** los catálogos TMP$ (DELETE + INSERT). Si
> personalizaste `TMP$USUARIO_PERMISOS_PDV` (ej. Billetera=45, ítems ocultos), no
> vuelvas a correr el seed sin respaldar esas filas.

---

## 1) Prerrequisitos — tablas legacy que YA deben existir

El módulo **lee/escribe** sobre la BD legacy del cliente. Estas tablas deben existir
(vienen del ERP legacy, el módulo no las crea):

**BD SYSTEM** (login / usuarios / menús — `CHARACTER SET ASCII`, se castea a OCTETS):
- `USUARIO` (1 fila por `iduser`, global), `USUARIOEMPRESA` (por empresa),
  `MENU_GENERAL` (por `iduser`+`idempresa`+`idmenu`), `EMPRESAS`, `TIPO_USUARIO`.
- Generador `GEN_MENU_GENERAL`.

**BD SERVER** (operacional / auditoría):
- `SUCURSAL` (incluye col. `LOCAL` — o `ES_LOCAL` en FB5), `DEPOSITO`, `TIPOMOVIMIENTO`,
  `USUARIO_CONCEPTO`, `USUARIO_SUCURSAL`, `USUARIO_DEPOSITO`, `USUARIO_DEPOSITO1`,
  `GG_MESERO` (+ gen `GEN_GG_MESERO`), `GG_TIPO_MESERO`,
  `TALONARIO`, `VENDEDOR`, `PLANVENTA`, `CONDICION`, `REGISTRO` (para inactividad),
  `RH_PERSONA`, `RH_CARGO`, `RH_CARGO_BIO` (si se usa Legajo/Biométrico).

**BD MASTER** (Contab./RRHH — opcional; solo si el cliente usa esos módulos):
- `USUARIO`, `USUARIOEMPRESA`, `EMPRESA` (singular).

---

## 2) Objetos que AGREGA el módulo (lo nuevo)

Todo esto lo aplica `MetadataService.migrarDDL()`. Se lista el DDL exacto por si se
corre a mano (dialect 1 → `TIMESTAMP` en vez de `DATE`, `SMALLINT` en vez de `BOOLEAN`).

### 2.1 BD SYSTEM

```sql
-- Catálogos TMP$
CREATE TABLE TMP$USUARIO_PERMISOS_GENERALES (
  IDPERMISO INTEGER NOT NULL, DESCRIPCION VARCHAR(60) NOT NULL,
  CONSTRAINT PK_TMP_PG PRIMARY KEY (IDPERMISO));
CREATE TABLE TMP$USUARIO_PERMISOS_PDV (
  IDPERMISO INTEGER NOT NULL, DESCRIPCION VARCHAR(60) NOT NULL,
  VISIBLE SMALLINT DEFAULT 1, INDICE INTEGER DEFAULT 0,
  CONSTRAINT PK_TMP_PDV PRIMARY KEY (IDPERMISO));
CREATE TABLE TMP$USUARIO_PERMISOS_CONCEPTOS (
  IDPERMISO_CONCEPTO INTEGER NOT NULL, DESCRIPCION VARCHAR(60) NOT NULL,
  CONSTRAINT PK_TMP_PC PRIMARY KEY (IDPERMISO_CONCEPTO));

-- Columnas nuevas en TIPO_USUARIO (roles)
ALTER TABLE tipo_usuario ADD iduser      VARCHAR(10);   -- usuario-plantilla del rol
ALTER TABLE tipo_usuario ADD tipo        SMALLINT DEFAULT 0;  -- 0=Gestión, 1=PDV, 2=Master
ALTER TABLE tipo_usuario ADD estado      SMALLINT DEFAULT 1;
ALTER TABLE tipo_usuario ADD master      INTEGER  DEFAULT 0;  -- 1 = replica a MASTER
ALTER TABLE tipo_usuario ADD edicion_rol SMALLINT DEFAULT 0;  -- 1 = permisos solo por rol

-- Columnas nuevas en USUARIO
ALTER TABLE usuario ADD estado             SMALLINT DEFAULT 1;
ALTER TABLE usuario ADD documento          VARCHAR(20);
ALTER TABLE usuario ADD exclusion_permisos INTEGER  DEFAULT 0;  -- 1 = permisos personalizados
ALTER TABLE usuario ADD hasta_vigencia     TIMESTAMP;           -- caducidad de acceso

-- Columna nueva en EMPRESAS (login multi-empresa)
ALTER TABLE empresas ADD accesible SMALLINT DEFAULT 1;  -- 1 = elegible en el combo de login
```

### 2.2 BD SERVER

```sql
-- Config por IP (instalación): conexión + flags de comportamiento
CREATE TABLE configuracion_usuario (
  IP VARCHAR(20) NOT NULL, SERVER VARCHAR(60), SYSTEM_BD VARCHAR(60), MASTER_BD VARCHAR(60),
  USER_BD VARCHAR(20), CLAVE VARCHAR(60),
  LEGAJO SMALLINT DEFAULT 0, BIOMETRICO SMALLINT DEFAULT 0, GASTRONOMIA SMALLINT DEFAULT 0,
  COMPLEMENTARIO SMALLINT DEFAULT 0, MAXIMO INTEGER, RUTA_ARCHIVO VARCHAR(200),
  VERSION_NRO VARCHAR(20), AUTORIZADO VARCHAR(10),
  CONTABILIDAD SMALLINT DEFAULT 0, TALENTO_HUMANO SMALLINT DEFAULT 0,
  DIAS_INACTIVIDAD INTEGER DEFAULT 90, METADATA_EJECUTADO SMALLINT DEFAULT 0 NOT NULL,
  CONSTRAINT PK_CFG_USR PRIMARY KEY (IP));
-- Si ya existía sin estas columnas, se agregan:
ALTER TABLE configuracion_usuario ADD METADATA_EJECUTADO SMALLINT DEFAULT 0 NOT NULL;
ALTER TABLE configuracion_usuario ADD CONTABILIDAD   INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE configuracion_usuario ADD TALENTO_HUMANO INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE configuracion_usuario ADD DIAS_INACTIVIDAD INTEGER DEFAULT 90;
ALTER TABLE configuracion_usuario ADD SYSTEM_BD VARCHAR(60);
ALTER TABLE configuracion_usuario ADD MASTER_BD VARCHAR(60);
ALTER TABLE configuracion_usuario ADD CLAVE     VARCHAR(60);
ALTER TABLE configuracion_usuario ADD AUTORIZADO VARCHAR(10);
ALTER TABLE configuracion_usuario ADD MAIL_RESETCLAVE SMALLINT DEFAULT 0;
ALTER TABLE configuracion_usuario ADD CREAR_SIN_ROL SMALLINT DEFAULT 1;

-- Auditoría
CREATE TABLE historial_usuario (
  ID INTEGER NOT NULL, USUARIO VARCHAR(10), IDOPERACION INTEGER NOT NULL,
  FECHA TIMESTAMP, AUTORIZACION VARCHAR(10) NOT NULL, OBSERVACION BLOB SUB_TYPE 1,
  CONSTRAINT PK_HIST_USR PRIMARY KEY (ID));
CREATE GENERATOR GEN_HISTORIAL_USUARIO;

-- Catálogo de operaciones (auditoría)
CREATE TABLE tipo_operacion (
  IDTIPO_OPERACION INTEGER NOT NULL, DESCRIPCION VARCHAR(60) NOT NULL,
  CONSTRAINT PK_TIPO_OP PRIMARY KEY (IDTIPO_OPERACION));

-- TIPOMOVIMIENTO: requerido por la pestaña Movimientos/Conceptos (filtra estado=1)
ALTER TABLE tipomovimiento ADD ESTADO SMALLINT DEFAULT 1;
```

### 2.3 BD MASTER (solo si el cliente usa Contab./RRHH)

```sql
CREATE TABLE TMP$USUARIO_PERMISOS_MASTER (
  POSICION INTEGER NOT NULL, TITULO VARCHAR(60) NOT NULL, GRUPO VARCHAR(20) NOT NULL,
  CONSTRAINT PK_TMP_PERM_MASTER PRIMARY KEY (POSICION));
CREATE TABLE TMP$USUARIO_MENU_MASTER (
  POSICION INTEGER NOT NULL, TITULO VARCHAR(60) NOT NULL, MODULO INTEGER NOT NULL,
  CONSTRAINT PK_TMP_MENU_MASTER PRIMARY KEY (POSICION));

-- Mapeo empresa MASTER ← empresa SYSTEM (multi-empresa). NULL/0 = no mapeada.
ALTER TABLE empresa ADD idempresa_system VARCHAR(2);
```

---

## 3) Seeds (catálogos que siembra el módulo)

| BD | Tabla | Filas | Contenido |
|----|-------|-------|-----------|
| system | `TMP$USUARIO_PERMISOS_GENERALES` | 39 | permisos GE (índices 0–38) |
| system | `TMP$USUARIO_PERMISOS_PDV`        | 18 | permisos PDV (idpermiso 3..50; ver nota) |
| system | `TMP$USUARIO_PERMISOS_CONCEPTOS`  | 15 | acciones por concepto (0–14) |
| system | `TIPO_USUARIO`                    | 11 + `-1` | roles base + "Sin Asignación" (`-1`) |
| server | `TIPO_OPERACION`                  | 11 | operaciones de auditoría |
| server | `TIPOMOVIMIENTO.ESTADO`           | —  | set `estado=1` donde estaba NULL |
| master | `TMP$USUARIO_PERMISOS_MASTER`     | 9  | permisos Contab./RRHH |
| master | `TMP$USUARIO_MENU_MASTER`         | 19 | menú Contab./RRHH |

> **PDV posicional:** `USUARIOEMPRESA.MENU_GG_2` se posiciona por **`idpermiso`**
> (ítem N → `menu_gg_2[N-1]`), **no** por `indice`. El seed trae un catálogo base; en
> orgonita fue ajustado (ej. Billetera=45). Revisar `TMP$USUARIO_PERMISOS_PDV` según el
> menú PDV real del cliente.

También, en `ejecutar()` (post-seed, BD system):
- Crea `TIPO_USUARIO(-1, 'Sin Asignacion')` si falta; normaliza usuarios legacy sin rol
  (`idtipo_usuario NULL → -1`, excepto ADMIN).
- Vigencia por defecto: activos/bloqueados → `2050-12-31`; inactivos → fecha actual.

---

## 4) Formatos de strings posicionales (importante)

| Campo | Long. | Codificación |
|-------|-------|--------------|
| `USUARIOEMPRESA.PERMISOS`    | 50 | `S/N` por posición |
| `USUARIOEMPRESA.MOVIMIENTOS` | 20 | **`0/1`** por posición (índice = `tipo` de TIPOMOVIMIENTO) |
| `USUARIOEMPRESA.PERMISO_GG`  | 50 | `S/N` |
| `USUARIOEMPRESA.MENU_GG_2`   | 100 | **`0/1`**, posición = **`idpermiso`** del catálogo PDV |
| `USUARIO_CONCEPTO.PERMISO_VARIOS` | 15 | **`1`=habilitado**, `0`=no |

---

## 5) Índices recomendados (performance)

El módulo se apoya en los PK/índices del legacy. Si el cliente no los tiene, conviene:

```sql
-- SYSTEM
CREATE INDEX IX_MENUGEN_USER_EMP ON MENU_GENERAL (IDUSER, IDEMPRESA);
CREATE INDEX IX_UE_USER_EMP      ON USUARIOEMPRESA (IDUSER, IDEMPRESA);
-- SERVER
CREATE INDEX IX_UCONCEPTO_USER   ON USUARIO_CONCEPTO (IDUSER);
CREATE INDEX IX_USUC_USER        ON USUARIO_SUCURSAL (IDUSER);
CREATE INDEX IX_GGMESERO_USER    ON GG_MESERO (IDUSER);
```
(Las tablas TMP$ y nuevas ya llevan su PK.)

---

## 6) Checklist de configuración post-install

1. **`CONFIGURACION_USUARIO`**: al menos 1 fila con los flags del deployment
   (`GASTRONOMIA`, `LEGAJO`, `BIOMETRICO`, `CONTABILIDAD`, `TALENTO_HUMANO`,
   `DIAS_INACTIVIDAD`). El módulo web fija esta fila por selector (no por IP del cliente).
2. **Gate de login**: los usuarios que deben entrar necesitan `MENU_GENERAL` con
   `idmenu = 'mnuArchivoPanelControl'`, `permiso = 1`, para su `idempresa`.
3. **Multi-empresa**: marcá `EMPRESAS.ACCESIBLE = 1` en las empresas elegibles (0 en
   backups/prueba). El combo muestra: `usuarioempresa ∩ accesible=1 ∩ gate`.
4. **MASTER**: `EMPRESA.IDEMPRESA_SYSTEM` = idempresa del system que mapea a esa empresa
   master. Sin mapeo → cae a `.env MASTER_IDEMPRESA` (default `1`).
5. **ADMIN**: debe existir en `USUARIO` (superusuario) con acceso al módulo.

---

## 7) Variables de entorno relevantes (`server/.env`)

```
DEFAULT_IDEMPRESA=1        # empresa por defecto (fallback)
MASTER_IDEMPRESA=1         # empresa MASTER cuando no hay mapeo idempresa_system
SYSTEM_* / SERVER_* / MASTER_*   # conexión a las 3 BD (Firebird)
JWT_SECRET / JWT_REFRESH_SECRET  # secretos (regenerar por instalación)
```
