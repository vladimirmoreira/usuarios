# Especificación de Requerimientos — Módulo de Gestión de Usuarios

**Proyecto:** Módulo Usuarios  
**Versión:** 1.0  
**Fecha:** 2026-06-03  
**Estado:** Activo  
**Alcance de bases de datos:** `system_*` · `server_*` · `master_*`

---

## Tabla de Contenidos

1. [Visión General](#1-visión-general)
2. [Base de Datos system](#2-base-de-datos-system_)
3. [Base de Datos server](#3-base-de-datos-server_)
4. [Base de Datos master](#4-base-de-datos-master_-opcional)
5. [Inicialización de Metadatos](#5-inicialización-de-metadatos)
6. [Notas de Configuración](#6-notas-de-configuración)

---

## 1. Visión General

El módulo gestiona el ciclo de vida completo de usuarios en un entorno multi-empresa con Firebird como motor de base de datos. Cada cliente opera con un par de bases de datos (`system_<empresa>` / `server_<empresa>`) y opcionalmente una base `master_<empresa>` para módulos de Contabilidad y Talento Humano.

La capa de acceso a datos reside en **Node.js** (`server/src/`). Los stored procedures del legacy Delphi (`PCD_USUARIO`, `PCD_OPERACIONES`) se mantienen en la BD `server_*` para compatibilidad con el sistema antiguo, pero la lógica de negocio fue reimplementada en los modelos y servicios Node para mayor control y auditoría.

### Convenciones de cadenas posicionales (Firebird)

| Campo | Codificación | Significado |
|---|---|---|
| `PERMISOS` | `S` / `N` | Cada carácter = 1 permiso (S = habilitado) |
| `MOVIMIENTOS` | `S` / `N` | Igual que `PERMISOS` |
| `PERMISO_GG` | `S` / `N` | Igual que `PERMISOS` |
| `MENU_GG_2` | `1` / `0` | Cada carácter = 1 ítem PDV habilitado |
| `PERMISOS` (master) | `1` / `0` | Permisos módulo master |

---

## 2. Base de Datos `system_*`

Contiene la estructura de usuarios, roles y configuración de menús del módulo ERP principal (Gestión Empresarial).

### 2.1 Verificación y creación de tablas

#### `USUARIO`

Verificar que existan las columnas: `IDTIPO_USUARIO`, `CONTROL`, `DOCUMENTO`, `EXCLUSION_PERMISOS`.

```sql
CREATE TABLE USUARIO (
    IDUSER             VARCHAR(10)  NOT NULL,
    NOMBRE             VARCHAR(25),
    APELLIDO           VARCHAR(25),
    IDEMPRESA          VARCHAR(2),
    PASS               VARCHAR(20),
    ESTADO             INTEGER,
    FOTO               BLOB SUB_TYPE 0 SEGMENT SIZE 80,
    IDTIPO_USUARIO     INTEGER,
    CONTROL            SMALLINT,
    DOCUMENTO          VARCHAR(20),
    EXCLUSION          INTEGER,
    EXCLUSION_PERMISOS SMALLINT DEFAULT 0
);
```

#### `USUARIOEMPRESA`

```sql
CREATE TABLE USUARIOEMPRESA (
    IDUSER      VARCHAR(10),
    IDEMPRESA   VARCHAR(2),
    PERMISOS    VARCHAR(50),
    MOVIMIENTOS VARCHAR(20),
    PERMISO_GG  VARCHAR(50) CHARACTER SET ASCII COLLATE ASCII,
    MENU_GG_2   VARCHAR(100),
    MODO_PRINT  SMALLINT,
    TALONARIO   SMALLINT,
    DESCUENTO   SMALLINT
);
```

#### `TIPO_USUARIO`

Verificar que existan todas las columnas, incluyendo `MASTER` y `EDICION_ROL`.

```sql
CREATE TABLE TIPO_USUARIO (
    IDTIPO_USUARIO INTEGER NOT NULL,
    DESCRIPCION    VARCHAR(30),
    IDUSER         VARCHAR(10),
    TIPO           INTEGER,
    ESTADO         INTEGER,
    MASTER         INTEGER DEFAULT 0 NOT NULL,
    EDICION_ROL    SMALLINT
);
ALTER TABLE TIPO_USUARIO ADD PRIMARY KEY (IDTIPO_USUARIO);
```

#### `MENU_GENERAL`

```sql
CREATE TABLE MENU_GENERAL (
    IDMENU_PRINCIPAL INTEGER NOT NULL,
    IDEMPRESA        VARCHAR(2),
    IDUSER           VARCHAR(10),
    IDMENU           VARCHAR(30),
    TITULO           VARCHAR(50),
    PERMISO          SMALLINT
);
ALTER TABLE MENU_GENERAL ADD PRIMARY KEY (IDMENU_PRINCIPAL);
CREATE INDEX IDX_M_G_01 ON MENU_GENERAL (IDUSER);
CREATE INDEX IDX_M_G_02 ON MENU_GENERAL (IDEMPRESA);
CREATE INDEX IDX_M_G_03 ON MENU_GENERAL (IDMENU);
```

#### `TMP$USUARIO_PERMISOS_GENERALES`

> ⚠️ **Firebird dialect 1:** NO usar comillas dobles alrededor del nombre. El signo `$` es válido en identificadores sin comillas en dialect 1.

```sql
CREATE TABLE TMP$USUARIO_PERMISOS_GENERALES (
    IDPERMISO   INTEGER     NOT NULL,
    DESCRIPCION VARCHAR(60),
    CONSTRAINT PK_TMP_PG PRIMARY KEY (IDPERMISO)
);
```

#### `TMP$USUARIO_PERMISOS_PDV`

```sql
CREATE TABLE TMP$USUARIO_PERMISOS_PDV (
    IDPERMISO   INTEGER     NOT NULL,
    DESCRIPCION VARCHAR(60),
    VISIBLE     SMALLINT    DEFAULT 1,
    INDICE      INTEGER     DEFAULT 0,
    CONSTRAINT PK_TMP_PDV PRIMARY KEY (IDPERMISO)
);
```

### 2.2 Generadores

| Generador | Tabla | Columna |
|---|---|---|
| `GEN_MENU_GENERAL` | `MENU_GENERAL` | `IDMENU_PRINCIPAL` |

```sql
CREATE SEQUENCE GEN_MENU_GENERAL;
```

### 2.3 Datos de referencia — `TIPO_USUARIO`

| IDTIPO | Descripción | IDUSER | TIPO | ESTADO | MASTER | EDICION_ROL |
|---|---|---|---|---|---|---|
| 1 | Administracion | ADMNISTRA | 0 | 1 | 0 | 0 |
| 2 | Contabilidad | CONTABLE | 0 | 1 | 0 | 0 |
| 3 | Compras | COMPRAS | 0 | 1 | 0 | 0 |
| 4 | RRHH | RRHH | 0 | 0 | 0 | 0 |
| 5 | Marketing | MARKETING | 0 | 1 | 0 | 0 |
| 6 | Operaciones | OPERACION | 0 | 1 | 0 | 0 |
| 7 | Encargado de Ventas | VENTAS | 1 | 1 | 0 | 1 |
| 8 | Vendedor | SERVICIO | 1 | 1 | 0 | 1 |
| 9 | Logistica | REPARTO | 0 | 1 | 0 | 0 |
| 10 | Caja | CAJA | 1 | 1 | 0 | 1 |
| 11 | Produccion | PRODUCCION | 0 | 1 | 0 | 0 |

> **Campo `TIPO`:** `0` = Gestión Empresarial · `1` = PDV / Punto de Venta · `2` = Contabilidad / RRHH (BD Master).

### 2.4 Datos de referencia — `TMP$USUARIO_PERMISOS_GENERALES`

39 permisos del módulo GE (posiciones 0–38). Gestionados vía inicialización de metadatos (ver §5).

### 2.5 Datos de referencia — `TMP$USUARIO_PERMISOS_PDV`

18 permisos del módulo PDV (índices 0–17). Gestionados vía inicialización de metadatos (ver §5).

### 2.6 Datos de referencia — `TMP$USUARIO_PERMISOS_CONCEPTOS`

15 permisos de acción por concepto (índices 0–14), correspondientes a las posiciones de `USUARIO_CONCEPTO.PERMISO_VARIOS`. Gestionados vía inicialización de metadatos (ver §5). Si la tabla está vacía, el cliente usa una lista de respaldo equivalente.

---

## 3. Base de Datos `server_*`

Contiene el historial de operaciones, la configuración de la instalación, los catálogos operativos y todas las tablas de asignación del usuario a sucursales, depósitos y conceptos. También aloja los stored procedures legacy que interactúan con la BD `system`.

### 3.1 Tablas

#### `CONFIGURACION_USUARIO`

Tabla de configuración por IP de instalación. Una sola fila por entorno operativo típico.

> ⚠️ **Firebird dialect 1:** las columnas `SYSTEM` y `MASTER` son palabras reservadas. En la BD real se llaman **`SYSTEM_BD`** y **`MASTER_BD`**. El modelo Node las alias como `SYS_CFG` y `MASTER` al hacer SELECT.

```sql
CREATE TABLE CONFIGURACION_USUARIO (
    IP                 VARCHAR(20)  NOT NULL,
    SERVER             VARCHAR(60),
    SYSTEM_BD          VARCHAR(60),   -- alias SYS_CFG en el modelo
    MASTER_BD          VARCHAR(60),   -- alias MASTER en el modelo
    USER_BD            VARCHAR(20),
    CLAVE              VARCHAR(60),
    LEGAJO             SMALLINT,
    BIOMETRICO         SMALLINT,
    GASTRONOMIA        SMALLINT,
    MAXIMO             INTEGER,
    VERSION_NRO        VARCHAR(20),
    COMPLEMENTARIO     SMALLINT,
    RUTA_ARCHIVO       VARCHAR(200),
    AUTORIZADO         VARCHAR(10),
    CONTABILIDAD       SMALLINT     DEFAULT 0,
    TALENTO_HUMANO     SMALLINT     DEFAULT 0,
    DIAS_INACTIVIDAD   INTEGER      DEFAULT 90,
    CREAR_SIN_ROL      SMALLINT     DEFAULT 1,
    CLONAR             SMALLINT     DEFAULT 0,
    REPLICAR           SMALLINT     DEFAULT 0,
    METADATA_EJECUTADO SMALLINT     DEFAULT 0 NOT NULL,
    CONSTRAINT PK_CFG_USR PRIMARY KEY (IP)
);
```

> **`CLONAR`** `SMALLINT` (`1`/`0`, default `0`): habilita en la UI la acción **Clonar accesos a otra
> empresa** (misma BD, otra `idempresa`). Ver `UsuarioAPI.clonarAEmpresa`.
> **`REPLICAR`** `SMALLINT` (`1`/`0`, default `0`): habilita el **motor de replicación** a BD destino
> (sucursales server/system/master). A diferencia de clonar, reindexa `ORDEN` y `GG_MESERO.IDSUCURSAL`
> según `CONFIGURACION_USUARIO_REPLICA`. Ambas columnas se agregan en `migrarDDL()` y se exponen en
> `GET /configuracion/flags` (`clonar` / `replicar`).

> **`METADATA_EJECUTADO`:** Cerrojo de inicialización. `0` = pendiente · `1` = completado.  
> Se agrega automáticamente por `migrarDDL()` si la tabla ya existía sin esa columna.

> **`AUTORIZADO`** `VARCHAR(10)`: `iduser` habilitado —además de `ADMIN`— para **ver y editar
> la sección Configuración** y para ejecutar la inicialización de metadatos. Lo consume
> `ConfiguracionModel.isAutorizado()` (`UPPER(TRIM(autorizado)) = UPPER(TRIM(:iduser))`), usado
> por el middleware `requireAuthorized` y por `GET /configuracion/autorizado`. `NULL` = solo `ADMIN`.  
> ⚠️ **Nota de migración:** esta columna estaba solo en el `CREATE TABLE` y faltaba en la lista de
> `ALTER ... ADD` de `migrarDDL()`, por lo que las BD que ya existían (creadas antes) **no la recibían**
> y el listado de Configuración fallaba con `-206 Column unknown`. Se incorporó el
> `ALTER TABLE configuracion_usuario ADD AUTORIZADO VARCHAR(10)` a `migrarDDL()`. Como el proceso
> está gateado por `METADATA_EJECUTADO = 1`, en instalaciones ya inicializadas la columna se agrega
> manualmente con ese mismo `ALTER` (es idempotente).

#### `CONFIGURACION_USUARIO_REPLICA` — destinos del motor de replicación

Una fila por local destino (sucursal). Reemplaza el `RDB$RPL_DESTINO` del legacy Delphi.
La PK `IDSUCURSAL` es el idsucursal **base** del destino y actúa como *offset*: en cada BD
destino ese id es la sucursal propia (ORDEN 1) y desplaza `GG_MESERO.IDSUCURSAL`.

```sql
CREATE TABLE CONFIGURACION_USUARIO_REPLICA (
    IDSUCURSAL INTEGER      NOT NULL,   -- PK: idsucursal base del destino (offset)
    SERVER     VARCHAR(100),            -- ruta/alias BD server_ destino
    SYSTEM     VARCHAR(100),            -- ruta/alias BD system_ destino
    MASTER     VARCHAR(100),            -- ruta/alias BD master_ destino (NULL = no replica a master)
    ESTADO     SMALLINT     NOT NULL,   -- 1 = destino activo
    ORDEN      INTEGER,
    IP         VARCHAR(15),             -- host del destino (VPN)
    CONSTRAINT PK_CFG_USR_REPL PRIMARY KEY (IDSUCURSAL)
);
```

> ⚠️ **dialect 1:** las columnas `SYSTEM` y `MASTER` figuran como reservadas (igual que en
> `CONFIGURACION_USUARIO`, que las renombró a `SYSTEM_BD`/`MASTER_BD`). La tabla ya existe con
> esos nombres; el modelo las lee con alias (`server AS server_bd`, `system AS system_bd`,
> `master AS master_bd`). Si `GET /replicacion/estado` devolviera `-104 token unknown`, renombrar
> a `SERVER_BD`/`SYSTEM_BD`/`MASTER_BD` y ajustar `DEST_COLS` en `models/replicacion.model.js`.
> **Credenciales de destino:** la tabla no guarda usuario/clave; el worker (etapa 2) reutiliza
> `CONFIGURACION_USUARIO.USER_BD` / `CLAVE` del entorno central para autenticarse a cada destino.

#### `REPLICACION_COLA` — outbox de replicación

Un job por (usuario, destino, operación). Encolado por central; drenado por el worker
(etapa 2). Resiliente a VPN caída: si el destino no responde, el job queda `PENDIENTE` y
se reintenta. Gen `GEN_REPLICACION_COLA`.

```sql
CREATE TABLE REPLICACION_COLA (
    ID           INTEGER   NOT NULL,
    IDUSER       VARCHAR(10),
    IDSUCURSAL   INTEGER,              -- destino → CONFIGURACION_USUARIO_REPLICA
    OPERACION    VARCHAR(20),          -- ALTA / BAJA / PERMISOS / RESET_CLAVE / PERFIL / SUCURSAL / DATOS
    PAYLOAD      BLOB SUB_TYPE 1,      -- snapshot JSON de lo que aplicar
    ESTADO       SMALLINT  DEFAULT 0 NOT NULL,
    INTENTOS     INTEGER   DEFAULT 0,
    ULTIMO_ERROR VARCHAR(200),
    FECHA_ALTA   TIMESTAMP,
    FECHA_PROC   TIMESTAMP,
    CONSTRAINT PK_REPL_COLA PRIMARY KEY (ID)
);
```

> **`ESTADO`:** `0` PENDIENTE · `1` PROCESANDO · `2` ENVIADO · `3` ERROR · `4` BLOQUEADO (falta
> dependencia FK que no se pudo replicar). El menú **Replicación** (gateado por el flag `REPLICAR`
> y por `AUTORIZADO`) muestra el conteo por destino y permite reintentar. Endpoints:
> `GET /replicacion/estado`, `GET /replicacion/cola`, `POST /replicacion/cola/:id/reintentar`,
> `POST /replicacion/reintentar-destino`. Modelo `models/replicacion.model.js`.
> **Pendiente (etapa 2):** worker que consume la cola vía conexión Firebird directa a cada destino,
> valida FKs (cascada `RH_CARGO → RH_DPTO → PROFESION/CIUDAD/PAIS/BARRIO/ESTUDIO`) y aplica
> DELETE+INSERT con reindex de ORDEN y offset de `GG_MESERO.IDSUCURSAL` (lógica portada del SP
> legacy `PCD_OPERACIONES`, operación 10).

#### `HISTORIAL_USUARIO`

```sql
CREATE TABLE HISTORIAL_USUARIO (
    ID           INTEGER     NOT NULL,
    USUARIO      VARCHAR(10),
    IDOPERACION  INTEGER     NOT NULL,
    FECHA        DATE        NOT NULL,
    AUTORIZACION VARCHAR(10),
    OBSERVACION  BLOB SUB_TYPE 1 SEGMENT SIZE 80
);
ALTER TABLE HISTORIAL_USUARIO ADD PRIMARY KEY (ID);
```

#### `TIPO_OPERACION`

```sql
CREATE TABLE TIPO_OPERACION (
    IDTIPO_OPERACION INTEGER     NOT NULL,
    DESCRIPCION      VARCHAR(50)
);
ALTER TABLE TIPO_OPERACION ADD PRIMARY KEY (IDTIPO_OPERACION);
```

#### `USUARIO_SUCURSAL` / `USUARIO_DEPOSITO` / `USUARIO_DEPOSITO1`

Sin PK; las operaciones se realizan con DELETE + INSERT en transacción.

```sql
CREATE TABLE USUARIO_SUCURSAL  (IDUSER VARCHAR(10), IDSUCURSAL INTEGER, ORDEN INTEGER);
CREATE TABLE USUARIO_DEPOSITO  (IDUSER VARCHAR(10), IDDEPOSITO INTEGER, ORDEN INTEGER);
CREATE TABLE USUARIO_DEPOSITO1 (IDUSER VARCHAR(10), IDDEPOSITO INTEGER, ORDEN INTEGER);
```

#### `USUARIO_CONCEPTO`

```sql
CREATE TABLE USUARIO_CONCEPTO (
    IDUSER           VARCHAR(10),
    IDTIPOMOVIMIENTO INTEGER,
    PERMISO          SMALLINT,
    IDTALONARIO      INTEGER,
    IDVENDEDOR       INTEGER,
    IDPERSONA        INTEGER,
    IDPLANVENTA      INTEGER,
    IDCONDICION      INTEGER,
    PERMISO_VARIOS   VARCHAR(15)
);
```

> **`PERMISO_VARIOS`:** cadena posicional de 15 caracteres. `'0'` = elegido (true) · `'1'` = no elegido (false).

#### `USUARIO_TURNO_SUCURSAL`

```sql
CREATE TABLE USUARIO_TURNO_SUCURSAL (
    ID         INTEGER     NOT NULL,
    IDUSER     VARCHAR(10),
    IDSUCURSAL INTEGER,
    FECHA      VARCHAR(10)
);
ALTER TABLE USUARIO_TURNO_SUCURSAL ADD CONSTRAINT USUARIO_TURNO_SUCURSAL_PK PRIMARY KEY (ID);
CREATE INDEX IDX_UTS_USER_FECHA ON USUARIO_TURNO_SUCURSAL (IDUSER, FECHA);
```

#### `GG_MESERO` (solo si `GASTRONOMIA = 1`)

```sql
CREATE TABLE GG_MESERO (
    IDMESERO      INTEGER NOT NULL,
    IDUSER        VARCHAR(10),
    NOMBRE        VARCHAR(25),
    APELLIDO      VARCHAR(25),
    NRODOCUMENTO  VARCHAR(20),
    ESTADO        INTEGER,
    CLAVE         VARCHAR(20),
    IDSUCURSAL    INTEGER,
    IDTIPO_MESERO INTEGER,
    RH_IDPERSONA  INTEGER,
    IDCARGO       INTEGER
);
ALTER TABLE GG_MESERO ADD PRIMARY KEY (IDMESERO);
```

#### Tablas de catálogo (solo lectura)

| Tabla | Uso |
|---|---|
| `SUCURSAL` | Catálogo de sucursales |
| `DEPOSITO` | Catálogo de depósitos |
| `TALONARIO` | Personalización de conceptos |
| `VENDEDOR` | Personalización de conceptos |
| `PLANVENTA` | Planes de venta |
| `CONDICION` | Condiciones de venta |
| `TIPOMOVIMIENTO` | Tipos de movimiento para `USUARIO_CONCEPTO`. Requiere columna `ESTADO` (`1` = habilitado); la inicialización de metadatos la crea si falta y la fija en `1`. |
| `REGISTRO` | Log de actividad — base del módulo de inactividad |
| `RH_CARGO` | Vinculación con legajos RRHH |
| `RH_PERSONA` | Personas RRHH (búsqueda por documento) |
| `RH_CARGO_BIO` | Huellas dactilares vinculadas al cargo |

### 3.2 Generadores

| Generador | Tabla | Columna |
|---|---|---|
| `GEN_HISTORIAL_USUARIO` | `HISTORIAL_USUARIO` | `ID` |
| `GEN_GG_MESERO` | `GG_MESERO` | `IDMESERO` |
| `GEN_USUARIO_TURNO_SUCURSAL` | `USUARIO_TURNO_SUCURSAL` | `ID` |

### 3.3 Datos de referencia — `TIPO_OPERACION`

| ID | Descripción |
|---|---|
| 1 | Alta de Usuario |
| 2 | Baja de Usuario |
| 3 | Reinicio de Clave |
| 4 | Eliminación de Huella |
| 5 | Reasignación de Sucursal |
| 6 | Cambio de Perfil |
| 7 | Actualización de Cuenta |
| 8 | Vinculación con Legajo |
| 9 | Exclusion de Cuenta |
| 10 | Migración de Datos |
| 11 | Re-Activar Cuenta |

### 3.4 Stored Procedures legacy

Residen en `server_*` por retrocompatibilidad. **No invocar desde código nuevo.**

| SP | Parámetros | Uso |
|---|---|---|
| `PCD_USUARIO` | `usuario, nombre, apellido, documento, idperfil, idsucursal, foto, rpt_user` | Alta desde sistema Delphi |
| `PCD_OPERACIONES` | `usuario, idoperacion, rpt_user, idsucursal, idperfil, nombre, apellido, documento, foto` | Operaciones desde sistema Delphi |

### 3.5 Equivalencia legacy → Node.js

| Operación | Módulo Node | Archivo |
|---|---|---|
| Alta de usuario | `UsuarioModel.crear` | `models/usuario.model.js` |
| Baja / Re-activar | `OperacionesModel.bajaUsuario` / `reactivar` | `models/operaciones.model.js` |
| Reset de clave | `OperacionesModel.resetClave` | `models/operaciones.model.js` |
| Reasignación de sucursal | `OperacionesModel.reasignarSucursal` | `models/operaciones.model.js` |
| Cambio de perfil | `OperacionesModel.cambiarPerfil` | `models/operaciones.model.js` |
| Eliminación de huella | `OperacionesModel.eliminarHuella` | `models/operaciones.model.js` |
| Vinculación con legajo | `OperacionesModel.vincularLegajo` | `models/operaciones.model.js` |
| Exclusión de permisos | flag `exclusion_permisos` + `AccesosService` | `services/accesos.service.js` |
| Permisos / Menú / PDV / GG | `AccesosController` → `AccesosModel` | `controllers/accesos.controller.js` |
| Conceptos de movimiento | `AccesosModel.conceptos*` | `models/accesos.model.js` |
| Turno / Sucursal (cron) | `TurnoSucursalJob` | `jobs/turnoSucursal.job.js` |
| Inactividad (cron) | `InactividadJob` | `jobs/inactividad.job.js` |
| Replicación a Master | `MasterSyncService` | `services/masterSync.service.js` |
| Inicialización de metadatos | `MetadataService` | `services/metadata.service.js` |

### 3.6 Índices

| Índice | Tabla | Tipo | Script |
|---|---|---|---|
| `IDX_REGISTRO_USUARIO` | `REGISTRO` | ASC | `04_inactividad.sql` |
| `IDX_REGISTRO_FECHA_DESC` | `REGISTRO` | DESC | `04_inactividad.sql` |
| `IDX_UTS_USER_FECHA` | `USUARIO_TURNO_SUCURSAL` | ASC (iduser, fecha) | `06_run_turno_sucursal.js` |
| `USUARIO_TURNO_SUCURSAL_PK` | `USUARIO_TURNO_SUCURSAL` | PK | `06_run_turno_sucursal.js` |

---

## 4. Base de Datos `master_*` (opcional)

Solo activa cuando `MASTER_HOST` y `MASTER_DATABASE` están en `.env` y `TIPO_USUARIO.MASTER = 1` para el rol del usuario.

### 4.1 Tablas

| Tabla | Columnas clave | Uso |
|---|---|---|
| `USUARIO` | `iduser, nombre, apellido, clave, estado, idempresa, menuver` | Espejo de usuarios con acceso a módulos master |
| `USUARIOEMPRESA` | `iduser, idempresa, permisos(9), menu(19), modulos(3), estado` | Permisos posicionales `1/0` |

### 4.2 Cadenas posicionales de master

| Campo | Longitud | Descripción |
|---|---|---|
| `PERMISOS` | 9 | Permisos de administración |
| `MENU` | 19 | Menú (Contabilidad: pos 1-12 · RRHH: pos 13-19) |
| `MODULOS` | 3 | pos1=Sistema(siempre 1) · pos2=Contabilidad · pos3=RRHH |
| `MENUVER` | 10 | pos1=Contabilidad habilitada · pos2=RRHH habilitado |

---

## 5. Inicialización de Metadatos

### 5.1 Descripción

Operación **de demanda**, ejecutable una única vez por instalación, que puebla los catálogos de referencia requeridos para el funcionamiento del módulo. Solo usuarios `ADMIN` o el configurado en `AUTORIZADO` pueden ejecutarla.

### 5.2 Control de ejecución

El campo `CONFIGURACION_USUARIO.METADATA_EJECUTADO` actúa como cerrojo:

| Valor | Significado |
|---|---|
| `0` | Pendiente — la inicialización puede ejecutarse |
| `1` | Completada — nuevas ejecuciones devuelven `HTTP 409` |

### 5.3 Acceso desde la interfaz

**Configuración → pestaña Metadatos** en la interfaz web.

### 5.4 Endpoints REST

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/configuracion/metadata` | Devuelve `{ ejecutado: boolean }` |
| `POST` | `/api/configuracion/metadata/ejecutar` | Ejecuta la inicialización; devuelve `{ ok, detalle }` |

### 5.5 Secuencia de ejecución

```
POST /api/configuracion/metadata/ejecutar
  │
  ├─ Verificar METADATA_EJECUTADO = 0  →  si 1: HTTP 409
  │
  ├─ Transacción BD system
  │    ├─ DELETE + INSERT TMP$USUARIO_PERMISOS_GENERALES  (39 registros)
  │    ├─ DELETE + INSERT TMP$USUARIO_PERMISOS_PDV        (18 registros)
  │    ├─ DELETE + INSERT TMP$USUARIO_PERMISOS_CONCEPTOS  (15 registros)
  │    └─ UPDATE OR INSERT TIPO_USUARIO                   (11 registros)
  │
  ├─ Transacción BD server
  │    ├─ UPDATE OR INSERT TIPO_OPERACION                 (11 registros)
  │    ├─ ALTER TABLE TIPOMOVIMIENTO ADD ESTADO (si falta) + UPDATE estado = 1
  │    └─ UPDATE configuracion_usuario SET metadata_ejecutado = 1
  │
  └─ Auditoría: HISTORIAL_USUARIO (operación 7 — Actualización de Cuenta)
```

### 5.6 Archivos involucrados

| Capa | Archivo | Rol |
|---|---|---|
| Migración SQL | `server/sql/07_metadata_seed.sql` | Agrega campo `METADATA_EJECUTADO` |
| Servicio | `server/src/services/metadata.service.js` | Lógica de seed y consulta de estado |
| Controlador | `server/src/controllers/configuracion.controller.js` | Métodos `estadoMetadata` / `ejecutarMetadata` |
| Rutas | `server/src/routes/configuracion.routes.js` | Rutas `GET /metadata` y `POST /metadata/ejecutar` |
| Modelo | `server/src/models/configuracion.model.js` | Campo `metadata_ejecutado` en COLS y MAP |
| Cliente API | `client/src/api/endpoints.ts` | `ConfiguracionAPI.metadataEstado` / `metadataEjecutar` |
| Cliente UI | `client/src/features/configuracion/ConfiguracionPage.tsx` | Pestaña **Metadatos** |

---

## 6. Notas de Configuración

### 6.1 Variables de entorno requeridas (`.env`)

```dotenv
# BD system_*
SYSTEM_HOST=
SYSTEM_PORT=3050
SYSTEM_DATABASE=
SYSTEM_USER=
SYSTEM_PASSWORD=
SYSTEM_CHARSET=NONE

# BD server_*
SERVER_HOST=
SERVER_PORT=3050
SERVER_DATABASE=
SERVER_USER=
SERVER_PASSWORD=
SERVER_CHARSET=NONE

# BD master_* (opcional)
MASTER_HOST=
MASTER_PORT=3050
MASTER_DATABASE=
MASTER_USER=
MASTER_PASSWORD=
MASTER_CHARSET=NONE
```

### 6.2 Orden de ejecución de migraciones

| N° | Script | BD destino | Descripción |
|---|---|---|---|
| 01 | `01_master_setup.sql` | `system` | Estructura base y datos iniciales |
| 02 | `02_master_menu.sql` | `system` | Configuración del menú general |
| 03 | `03_login_audit.sql` | `server` | Tablas de auditoría de login |
| 04 | `04_inactividad.sql` | `server` | Índices para detección de inactividad |
| 05 | `05_edicion_rol.sql` | `system` | Campo `EDICION_ROL` en `TIPO_USUARIO` |
| 05b | `05_exclusion_permisos.sql` | `system` | Campo `EXCLUSION_PERMISOS` en `USUARIO` |
| 06 | `06_run_turno_sucursal.js` | `server` | Tabla `USUARIO_TURNO_SUCURSAL` e índices |
| **07** | **`07_metadata_seed.sql`** | **`server`** | **Campo `METADATA_EJECUTADO` en `CONFIGURACION_USUARIO`** |

### 6.3 Consideraciones de seguridad

- `CLAVE` de `CONFIGURACION_USUARIO` nunca se expone en respuestas API.
- Los endpoints `/configuracion/*` requieren autenticación JWT + verificación de `AUTORIZADO` / `ADMIN`.
- Las contraseñas de usuario se almacenan en texto plano por restricción del sistema legacy Delphi. No modificar sin coordinar con el equipo de sistemas.
