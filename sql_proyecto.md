# Objetos de Base de Datos — Módulo Usuarios

Referencia de todas las **tablas**, **stored procedures**, **vistas / tablas temporales**, **generadores** y **triggers** que intervienen en el módulo, agrupadas por base de datos.

> Convención: `[R]` = sólo lectura · `[W]` = escritura (INSERT/UPDATE/DELETE) · `[RW]` = ambas.

---

## BD `system_*` (autenticación + estructura de usuarios)

### Tablas

| Tabla | Columnas clave | Uso | Operaciones |
|---|---|---|---|
| `USUARIO` | `iduser, nombre, apellido, pass, estado, idempresa, idtipo_usuario, documento, control, foto, exclusion, exclusion_permisos` | Entidad principal del módulo. `exclusion_permisos` (INTEGER DEFAULT 0) indica si el usuario tiene permisos personalizados distintos al rol. | `[RW]` SELECT, INSERT, UPDATE |
| `USUARIOEMPRESA` | `iduser, idempresa, permisos(50), movimientos(20), permiso_gg(50), menu_gg_2(100), modo_print, talonario, descuento` | Permisos posicionales (strings S/N) y complemento por empresa. | `[RW]` SELECT, INSERT, UPDATE |
| `TIPO_USUARIO` | `idtipo_usuario, descripcion, iduser, tipo, estado, master` | Catálogo de roles/perfiles. `iduser` apunta al usuario-plantilla. | `[RW]` SELECT, INSERT, UPDATE |
| `MENU_GENERAL` | `idmenu_principal, idempresa, iduser, idmenu, titulo, permiso` | Árbol de permisos de menú por usuario. | `[RW]` SELECT, INSERT, UPDATE |

> Los SPs del sistema legacy (`PCD_USUARIO`, `PCD_OPERACIONES`) residen en BD `server` — ver sección correspondiente.

### Generadores (Sequences)

| Generador | Tabla destino | Columna |
|---|---|---|
| `GEN_MENU_GENERAL` | `MENU_GENERAL` | `idmenu_principal` |

### Vistas / Tablas temporales (TMP$)

| Objeto | Tipo | Descripción |
|---|---|---|
| `TMP$USUARIO_PERMISOS_GENERALES` | Vista / tabla global temp | Catálogo de permisos generales (etiquetas de cada posición del string `PERMISOS`). |
| `TMP$USUARIO_PERMISOS_PDV` | Vista / tabla global temp | Catálogo de permisos PDV (`MENU_GG_2`), con columnas `visible`, `indice`. |
| `TMP$USUARIO_PERMISOS_CONCEPTOS` | Vista / tabla global temp | Catálogo de conceptos para `USUARIO_CONCEPTO`. |

---

## BD `server_*` (datos operativos, auditoría, configuración)

### Tablas

