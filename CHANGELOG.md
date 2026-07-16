# Changelog

Todos los cambios relevantes de este proyecto se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/)
y las fechas están en formato `AAAA-MM-DD` (zona `America/Asuncion`).

---

## [No publicado] — 2026-07-15

### Agregado — Módulo de Replicación de usuarios a sucursales

Reemplaza el mecanismo legacy `PCD_OPERACIONES` (op.10 "Migración de Datos") por un
motor en Node con cola resiliente. **Desplegado en producción.**

- **Destinos** (`CONFIGURACION_USUARIO_REPLICA`): una fila por local
  (`IDSUCURSAL` pk = offset, `ESTADO`, `ORDEN`, `HOST_SERVER`, `USER_BD`, `CLAVE_BD`,
  `SERVER_BD`, `SYSTEM_BD`, `MASTER_BD`). `MASTER_BD` NULL = ese local no replica a master.
- **Cola outbox** (`REPLICACION_COLA` + `GEN_REPLICACION_COLA`): estados
  `0` PENDIENTE · `1` PROCESANDO · `2` ENVIADO · `3` ERROR · `4` BLOQUEADO.
- **Motor** `services/replicacion.service.js`: lee de central (pools) y escribe a cada BD
  destino por conexión Firebird **ad-hoc** (`config/firebird.js → attachExternal`),
  transacción por BD. **Upsert genérico con introspección** (reemplaza `PCD_GENERA_REPLICA`):
  intersección de columnas origen∩destino + coacción de NOT NULL, tolera esquemas distintos.
  Rutea **SYSTEM_BD** (usuario/usuarioempresa/menu_general), **SERVER_BD** (sucursal/deposito/
  deposito1/concepto/gg_mesero) y **MASTER_BD** (usuario/usuarioempresa RRHH-Contab).
- **Transformaciones:** `ORDEN` recalculado (sucursal/depósito propios del destino = orden 1);
  `GG_MESERO.IDSUCURSAL` = `IDSUCURSAL` del destino (offset por local), preservando `IDMESERO`.
- **Guardas FK** (nunca escribe sin ratificar): `SUCURSAL`/`DEPOSITO`, `RH_PERSONA`/`RH_CARGO`
  del mesero, y en `USUARIO_CONCEPTO` el `TIPOMOVIMIENTO` (omite el concepto si falta) + FKs
  opcionales (talonario/vendedor/rh_persona/planventa/condicion → anula; `<=0` = sin referencia).
  Lo omitido/anulado se reporta como `BLOQUEADO`.
- **Worker** `jobs/replicacion.job.js`: red de seguridad de reintentos (el envío normal es
  inmediato al encolar). Loop auto-programado que relee `CONFIGURACION_USUARIO.TEMPORIZADOR_REPLICACION`
  (min, default 15) en cada ciclo → editable desde la UI sin reiniciar. VPN caída → job sigue
  PENDIENTE y reintenta. Purga los ENVIADO fuera de `RETENCION_REPLICACION_HORAS` (default 48).
- **Dedupe:** `encolar` no duplica si ya hay un PENDIENTE para (usuario, destino) — el worker lee
  en vivo, un pendiente basta.
- **Menú Replicación** (gateado por flag `REPLICAR` + `AUTORIZADO`): grilla de estado por destino
  (Encolado/Procesando/Enviado/Error/Bloqueado) + reintentos. Botón **"Replicar"** en el editor de
  usuario. Endpoints `GET /replicacion/estado`, `/cola`, `POST /replicacion/cola/:id/reintentar`,
  `/reintentar-destino`, `/usuario/:iduser`.

### Agregado — Configuración: flags y parámetros de replicación

- `CONFIGURACION_USUARIO`: `CLONAR`/`REPLICAR` (smallint 1/0), `TEMPORIZADOR_REPLICACION`
  (min, default 15), `RETENCION_REPLICACION_HORAS` (horas, default 48). Todos en `migrarDDL`,
  editor de Configuración y `GET /configuracion/flags`.
- Botón **Clonar** (accesos a otra empresa) del editor de usuario ahora se muestra solo si
  `CLONAR=1`; botón **Replicar** solo si `REPLICAR=1`.

### Agregado — Replicación etapa 2b