| Tabla | Columnas clave | Uso | Operaciones |
|---|---|---|---|
| `HISTORIAL_USUARIO` | `id (GEN_HISTORIAL_USUARIO), usuario, idoperacion, fecha, autorizacion, observacion` | Auditoría de todas las operaciones. Nunca se actualiza ni borra. | `[RW]` INSERT, SELECT (historial paginado) |
| `TIPO_OPERACION` | `idtipo_operacion, descripcion` | Catálogo de 13 tipos de operación. Descripción usada en JOIN con `HISTORIAL_USUARIO`. | `[R]` SELECT (LEFT JOIN en historial) |
| `CONFIGURACION_USUARIO` | `ip, autorizado, master, gastronomia, legajo, biometrico, version_nro, dias_inactividad` | Config por IP de la instalación. `AUTORIZADO=1` habilita operaciones sensibles. | `[RW]` SELECT, INSERT, UPDATE, DELETE |
| `REGISTRO` | `idregistro, fecha, hora, cliente, usuario, modulo, tipo, descripcion, estado` | Log de actividad del sistema legado. Base del módulo de inactividad. | `[R]` GROUP BY / MAX para detección de inactividad |
| `SUCURSAL` | `idsucursal, nombre, estado` | Catálogo de sucursales. | `[R]` SELECT (catálogo + validación depósitos) |
| `DEPOSITO` | `iddeposito, descripcion, idsucursal` | Catálogo de depósitos. Usado para validar relación depósito↔sucursal. | `[R]` SELECT |
| `TALONARIO` | `idtalonario, vencimiento, desde, hasta, idsucursal, estado` | Catálogo de talonarios para personalización de conceptos. | `[R]` SELECT |
| `VENDEDOR` | `idvendedor, nombre, apellido, estado` | Catálogo de vendedores para personalización de conceptos. | `[R]` SELECT |
| `PLANVENTA` | `idplanventa, descripcion, estado` | Catálogo de planes de venta. | `[R]` SELECT |
| `CONDICION` | `idcondicion, descripcion, estado` | Catálogo de condiciones de venta. | `[R]` SELECT |
| `TIPOMOVIMIENTO` | `idtipomovimiento, descripcion, tipo` | Catálogo de tipos de movimiento para `USUARIO_CONCEPTO`. | `[R]` SELECT |
| `USUARIO_SUCURSAL` | `iduser, idsucursal, orden` | Sucursales habilitadas para el usuario (sin PK → DELETE+INSERT). | `[RW]` SELECT, DELETE, INSERT |
| `USUARIO_DEPOSITO` | `iduser, iddeposito, orden` | Depósitos de **salida** (sin PK → DELETE+INSERT). | `[RW]` SELECT, DELETE, INSERT |
| `USUARIO_DEPOSITO1` | `iduser, iddeposito, orden` | Depósitos de **entrada** (sin PK → DELETE+INSERT). | `[RW]` SELECT, DELETE, INSERT |
| `USUARIO_CONCEPTO` | `iduser, idtipomovimiento, permiso, idtalonario, idvendedor, idpersona, idplanventa, idcondicion, permiso_varios(15)` | Permisos por tipo de movimiento + 5 campos de personalización por usuario. | `[RW]` SELECT, INSERT, UPDATE |
| `GG_MESERO` | `idmesero, iduser, nombre, apellido, nrodocumento, estado, clave, idsucursal, idtipo_mesero, rh_idpersona, idcargo` | Espejo de gastronomía (sólo si `GASTRONOMIA=1`). | `[RW]` SELECT, INSERT, UPDATE |
| `RH_CARGO` | `idcargo, idpersona, user_system, estado` | Legajo RRHH — vincula documento a `user_system`. | `[RW]` SELECT, UPDATE |
| `RH_PERSONA` | `idpersona, documento` | Personas de RRHH — búsqueda por documento. | `[R]` SELECT |
| `RH_CARGO_BIO` | `idcargo` | Huella dactilar vinculada al cargo. | `[W]` SELECT, DELETE |
| `USUARIO_TURNO_SUCURSAL` | `id, iduser, idsucursal, fecha` | Asignaciones de sucursal programadas por día. `FECHA` almacenada como `VARCHAR(10)` en formato `'YYYY-MM-DD'`. Una fila por (iduser, fecha); operación de escritura DELETE mes + INSERT en transacción (`reemplazarMes`). | `[RW]` SELECT, DELETE, INSERT |

### Stored Procedures

| SP | Parámetros | Cuándo se invoca |
|---|---|---|
| `PCD_USUARIO` | `iduser, nombre, apellido, documento, idperfil, idsucursal, ?, rptUser` | Alta de usuario. Devuelve `mensaje`. El módulo Node lo llama vía `usuario.model.js`. |
| `PCD_OPERACIONES` | `iduser, idoperacion, rptUser, idsucursal, idperfil, nombre, apellido, documento, NULL` | Operaciones legacy (baja, reset, reasignación, cambio perfil, etc.). Devuelve `mensaje`. |

> **Nota**: parte de las acciones de estos SPs fue reemplazada por código Node directo en `operaciones.model.js`. Ver comentarios en `services/operaciones.service.js`.

### Generadores (Sequences)

| Generador | Tabla destino | Columna |
|---|---|---|
| `GEN_HISTORIAL_USUARIO` | `HISTORIAL_USUARIO` | `id` |
| `GEN_GG_MESERO` | `GG_MESERO` | `idmesero` |
| `GEN_USUARIO_TURNO_SUCURSAL` | `USUARIO_TURNO_SUCURSAL` | `id` |

### Índices creados por este módulo (`04_inactividad.sql`)

| Índice | Tabla | Tipo | Propósito |
|---|---|---|---|
| `IDX_REGISTRO_USUARIO` | `REGISTRO` | ASC | Acelera el `GROUP BY TRIM(UPPER(usuario))` del escaneo de inactividad. |
| `IDX_REGISTRO_FECHA_DESC` | `REGISTRO` | DESC | Acelera el `HAVING MAX(fecha) < DATEADD(...)`. |

### Índices creados por este módulo (`06_run_turno_sucursal.js`)

| Índice | Tabla | Tipo | Propósito |
|---|---|---|---|
| `IDX_UTS_USER_FECHA` | `USUARIO_TURNO_SUCURSAL` | ASC (iduser, fecha) | Acelera la lectura del calendario por usuario/mes y la verificación diaria del cron. |
| `USUARIO_TURNO_SUCURSAL_PK` | `USUARIO_TURNO_SUCURSAL` | PK (id) | Clave primaria via generador `GEN_USUARIO_TURNO_SUCURSAL`. |

---

## BD `master_*` (Contabilidad / RRHH — opcional)

Sólo activa si `MASTER_HOST` y `MASTER_DATABASE` están configurados en `.env`.

### Tablas

| Tabla | Columnas clave | Uso | Operaciones |
|---|---|---|---|
| `USUARIO` | `idusuario, nombre, apellido, clave, estado, menuver(10), idempresa` | Espejo de usuarios para Contabilidad y RRHH. `menuver` = string posicional (pos1=Contab, pos2=RRHH). | `[RW]` SELECT, INSERT, UPDATE |
| `USUARIOEMPRESA` | `idusuario, idempresa, idgrupousuario, permisos(9), menu(19), estado, modulos(3)` | Permisos y módulos habilitados en el sistema master. Strings posicionales distintos a `system`. | `[RW]` SELECT, INSERT, UPDATE |

### Vistas / Tablas temporales (TMP$)

| Objeto | Tipo | Descripción |
|---|---|---|
| `TMP$USUARIO_PERMISOS_MASTER` | Vista / tabla global temp | Catálogo de permisos del master (9 posiciones en `USUARIOEMPRESA.PERMISOS`). |
| `TMP$USUARIO_MENU_MASTER` | Vista / tabla global temp | Catálogo del menú master (19 posiciones en `USUARIOEMPRESA.MENU`). |

---

## Strings posicionales — referencia rápida

| Campo | BD | Long. | Convención | Decodificador JS |
|---|---|---|---|---|
| `USUARIOEMPRESA.PERMISOS` | system | 50 | `S`=habilitado, `N`=bloqueado | `decodeSN / encodeSN` |
| `USUARIOEMPRESA.MOVIMIENTOS` | system | 20 | `S/N`; índice = `TIPOMOVIMIENTO.tipo` | `decodeSN / encodeSN` |
| `USUARIOEMPRESA.PERMISO_GG` | system | 50 | `S/N` por módulo GG | `decodeSN / encodeSN` |
| `USUARIOEMPRESA.MENU_GG_2` | system | 100 | `S/N` PDV | `decodeSN / encodeSN` |
| `USUARIO_CONCEPTO.PERMISO_VARIOS` | system | 15 | **`0`=elegido, `1`=no elegido** (invertido) | `decodeConcepto / encodeConcepto` |
| `USUARIO.MENUVER` | master | 10 | `0/1`; pos1=Contab, pos2=RRHH | manual |
| `USUARIOEMPRESA.PERMISOS` | master | 9 | `0/1` — catálogo `TMP$USUARIO_PERMISOS_MASTER` | manual |
| `USUARIOEMPRESA.MENU` | master | 19 | `0/1` — catálogo `TMP$USUARIO_MENU_MASTER` | manual |
| `USUARIOEMPRESA.MODULOS` | master | 3 | pos1=Sistema, pos2=Contab, pos3=RRHH | manual |

---

## Diagrama de dependencias cruzadas entre BDs

```
system_*                     server_*                                   master_*
────────────────────         ──────────────────────────────────────     ─────────────────
USUARIO                      HISTORIAL_USUARIO ←── audit (Node)         USUARIO
  ├── USUARIOEMPRESA          TIPO_OPERACION (FK lógica en historial)     └── USUARIOEMPRESA
  ├── MENU_GENERAL            CONFIGURACION_USUARIO
  └── TIPO_USUARIO            REGISTRO (lectura inactividad)
                              SUCURSAL
                              DEPOSITO
                              TALONARIO
                              VENDEDOR
                              PLANVENTA
                              CONDICION
                              TIPOMOVIMIENTO
                              USUARIO_SUCURSAL
                              USUARIO_DEPOSITO
                              USUARIO_DEPOSITO1
                              USUARIO_CONCEPTO
                              GG_MESERO (flag gastronomia)
                              RH_CARGO  (flag legajo)
                              RH_PERSONA(flag legajo)
                              RH_CARGO_BIO (flag biometrico)
                              USUARIO_TURNO_SUCURSAL ←── cron turnoSucursal.job.js
                              SP: PCD_USUARIO
                              SP: PCD_OPERACIONES
```

---

## Catálogo de operaciones (`TIPO_OPERACION`)

> Abreviaciones de BD: `[sys]` = `system_*` · `[srv]` = `server_*` · `[mst]` = `master_*` · `[ext]` = sistema externo.
> Los efectos marcados con **[flag]** sólo se ejecutan si ese flag está activo en `CONFIGURACION_USUARIO`.