- **MASTER_BD**: `escribirMaster()` replica `USUARIO`+`USUARIOEMPRESA` de RRHH/Contab.
- **Retención purgable**: `RETENCION_REPLICACION_HORAS` (default 48); el worker purga los ENVIADO
  vencidos. **Dedupe**: no duplica un PENDIENTE de (usuario, destino). **Guardas FK** en
  `USUARIO_CONCEPTO` (tipomovimiento + opcionales).
- **Roles como dependencia previa**: `escribirSystem` hace upsert de `TIPO_USUARIO` antes del
  `USUARIO` (satisface la FK y sincroniza el rol).
- **Enganche automático**: `services/replicacionTrigger.js` — tras alta/baja/permisos/etc. se
  encola y drena la replicación del usuario (best-effort, gateado por `REPLICAR`).
- **Propagar rol**: al editar un rol se marca un recordatorio (`REPLICACION_ROL_PENDIENTE`); en el
  menú Replicación, botón "Replicar" encola a todos los usuarios del rol con **barra de progreso**
  y **throttling** (`drenarTodo`).
- **UI**: columna "Master" → "Repl. Master" con tooltip (indicador de config, no de éxito).
- `CONFIGURACION_USUARIO.TEMPORIZADOR_REPLICACION` ahora se lee bien de la BD (fix del alias `MIN`
  reservado en dialect 3 que lo dejaba siempre en el default).

### Pendiente — Replicación etapa 2b

- Cascada profunda del legajo (`RH_CARGO → RH_DPTO → PROFESION/CIUDAD/PAIS/BARRIO/ESTUDIO`): hoy si
  falta una dependencia se anula/omite y se marca BLOQUEADO, en vez de replicarla.

---

## [No publicado] — 2026-07-13

### Agregado — Login multi-empresa (2 fases) + empresa MASTER

- **Login en 2 fases** sobre el mismo endpoint `POST /auth/login`: autentica **global**
  (USUARIO es 1 fila por `iduser`) y calcula las **empresas accesibles** =
  `usuarioempresa ∩ EMPRESAS.accesible=1 ∩ gate mnuArchivoPanelControl=1`. Con 1 empresa
  entra directo; con >1 devuelve `{ multiEmpresa, empresas }` y el front muestra un
  **combo**; la fase 2 (`{ iduser, pass, idempresa }`) valida y emite el JWT scopeado
  (no otorga acceso nuevo). El refresh preserva la empresa elegida.
- **`EMPRESAS.ACCESIBLE`** (system): 1 = elegible en el combo (agregado a `migrarDDL`).
- **Empresa MASTER independiente**: `masterSync` traduce la empresa system → empresa
  master vía `MASTER.EMPRESA.idempresa_system` (solo `estado=1` y mapeadas), con
  fallback `env.MASTER_IDEMPRESA` (default `1`). Columna agregada a `migrarDDL` (master).
- Doc nueva: `deploy/ESTRUCTURA_BD.md` — estructura de BD (tablas/columnas/seeds/índices)
  para desplegar el módulo en un cliente nuevo. Los SP `PCD_USUARIO`/`PCD_OPERACIONES`
  quedan **deprecados** (la lógica vive en Node).

### Agregado — "Usuario PDV" a nivel de rol (`GG_MESERO`)

- El editor de rol suma un check **"Usuario PDV"** con un acordeón (**Sucursal
  local** + **Tipo de mesero**). Al activarlo se crea/actualiza la fila plantilla
  del rol en `GG_MESERO` (BD `server`): `nombre='Perfil'`, `apellido=`descripción,
  `estado=1`, `clave='$$$$$$'`, `externo=0`, más sucursal y tipo elegidos.
- Una vez creada, el check queda **fijo** (no se destilda desde acá; la baja va por
  el rol o sus usuarios); los combos sí se pueden editar.
- Nuevos endpoints: `GET /roles/:idperfil/usuario-pdv`, `GET /catalogos/sucursales-locales`
  (detecta columna `local`/`es_local` según Firebird 2.5/5) y `GET /catalogos/tipos-mesero`.
- Nuevo modelo `ggMesero.model.js`.

### Corregido

- **Alta de usuario ya no devuelve 500 con el usuario grabado.** Los post-efectos
  (auditoría, legajo, `GG_MESERO`) del alta unitaria pasan a **best-effort**: si
  fallan, el alta igual responde éxito con `advertencias[]` y se loguea el detalle
  (espejo de `altasBatch`).
- **`idtipo_mesero` para roles PDV nuevos.** `insertarMesero` ya no depende del mapa
  legacy `{7:3,8:1,10:1,6:3}` (solo roles viejos): cualquier rol `tipo_usuario.tipo=1`
  hereda el `idtipo_mesero` configurado en "Usuario PDV" del rol → fallback mapa
  legacy → default `1`. Nunca queda null.
- **`USUARIOEMPRESA.MOVIMIENTOS`** se codificaba como `S/N`; es **`0/1`** por posición.
  Marcar Inventario ahora guarda `1000…` (antes `SNNN…`). *Nota:* re-guardar los roles
  cuyo MOVIMIENTOS se editó con el bug.
- **`USUARIO_CONCEPTO.PERMISO_VARIOS`** estaba **invertido**: ahora `'1'=habilitado`,
  `'0'=no` (antes `true→'0'`).
- **PDV (`MENU_GG_2`)** se posicionaba por `indice`; debe posicionarse por
  **`idpermiso`** (número de ítem legacy): ítem N → `menu_gg_2[N-1]`. El catálogo se
  ordena por `idpermiso`.
- **Menú de reportes malformado.** El app ahora **ignora** los `idmenu` con `__`
  consecutivo (segmento idempresa vacío, p. ej. `mnuRpt__3`) y **deduplica** por
  `idmenu` conservando el primero — en lectura, copia de alta y propagación (replica
  cómo lo ignora el legacy). La limpieza de duplicados del legacy queda a cargo del operador.
- **Propagación de rol**: el modal solo se ofrece si el rol **ya tiene usuarios**
  asignados (un rol recién creado no lo pide).
- **`rol.controller.actualizar`** descartaba `edicion_rol`: ahora se persiste al editar.

### Cambiado

- **Permisos globales por concepto** (Movimientos → Conceptos): el panel ya no
  desaparece cuando no hay conceptos activos; queda **visible y deshabilitado** con
  una guía, y se habilita al elegir conceptos.

## [No publicado] — 2026-07-10 (b)

### Agregado — Catálogos TMP$ de la BD master (Contab./RRHH)

- Se **crearon y sembraron** `TMP$USUARIO_PERMISOS_MASTER` (9 permisos) y
  `TMP$USUARIO_MENU_MASTER` (19 ítems) en la BD **master** (`orgonita_master`), que
  hasta ahora no existían — el panel Contab./RRHH venía funcionando solo con el
  fallback hardcodeado. Ahora el catálogo se lee de la BD y desaparece el ruido de
  log `-204 Table unknown` al abrir el panel.
- La creación + seed se agregó a `MetadataService.migrarDDL()` (bloque **master**,
  guardado por `MASTER_HOST`/`MASTER_DATABASE`; idempotente) para instalaciones
  nuevas. Se mantiene el fallback de `catalogo.model.js` como respaldo.