| ID | Descripción | Efectos por BD | Flags involucrados |
|----|-------------|----------------|-------------------|
| 1 | Alta de Usuario | `[sys]` INSERT USUARIO, USUARIOEMPRESA, MENU_GENERAL · `[srv]` INSERT USUARIO_SUCURSAL, USUARIO_DEPOSITO, USUARIO_DEPOSITO1, USUARIO_CONCEPTO · `[srv]` UPDATE RH_CARGO.user_system **[legajo]** · `[srv]` INSERT GG_MESERO **[gastronomia]** · `[mst]` UPSERT USUARIO+USUARIOEMPRESA **[master]** | siempre + condicionales |
| 2 | Baja de Usuario | `[sys]` UPDATE USUARIO.estado=0 · `[srv]` UPDATE GG_MESERO.estado=0 **[gastronomia]** · `[srv]` DELETE RH_CARGO_BIO **[biometrico]** · `[mst]` UPDATE USUARIO.estado=0 **[master]** | siempre + condicionales |
| 3 | Reinicio de Clave | `[sys]` UPDATE USUARIO.pass · `[srv]` UPDATE GG_MESERO.clave **[gastronomia]** · `[mst]` SYNC USUARIO.clave **[master]** | siempre + condicionales |
| 4 | Eliminación de Huella | `[srv]` DELETE RH_CARGO_BIO | biometrico |
| 5 | Reasignación de Sucursal | `[srv]` DELETE+INSERT USUARIO_SUCURSAL, USUARIO_DEPOSITO, USUARIO_DEPOSITO1 · `[srv]` UPDATE GG_MESERO.idsucursal **[gastronomia]** | siempre + condicionales |
| 6 | Cambio de Perfil | `[sys]` UPDATE USUARIO.idtipo_usuario · `[srv]` UPDATE GG_MESERO.idtipo_mesero **[gastronomia]** · `[mst]` SYNC USUARIOEMPRESA **[master]** | siempre + condicionales |
| 7 | Actualización de Cuenta | `[sys]` UPDATE USUARIO (nombre/apellido/documento) · `[mst]` UPSERT USUARIO **[master]** | siempre + condicionales |
| 8 | Vinculación con Legajo | `[sys]` UPDATE USUARIO.documento · `[srv]` UPDATE RH_CARGO.user_system **[legajo]** · `[srv]` UPDATE GG_MESERO.rh_idpersona+idcargo **[gastronomia]** | siempre + condicionales |
| 9 | Exclusión de Cuenta | `[sys]` UPDATE USUARIO.exclusion=1 | siempre |
| 10 | Migración de Datos | `[ext]` Replicación a servidores destino (pendiente) | siempre |
| 11 | Re-Activar Cuenta | `[sys]` UPDATE USUARIO.estado=1 · `[mst]` UPDATE USUARIO.estado=1 **[master]** | siempre + condicionales |
| 12 | Inicio de Sesión | `[srv]` INSERT HISTORIAL_USUARIO (login OK + IP) | siempre |
| 13 | Intento de Login Fallido | `[srv]` INSERT HISTORIAL_USUARIO (motivo + IP) | siempre |

> `gastronomia` = sólo si `GASTRONOMIA=1` · `legajo` = sólo si `LEGAJO=1` · `biometrico` = sólo si `BIOMETRICO=1` · `master` = sólo si `master_*` está configurado en `.env`.

---

## DDL de objetos creados por este módulo

### `exclusion_permisos` — campo en USUARIO (BD system)

```sql
-- Ejecutado una sola vez al habilitar la funcionalidad de propagación de roles.
-- Usar db.execute() en Firebird dialect 1 (db.query() falla con error -817 para DDL).
ALTER TABLE USUARIO ADD EXCLUSION_PERMISOS INTEGER DEFAULT 0;
```

| Columna | Tipo | Default | Significado |
|---|---|---|---|
| `EXCLUSION_PERMISOS` | `INTEGER` | `0` | `0` = sincronizado con el rol · `1` = permisos personalizados (excluido de última propagación) |

**Constraint Firebird**: el `UPDATE usuario SET exclusion_permisos = ?` lanza error si `DOCUMENTO` es NULL. El servicio de propagación detecta esto y omite ese UPDATE, reportando al usuario en `sin_documento[]`.

---

### `USUARIO_TURNO_SUCURSAL` (BD server)

Tabla creada por el script `server/sql/06_run_turno_sucursal.js` usando `db.execute()`.

```sql
-- Generador
CREATE GENERATOR GEN_USUARIO_TURNO_SUCURSAL;
SET GENERATOR GEN_USUARIO_TURNO_SUCURSAL TO 0;

-- Tabla principal
CREATE TABLE USUARIO_TURNO_SUCURSAL (
  ID         INTEGER       NOT NULL,
  IDUSER     VARCHAR(15)   NOT NULL,
  IDSUCURSAL INTEGER       NOT NULL,
  FECHA      VARCHAR(10)   NOT NULL   -- Formato: 'YYYY-MM-DD'
                                      -- Tipo DATE omitido: no soportado en Dialect 1 DSQL
);

-- PK
ALTER TABLE USUARIO_TURNO_SUCURSAL
  ADD CONSTRAINT USUARIO_TURNO_SUCURSAL_PK PRIMARY KEY (ID);

-- Índice compuesto para consultas por usuario/mes y para el cron diario
CREATE INDEX IDX_UTS_USER_FECHA ON USUARIO_TURNO_SUCURSAL (IDUSER, FECHA);
```

**Restricciones de diseño**:
- Una sola fila por `(IDUSER, FECHA)` — si se necesita cambiar la sucursal de un día se reemplaza el mes completo (`DELETE + INSERT` en transacción única).
- `FECHA` como `VARCHAR(10)` en vez de `DATE` por compatibilidad con Firebird Dialect 1 en DSQL (`db.execute()`).
- No hay FK declarada a `USUARIO` ni a `SUCURSAL` para evitar restricciones que compliquen el reemplazo masivo y la baja de usuarios.

---

## Nuevos endpoints (sesión actual)

### Turnos de sucursal (BD server — USUARIO_TURNO_SUCURSAL)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET`  | `/api/usuarios/:iduser/sucursal-principal` | 🔒 | Sucursal de orden 1 del usuario (`USUARIO_SUCURSAL WHERE orden=1`). Devuelve `{ idsucursal, nombre }` o `null`. |
| `GET`  | `/api/usuarios/:iduser/turnos?anio=&mes=` | 🔒 | Lista las asignaciones del mes (`USUARIO_TURNO_SUCURSAL WHERE iduser AND FECHA LIKE 'YYYY-MM-%'`). |
| `POST` | `/api/usuarios/:iduser/turnos` | 🔒 | Reemplaza el mes completo. Body: `{ anio: number, mes: number, items: Array<{ idsucursal: number, fecha: string }> }`. |

### Propagación de roles (BD system — USUARIO, MENU_GENERAL, USUARIOEMPRESA)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET`  | `/api/roles/:idperfil/usuarios` | 🔒 | Usuarios activos del rol. Devuelve `{ iduser, nombre, apellido, documento, exclusion_permisos }[]`. |
| `POST` | `/api/roles/:idperfil/propagar` | 🔒 | Propaga permisos del rol a los usuarios incluidos. Body: `{ excluidos: string[] }`. Response: `{ propagados: number, excluidos: number, errores: string[], sin_documento: string[] }`. Siempre HTTP 200 con resultados parciales. |

### Auditoría global (BD server — HISTORIAL_USUARIO)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET`  | `/api/auditoria` | 🔒 | Historial paginado de todos los usuarios. Query params: `usuario`, `idoperacion`, `autorizacion`, `desde` (YYYY-MM-DD), `hasta` (YYYY-MM-DD), `page`, `pageSize` (máx. 200). Devuelve `HistorialPage { rows, page, pageSize, total, totalPages }`. |

**Filtrado en Firebird**: se usa `CONTAINING` (subcadena, case-insensitive nativo) en lugar de `LIKE + UPPER()`. Las fechas se castean con `CAST(? AS DATE)` para evitar errores de tipo implícito.

**`HistorialModel.listarGlobal(opts)`** — método en `server/src/models/historial.model.js`:
- Construye cláusula `WHERE` dinámica: sólo agrega condiciones para los parámetros presentes.
- Ejecuta en paralelo (`Promise.all`) la query de datos y la de `COUNT(*)`.
- Columna `descripcion` = `COALESCE(t.descripcion, CAST(h.idoperacion AS VARCHAR(10)))` vía `LEFT JOIN tipo_operacion`.

### Reportes (BD server + system — lectura multi-tabla)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET`  | `/api/reportes/usuario/:iduser` | 🔒 | Ficha completa del usuario: datos básicos, sucursales, depósitos, complemento, vínculos legajo/mesero, accesos completos, historial reciente (25 filas). Todas las sub-consultas en paralelo. |
| `GET`  | `/api/reportes/rol/:idperfil` | 🔒 | Ficha completa del rol: datos básicos, accesos (plantilla del rol), usuarios asignados. |