- **Charset:** los títulos se siembran en **ASCII** (p. ej. "Liquidacion de
  Salarios" sin acento) para evitar *mojibake* al escribir en la BD `CHARACTER SET
  NONE` (ver §5.12). El fallback se alineó a la misma forma ASCII.

## [No publicado] — 2026-07-10

### Cambiado — Menú "Inactividad" → "Incidencias" (vista unificada)

- La página/menú **Inactividad** pasó a llamarse **Incidencias** y ahora unifica
  tres tipos de cuentas que requieren atención, con una columna **Motivo**:
  - **Caducado**: `HASTA_VIGENCIA` ya vencida (activo pendiente de inactivar).
  - **Por caducar**: vigencia a vencer dentro de una ventana configurable
    (nuevo umbral "Por caducar (días)", default 30) — informativo, no inhabilitable.
  - **A inactivar**: sin actividad en `REGISTRO` por más del umbral (lógica previa).
- Backend: nuevo `InactividadModel.listarIncidencias({ diasInactividad, diasPorCaducar, idperfilFiltro })`
  que combina la detección por actividad con la de vigencia (caducados + próximos),
  deduplica por usuario (prioridad caducado > inactividad > por_caducar) y agrega
  `motivo`, `hastaVigencia` y `diasParaCaducar`. El endpoint
  `GET /usuarios/inactividad` ahora acepta `diasPorCaducar` y devuelve esos campos.
- La inhabilitación por lote solo procesa **caducados + a inactivar** (los "por
  caducar" no vencieron aún; su casilla y acción quedan deshabilitadas). La
  re-validación del lote usa la misma vista unificada.
- Columnas de la tabla: Usuario · Nombre · Perfil · **Motivo** · **Vigencia**
  (fecha + "en N d" / "venció hace N d") · **Inactividad** (última fecha + días) ·
  Acción. Con un resumen de conteos por motivo arriba.
- Verificado end-to-end: usuarios de prueba clasificados correctamente
  (caducado / por caducar) junto a los inactivos reales.

### Cambiado — Vigencia / Caducidad de usuarios

- **Vigencia por defecto `31/12/2050` para todo usuario nuevo** — se fija en el
  `INSERT` de `USUARIO` (`altaSystemPart` / `altaSinRol`), por lo que aplica al
  **alta unitaria, la importación por lote y "Sin Rol"**. En el alta unitaria el
  formulario también trae `31/12/2050` y el operador puede acortarla antes de
  grabar. Al llegar la fecha, el usuario pasa a **Inactivo (estado 0)**
  (comportamiento del cron existente, sin cambios). Verificado: un usuario
  importado quedó con `hasta_vigencia = 2050-12-31`.
- **Normalización de vigencia para BD legacy** (agregada al seed de metadatos,
  `MetadataService.ejecutar()`, dentro de la tx `system`): a los usuarios sin fecha
  (`hasta_vigencia IS NULL`), excepto Admin y plantillas, se les asigna
  `31/12/2050` si están Activos/Bloqueados (1/2) y `CURRENT_TIMESTAMP` si están
  Inactivos (0). No pisa fechas ya cargadas. **No se ejecutó sobre orgonita** (por
  decisión: solo queda en el código para instalaciones nuevas / próxima
  re-inicialización). Verificado en solo-lectura: afectaría 344 activos/bloqueados
  y 237 inactivos, 0 con fecha previa.
- **Cron de caducidad** (`vigencia.job.js`): horario por defecto cambiado de
  `05:00` a **`04:00`** (`VIGENCIA_CRON`). Ya existía: corre a diario, inhabilita
  (estado 0) a los activos vencidos y deja auditoría *"Baja automática por vigencia
  vencida"* (visible en Auditoría e Historial del usuario). Habilitado por defecto
  (`ENABLE_VIGENCIA_JOB`, poner `0` para desactivar).

### Cambiado — Reportes: Permisos Generales y Conceptos según tipo de ficha

- **Ficha de Rol**: en **Permisos Generales** ahora se muestra **todo el catálogo con
  indicador de check** (☑ activado / ☐ no) en vez de solo los activos, para ver la
  plantilla completa del rol. En **Conceptos por tipo de movimiento**, se listan
  **todos** los conceptos con un check por concepto (los no habilitados quedan
  atenuados). Nuevo componente `ChecklistPermisos` y flag `mostrarTodos` en
  `ConceptosTable` (`FichaUsuarioReporte.tsx`, reutilizado por `FichaRolReporte.tsx`).
- **Ficha de Usuario**: se mantiene mostrando **solo lo activado** — Permisos
  Generales como chips de los marcados, y Conceptos solo los habilitados
  (`permiso = 1`), excluyendo los no habilitados.

### Agregado — Importación: bloqueo si el rol no tiene permisos activos

- **La importación masiva ahora rechaza las filas cuyo rol no tiene ningún permiso
  activo** (`permisos_activos = 0`), con el mensaje *"perfil X no tiene permisos
  activos. Configurá primero los permisos del rol antes de importar."*. Importar
  con un rol vacío dejaría a los usuarios sin accesos. Doble capa:
  - **Servidor** (autoritativo): validación en `UsuarioController.importar` →
    `HTTP 422`, la fila va a la lista de errores y **no se crea ningún usuario**
    del lote (verificado end-to-end).
  - **Cliente** (`ImportarUsuariosModal`): resuelve el perfil de cada fila contra
    el catálogo, marca en ámbar las filas con rol sin permisos y **deshabilita el
    botón «Importar»**.
- Nota: la importación **ya** aplicaba todos los accesos del rol a los usuarios
  importados (menú con permisos, `usuarioempresa`, sucursal, depósitos, conceptos)
  vía la misma alta desde plantilla; esta validación evita el caso de importar
  contra un rol todavía sin configurar.

### Agregado — Cambiar de perfil ahora copia los accesos del rol ("Reemplazar todo")

- **Al asignar un rol real a un usuario, `cambiarPerfil` copia TODOS los accesos de
  la plantilla del rol al usuario** (antes solo re-etiquetaba `idtipo_usuario`,
  perdiendo la semántica "Reemplazar todo" del SP legado). Copia `MENU_GENERAL`,
  `USUARIOEMPRESA` (permisos generales, movimientos, PDV, Contab./RRHH),
  `USUARIO_CONCEPTO` y también `USUARIO_SUCURSAL` + `USUARIO_DEPOSITO` +
  `USUARIO_DEPOSITO1` (línea base de sucursales/depósitos del rol, personalizable
  luego por usuario), y marca al usuario como sincronizado (`exclusion_permisos = 0`).
  Solo aplica a roles reales (`idperfil > 0`): "Sin Rol" (0) y "Sin Asignación" (-1)
  no tienen plantilla.
- **Respeta el bloqueo "Personalizado".** Si el usuario tiene `exclusion_permisos = 1`
  (marcado como personalizado desde «Propagar»), `cambiarPerfil` cambia el perfil
  pero **NO** copia los accesos del rol (preserva su configuración propia) y
  devuelve un `detalle` que el editor muestra al operador. Para reemplazarlos, hay
  que incluirlo explícitamente desde «Propagar» del rol. (La propagación ya
  respetaba este bloqueo vía las casillas del modal.)
- Se extrajo el bloque de copia por usuario de `propagarDesdeRol` a un helper
  reutilizable `AccesosService._copiarPlantillaAUsuario` (que ahora **también copia
  sucursales/depósitos** vía `INSERT ... SELECT` desde la plantilla), y se expone
  `AccesosService.aplicarRolAUsuario(iduser, idperfil)`. `OperacionesService.cambiarPerfil`
  lo invoca tras el cambio de etiqueta (best-effort: si la copia falla, el cambio
  de perfil no se revierte y se sugiere usar «Propagar» desde el rol). **Nota:** al
  compartir el helper, la propagación (`propagarDesdeRol`) también reemplaza ahora
  sucursales/depósitos del usuario con los del rol.
- Con esto, sacar a un usuario "Sin Asignación" (-1) de su limbo asignándole un rol
  le deja los accesos del rol listos de una sola vez.
- Verificado end-to-end: asignar el rol PRODUCCION a un usuario en blanco copió el
  menú (131 ítems, 8 activos), `usuarioempresa`, los 5 conceptos, **6 sucursales y
  10+10 depósitos** — idénticos a la plantilla.

### Agregado — Usuarios "Sin Asignación" (legado) visibles y reasignables

- **Normalización de usuarios heredados sin rol.** La inicialización de metadatos
  (`MetadataService.ejecutar()`), antes de marcar `METADATA_EJECUTADO = 1` y dentro
  de la transacción `system`, ejecuta
  `UPDATE usuario SET idtipo_usuario = -1 WHERE idtipo_usuario IS NULL AND iduser <> 'ADMIN'`.
  Convierte los usuarios legados con `idtipo_usuario = NULL` en `-1`
  ("Sin Asignación"), **excepto Admin** (que se mantiene en `NULL`). Asegura primero
  la fila `-1` en `tipo_usuario` (sin pisar su descripción). Informa el conteo en
  `detalle.usuarios_sin_rol`. (En la BD ya inicializada de orgonita se aplicó el
  mismo `UPDATE` a mano: 341 usuarios `NULL` → `-1`.)
- **Los `-1` ahora SÍ aparecen en la grilla, pero con la fila deshabilitada.** Se
  quitó el filtro `COALESCE(idtipo_usuario,0) <> -1` de `UsuarioModel._listar`
  (las plantillas de rol se siguen excluyendo por su `iduser` en `tipo_usuario` y
  Admin por su `iduser`). En la grilla, un usuario "Sin Asignación" se muestra
  atenuado y con **solo "Modificar / Asignar perfil" habilitado** (Accesos, reset,
  historial, sucursal, baja y selección múltiple quedan bloqueados hasta que tenga
  perfil). La columna Perfil muestra **"Sin Asignación"**.
- **Reasignación:** desde el editor se le puede asignar un **rol real** (con ≥1
  permiso activo) o **"Sin Rol"** (`idtipo_usuario = 0`). Para permitirlo,
  `OperacionesService.cambiarPerfil` acepta `idperfil = 0` (no requiere plantilla;
  solo re-etiqueta) y la ruta `POST /usuarios/:iduser/cambiar-perfil` admite
  `idperfil >= 0`. La opción "Sin Rol" en el editor solo se habilita para usuarios
  que aún no tienen rol real (0 / -1 / null); no permite *degradar* un rol real.
- Verificado end-to-end contra la BD real: la grilla lista los usuarios `-1`
  (383) sin incluir plantillas ni Admin; `cambiarPerfil` de un `-1` a "Sin Rol"
  (0) y luego a un rol real (11) funciona.

### Agregado — Crear usuarios "Sin Rol"

- **Nueva opción de Configuración `Crear usuarios "Sin Rol"`** (`CONFIGURACION_USUARIO.CREAR_SIN_ROL`,
  SMALLINT default **1 = SÍ**). Cuando está activa, el desplegable de Perfil (al
  crear y al editar usuarios) ofrece la opción **"Sin Rol"**. Expuesta en el
  endpoint `GET /configuracion/flags` y editable desde la pestaña Configuración.
- **Alta "Sin Rol":** crea el usuario con `USUARIO.idtipo_usuario = 0` (se eligió
  **0** y no -1 a propósito: -1 marca plantillas de rol y las excluye de grillas y
  reportes; 0 aparece normalmente). Copia todo `MENU_GENERAL` desde Admin con
  `permiso = 0` (igual que un rol nuevo) e inicializa `USUARIOEMPRESA` en blanco;
  no asigna sucursal, depósitos ni conceptos (lienzo en blanco para configurar
  luego en el editor de Accesos). Los menús de Contabilidad/RRHH (master) se
  muestran igualmente en el editor, sin activar. La sucursal es opcional en el
  formulario de alta cuando se elige "Sin Rol".
- **Visualización:** en la grilla de Usuarios la columna Perfil/Rol muestra
  **"Sin Rol"** para estos usuarios (mapeo de `idtipo_usuario = 0`; el Admin real
  tiene `idtipo_usuario = NULL` y queda excluido de la grilla, así que no colisiona
  con el "Administrador" sintético del catálogo). En reportes de Ficha de Usuario
  también se muestra "Sin Rol".
- **Reasignación posterior:** a un usuario "Sin Rol" se le puede asignar un rol
  real más adelante desde el editor (el desplegable ya solo habilita roles con al
  menos un permiso activo). "Sin Rol" en el editor solo se puede *mantener*, no
  asignar a un usuario que ya tiene rol.
- Verificado end-to-end contra la BD real (con commit y limpieza): usuario con
  `idtipo_usuario=0`, `menu_general` copiado (865 filas, 0 con `permiso=1`),
  `usuarioempresa` vacío, sin sucursal/depósito/concepto, auditoría registrada.

### Corregido — Accesos / Reportes / Master

- **Se podía asignar a un usuario un rol sin ningún permiso activo.** El
  desplegable de Perfil (al crear usuario en `AgregarUsuarioModal` y al reasignar
  perfil en `EditarUsuarioModal`) deshabilitaba los roles con `menu_count === 0`,
  pero un rol recién creado tiene `menu_general` **copiado de Admin con todos los
  permisos en `permiso=0`** → `menu_count > 0`, por lo que quedaba habilitado
  aunque no otorgara ningún acceso. Ahora el catálogo `perfiles` expone
  `permisos_activos` (conteo de `menu_general.permiso=1`) y el desplegable solo
  habilita roles con **al menos un permiso activo**; los demás se muestran como
  "(Sin permisos)" y deshabilitados. En el editor se exceptúa el rol que el
  usuario ya tiene asignado para no bloquear su propio valor.

- **Movimientos → "Permisos globales" era editable en usuarios de rol restringido.**
  Cuando el rol tiene `edicion_rol=1` (permisos gestionados solo por el rol), la
  pestaña Movimientos se marca de solo lectura, pero el panel **Permisos globales**
  de conceptos y los botones "Marcar/Desmarcar todos" no respetaban ese flag y
  seguían modificando permisos. Ahora `ConceptosTab` propaga `readOnly` a
  `GlobalPermisosPanel` y oculta/deshabilita esas acciones.
- **Contab./RRHH no recuperaba los permisos desde `orgonita_master`.** Las tablas
  de catálogo `TMP$USUARIO_PERMISOS_MASTER` y `TMP$USUARIO_MENU_MASTER` no existen
  en la BD master del cliente (los seeds `01_master_setup.sql` / `02_master_menu.sql`
  nunca se corrieron ahí), por lo que el catálogo volvía vacío y el panel no
  dibujaba ningún permiso aunque el usuario **sí** los tuviera en master
  (verificado: `usuarioempresa.permisos="111111110"`). Además, aun con las tablas,
  `menuMaster` casteaba `modulo` a texto y el frontend compara `modulo === 1`
  (número), por lo que el menú nunca se agrupaba. Solución: `catalogo.model.js`
  ahora usa un **catálogo de respaldo** hardcodeado (9 permisos + 19 ítems de menú,
  replicando los seeds) cuando las tablas no existen, y devuelve `posicion`/`modulo`
  como **números**.
- **Reportes → Ficha por Usuario: la app se cerraba al buscar.** El filtro del
  buscador llamaba `u.nombre.toUpperCase()` / `u.apellido.toUpperCase()` sin
  proteger `null`; un usuario legado con nombre o apellido nulo hacía crashear el
  render al tipear. Se protegieron con `(u.campo || '')`.
- **Rol/Usuario nuevo mostraba un grupo fantasma "Tipo -1" con los conceptos 26 y
  50.** `tipomovimiento` tiene registros con `tipo = -1` (idtipomovimiento 26
  "Comp. sin Uso" y 50 "EXTRACCION"), que se agrupaban como un tipo inválido y,
  por orden ascendente, aparecían **primero por defecto** en la pestaña
  Movimientos → Conceptos. `ConceptoModel.listarTiposMovimiento` ahora filtra
  `tipo >= 0`.

### Corregido

- **Alta de usuario e importación masiva fallaban siempre (SQL `-204` / `-303`).**
  El backlog lo tenía anotado como "bug -303 en `_altaWork`" con la hipótesis de
  que alguna columna `iduser` era `CHAR(8)`. La introspección de la BD legada
  (`orgonita_system` / `orgonita_server`) descartó esa hipótesis: **todas** las
  columnas `IDUSER` son `VARCHAR(10)` y la generación las limita a 10. Las causas
  reales eran dos:
  - **Bloqueante (`-204 Table unknown`)**: `_altaWork` corría las 7 inserciones
    en una única transacción del pool **system**, pero `USUARIO_SUCURSAL`,
    `USUARIO_DEPOSITO`, `USUARIO_DEPOSITO1` y `USUARIO_CONCEPTO` viven en la BD
    **server**. El alta fallaba en el 4.º paso con *Table unknown, USUARIO_SUCURSAL*
    (reproducido con datos limpios). Afectaba tanto al alta unitaria (`crear`)
    como a la importación por lote.
  - **Truncamiento (`-303 string right truncation`)**: el esquema Zod de la
    importación permitía `apellido` de hasta 50 caracteres, pero `USUARIO.APELLIDO`
    es `VARCHAR(25)`; un apellido de 26–50 chars pasaba validación y truncaba en
    `INSERT INTO usuario` (paso `[USUARIO]`). Ese es el `-303` que veían los
    usuarios de prueba con nombres largos.

  **Solución:**
  - `_altaWork` se dividió en `altaSystemPart` (USUARIO, USUARIOEMPRESA,
    MENU_GENERAL → **system**) y `altaServerPart` (SUCURSAL, DEPÓSITOS, CONCEPTO
    → **server**). El alta ahora usa **dos transacciones anidadas**: la de
    `server` va dentro de la de `system`, de modo que si la parte server falla,
    ambas revierten en cascada. Se preserva el "todo o nada" del lote (la
    importación anida un único par de transacciones para todo el batch).
  - La validación de importación rechaza por fila `nombre`/`apellido` de más de
    25 caracteres, con mensaje claro y registro en el TXT de errores (antes de
    tocar la BD).
  - Verificado end-to-end contra la BD real **con commit**: importados 4 usuarios
    de prueba (template PRODUCCION) → se poblaron las 7 tablas en `system` +
    `server` y la auditoría `HISTORIAL_USUARIO`; la limpieza posterior dejó todo
    en 0. Confirma el commit atómico entre ambas bases.

  > **Pendiente (fuera de este cambio):** escritura de texto acentuado. El driver
  > `node-firebird` conecta en `NONE` y las bases legadas guardan bytes latin1; un
  > `nombre`/`apellido` con acentos escrito desde Node puede quedar como *mojibake*
  > al releerlo (se decodifica latin1 vía OCTETS, ver §5.12 del README). No es el
  > `-303`; es un tema de codificación de escritura a resolver aparte.

---

## [No publicado] — 2026-07-09

### Corregido

- **Configuración del entorno no guardaba varios campos (`Guardar` "no grababa").**
  El esquema Zod de validación en `server/src/routes/configuracion.routes.js`
  declaraba el campo `system`, pero el cliente envía `sys_cfg`, y faltaban
  `contabilidad`, `talento_humano` y `dias_inactividad`. Como el middleware
  `validate` reemplaza `req.body` por el resultado de `schema.parse()` y Zod
  descarta silenciosamente las claves desconocidas, esos campos **nunca
  llegaban al modelo** y no se persistían. Se alineó el esquema con el payload
  real del cliente.
- **La clave de BD se sobrescribía con vacío al editar.** `fromForm()` en
  `ConfiguracionPage.tsx` esparcía `clave: ''` cuando el campo se dejaba en
  blanco (intención: "no cambiar"), pisando la contraseña existente. Ahora la
  clave se **omite por completo** del payload si el campo está vacío.
- **Cierre de sesión inesperado al grabar Rol/Configuración o tras un rato
  inactivo.** El `accessToken` JWT vive 15 minutos y el interceptor de axios
  (`client/src/api/client.ts`) expulsaba al usuario al primer `401`, borrando el
  token y redirigiendo a `/login`. Ahora, ante un `401`, el cliente **renueva el
  token automáticamente** usando el `refreshToken` (7 días, ya emitido en login
  y guardado en `localStorage`) contra `POST /api/auth/refresh`, y **reintenta la
  petición original** de forma transparente. Detalles:
  - Bandera `_retry` por petición para evitar bucles de reintento.
  - Promesa de refresh **compartida** entre peticiones concurrentes (guardar un
    Rol dispara varios `PUT` en paralelo → un único refresh para todos).
  - Se excluyen `/auth/login` y `/auth/refresh` del reintento.
  - Solo si el refresh falla (refreshToken vencido) se limpia la sesión y se va
    al login.

### Cambiado

- **Exportar CSV de usuarios ahora respeta los filtros de la vista.** Antes el
  botón "Exportar CSV" pedía el listado completo al servidor
  (`GET /usuarios/export.csv`) ignorando los filtros aplicados en la grilla.
  Ahora el CSV se genera **en el cliente** a partir de las filas efectivamente
  visibles (filtros por columna, badges de referencia rápida, selección múltiple
  y orden actual), sin paginar. Mantiene el formato compatible con Excel
  (BOM UTF-8 + separador `;` + CRLF) e incluye la columna **Sucursal**. El toast
  informa cuántos registros se exportaron.
  - `UsuariosDataGrid` expone las filas filtradas+ordenadas al contenedor vía la
    nueva prop `onVisibleRowsChange`.
  - `UsuariosPage` acumula esas filas en un `ref` y arma el CSV en
    `exportarFiltrados()`.
  - El endpoint server-side `GET /usuarios/export.csv` sigue existiendo pero el
    cliente ya no lo utiliza.
- **Contador de páginas movido a la barra superior.** En `UsuariosDataGrid` el
  paginador (`‹ 1 / N ›`) pasó de la barra inferior a la barra superior, junto al
  total de registros y el selector de filas por página. Se eliminó la barra
  inferior.
