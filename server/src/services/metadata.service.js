'use strict';

/**
 * Servicio de inicialización de metadatos (Metadata Seed).
 *
 * Puebla las tablas de referencia en las bases de datos system y server
 * con los catálogos base necesarios para el funcionamiento del módulo Usuarios.
 *
 * Tablas afectadas:
 *   - system: TMP$USUARIO_PERMISOS_GENERALES, TMP$USUARIO_PERMISOS_PDV,
 *             TMP$USUARIO_PERMISOS_CONCEPTOS, TIPO_USUARIO
 *   - server: TIPO_OPERACION
 *
 * El campo CONFIGURACION_USUARIO.METADATA_EJECUTADO actúa como cerrojo:
 *   0 → pendiente (permite ejecutar)
 *   1 → ya inicializado (bloquea nueva ejecución)
 */

const { query, transaction, getConnection } = require('../config/firebird');
const logger = require('../utils/logger');

// ── Datos de referencia ──────────────────────────────────────────────────────

/** [idpermiso, descripcion] */
const PERMISOS_GENERALES = [
  [0,  'Agregar'],
  [1,  'Modificar'],
  [2,  'Eliminar'],
  [3,  'Imprimir'],
  [4,  'Agregar (Ayuda en Línea)'],
  [5,  'Modificar (Ayuda en Línea)'],
  [6,  'Administrar Planes de Venta'],
  [7,  'Admin'],
  [8,  'Ventas'],
  [9,  'Cuentas Corrientes'],
  [10, 'Administración de Reportes'],
  [11, 'Anulación Documentos'],
  [12, 'Control de Stock'],
  [13, 'Gestor de Avisos'],
  [14, 'Descuento'],
  [15, 'Compras'],
  [16, 'Estado Control Stock'],
  [17, 'Precio y Comisión'],
  [18, 'Tesorería'],
  [19, 'Administrador de OT'],
  [20, 'No Control Serie'],
  [21, 'Factura Contado - AutoCobro'],
  [22, 'Administración de Serie'],
  [23, 'Supervisor de Usuarios'],
  [24, 'Control Estado (Doc. Legales)'],
  [25, 'Control Estado (Interno)'],
  [26, 'Administrar Libro de Bancos'],
  [27, 'Contabilidad'],
  [28, 'Libro Banco - Conciliación'],
  [29, 'Modifica Cabecera Movimiento'],
  [30, 'Numeración Manual'],
  [31, 'Control de Turno'],
  [32, 'Re-imprimir Factura'],
  [33, 'Carga Recibos-Especial'],
  [34, 'Límite de Crédito'],
  [35, 'Caja Ciega'],
  [36, 'Administrar Producción'],
  [37, 'Sucursal'],
  [38, 'Ver Sucursal/ Reportes'],
];

/** [idpermiso, descripcion, visible, indice] */
const PERMISOS_PDV = [
  [3,  'Bloquear Sistema',  1,  0],
  [4,  'Salir',             1,  1],
  [5,  'Salon',             1,  2],
  [6,  'Delivery',          1,  3],
  [7,  'Carry Out',         1,  4],
  [8,  'Express',           1,  5],
  [12, 'Turno',             1,  6],
  [13, 'Pre-Producción',    1,  7],
  [14, 'KDS',               1,  8],
  [15, 'Marketing',         1,  9],
  [16, 'Eventos',           1, 10],
  [17, 'Menu Diario',       1, 11],
  [42, 'Vendedor',          1, 12],
  [43, 'Mesas',             1, 13],
  [44, 'Billetera',         1, 14],
  [48, 'Cambio de Clave',   1, 15],
  [49, 'Balanza',           1, 16],
  [50, 'Control de Bloqueos', 1, 17],
];

/**
 * [idpermiso_concepto, descripcion]
 * Catálogo de permisos de acción por concepto (USUARIO_CONCEPTO.PERMISO_VARIOS,
 * cadena posicional de 15 caracteres → índices 0..14).
 */
const PERMISOS_CONCEPTOS = [
  [0,  'Detalle de Comprobante Directo'],
  [1,  'Activar Permisos'],
  [2,  'Agregar'],
  [3,  'Modificar'],
  [4,  'Eliminar'],
  [5,  'Anular'],
  [6,  'Imprimir'],
  [7,  'Estado'],
  [8,  'Menu PopUp'],
  [9,  'Autorizar/Rechazar Pedido'],
  [10, 'Informes'],
  [11, 'Registradora'],
  [12, 'Emitir Pagares'],
  [13, 'Generar Facturas'],
  [14, 'Preparar Pedidos'],
];

/**
 * [idtipo_usuario, descripcion, iduser, tipo, estado, master, edicion_rol]
 * Solo se insertan registros que no existan (UPDATE OR INSERT MATCHING pk).
 */
const TIPO_USUARIO = [
  [1,  'Administracion',       'ADMNISTRA',  0, 1, 0, 0],
  [2,  'Contabilidad',         'CONTABLE',   0, 1, 0, 0],
  [3,  'Compras',              'COMPRAS',    0, 1, 0, 0],
  [4,  'RRHH',                 'RRHH',       0, 0, 0, 0],
  [5,  'Marketing',            'MARKETING',  0, 1, 0, 0],
  [6,  'Operaciones',          'OPERACION',  0, 1, 0, 0],
  [7,  'Encargado de Ventas',  'VENTAS',     1, 1, 0, 1],
  [8,  'Vendedor',             'SERVICIO',   1, 1, 0, 1],
  [9,  'Logistica',            'REPARTO',    0, 1, 0, 0],
  [10, 'Caja',                 'CAJA',       1, 1, 0, 1],
  [11, 'Produccion',           'PRODUCCION', 0, 1, 0, 0],
];

/** [idtipo_operacion, descripcion] */
const TIPO_OPERACION = [
  [1,  'Alta de Usuario'],
  [2,  'Baja de Usuario'],
  [3,  'Reinicio de Clave'],
  [4,  'Eliminación de Huella'],
  [5,  'Reasignación de Sucursal'],
  [6,  'Cambio de Perfil'],
  [7,  'Actualización de Cuenta'],
  [8,  'Vinculación con Legajo'],
  [9,  'Exclusion de Cuenta'],
  [10, 'Migración de Datos'],
  [11, 'Re-Activar Cuenta'],
];

// ── Estado ───────────────────────────────────────────────────────────────────

/**
 * Devuelve { ejecutado: boolean } para la primera fila de CONFIGURACION_USUARIO.
 * Si no existe ninguna fila, retorna { ejecutado: false }.
 */
async function obtenerEstado() {
  try {
    const rows = await query(
      'server',
      `SELECT FIRST 1 COALESCE(metadata_ejecutado, 0) AS ejecutado
         FROM configuracion_usuario ORDER BY ip`,
    );
    return { ejecutado: Number(rows[0]?.ejecutado) === 1 };
  } catch (err) {
    logger.warn({ err }, 'MetadataService.obtenerEstado falló');
    return { ejecutado: false };
  }
}

// ── Seed helpers ─────────────────────────────────────────────────────────────

async function seedPermisosGenerales(tx) {
  // Limpieza previa + reinserción completa del catálogo
  await tx.query('DELETE FROM TMP$USUARIO_PERMISOS_GENERALES');
  for (const [idpermiso, descripcion] of PERMISOS_GENERALES) {
    await tx.query(
      'INSERT INTO TMP$USUARIO_PERMISOS_GENERALES (idpermiso, descripcion) VALUES (?, ?)',
      [idpermiso, descripcion],
    );
  }
}

async function seedPermisosPdv(tx) {
  await tx.query('DELETE FROM TMP$USUARIO_PERMISOS_PDV');
  for (const [idpermiso, descripcion, visible, indice] of PERMISOS_PDV) {
    await tx.query(
      'INSERT INTO TMP$USUARIO_PERMISOS_PDV (idpermiso, descripcion, visible, indice) VALUES (?, ?, ?, ?)',
      [idpermiso, descripcion, visible, indice],
    );
  }
}

async function seedPermisosConceptos(tx) {
  await tx.query('DELETE FROM TMP$USUARIO_PERMISOS_CONCEPTOS');
  for (const [idpermiso_concepto, descripcion] of PERMISOS_CONCEPTOS) {
    await tx.query(
      'INSERT INTO TMP$USUARIO_PERMISOS_CONCEPTOS (idpermiso_concepto, descripcion) VALUES (?, ?)',
      [idpermiso_concepto, descripcion],
    );
  }
}

async function seedTipoUsuario(tx) {
  // UPDATE OR INSERT: si ya existe el rol, actualiza; si no, crea.
  for (const [id, desc, iduser, tipo, estado, master, edicion_rol] of TIPO_USUARIO) {
    await tx.query(
      `UPDATE OR INSERT INTO tipo_usuario
         (idtipo_usuario, descripcion, iduser, tipo, estado, master, edicion_rol)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       MATCHING (idtipo_usuario)`,
      [id, desc, iduser, tipo, estado, master, edicion_rol],
    );
  }
}

async function seedTipoOperacion(tx) {
  for (const [id, descripcion] of TIPO_OPERACION) {
    await tx.query(
      `UPDATE OR INSERT INTO tipo_operacion (idtipo_operacion, descripcion)
       VALUES (?, ?) MATCHING (idtipo_operacion)`,
      [id, descripcion],
    );
  }
}

/**
 * Habilita todos los tipos de movimiento existentes (estado = 1).
 * El campo ESTADO se agrega en migrarDDL(); las filas preexistentes quedan
 * en NULL, por lo que aquí se ponen en 1 para que aparezcan en la pestaña
 * Movimientos (AccesosService.obtenerConceptos filtra por estado = 1).
 */
async function seedTipoMovimiento(tx) {
  await tx.query('UPDATE tipomovimiento SET estado = 1 WHERE estado IS NULL');
}

// ── Ejecución principal ───────────────────────────────────────────────────────

/**
 * Ejecuta la inicialización completa de metadatos.
 * Primero verifica que METADATA_EJECUTADO = 0; si ya fue ejecutado lanza error.
 *
 * @returns {{ ok: boolean, detalle: object }}
 */
/**
 * Aplica los ALTER TABLE necesarios antes del seed.
 * Ignora errores de "columna ya existe" (código Firebird 335544351).
 */
async function migrarDDL() {
  // Dialect 1: no soporta DATE → usar TIMESTAMP; no soporta BOOLEAN → usar SMALLINT

  // BD system: tablas que deben existir + columnas adicionales
  const ddlSystem = [
    // Tablas TMP$ — en dialect 1 no usar comillas dobles; $ es válido en nombres de tabla
    `CREATE TABLE TMP$USUARIO_PERMISOS_GENERALES (
       IDPERMISO   INTEGER     NOT NULL,
       DESCRIPCION VARCHAR(60) NOT NULL,
       CONSTRAINT PK_TMP_PG PRIMARY KEY (IDPERMISO)
     )`,
    `CREATE TABLE TMP$USUARIO_PERMISOS_PDV (
       IDPERMISO   INTEGER     NOT NULL,
       DESCRIPCION VARCHAR(60) NOT NULL,
       VISIBLE     SMALLINT    DEFAULT 1,
       INDICE      INTEGER     DEFAULT 0,
       CONSTRAINT PK_TMP_PDV PRIMARY KEY (IDPERMISO)
     )`,
    `CREATE TABLE TMP$USUARIO_PERMISOS_CONCEPTOS (
       IDPERMISO_CONCEPTO INTEGER     NOT NULL,
       DESCRIPCION        VARCHAR(60) NOT NULL,
       CONSTRAINT PK_TMP_PC PRIMARY KEY (IDPERMISO_CONCEPTO)
     )`,
    // Columnas faltantes en TIPO_USUARIO
    `ALTER TABLE tipo_usuario ADD iduser      VARCHAR(10)`,
    `ALTER TABLE tipo_usuario ADD tipo        SMALLINT DEFAULT 0`,
    `ALTER TABLE tipo_usuario ADD estado      SMALLINT DEFAULT 1`,
    `ALTER TABLE tipo_usuario ADD master      INTEGER  DEFAULT 0`,
    `ALTER TABLE tipo_usuario ADD edicion_rol SMALLINT DEFAULT 0`,
    // Columnas faltantes en USUARIO
    `ALTER TABLE usuario ADD estado             SMALLINT DEFAULT 1`,
    `ALTER TABLE usuario ADD documento          VARCHAR(20)`,
    `ALTER TABLE usuario ADD exclusion_permisos INTEGER  DEFAULT 0`,
    `ALTER TABLE usuario ADD hasta_vigencia     TIMESTAMP`,
    // EMPRESAS.ACCESIBLE: 1 = empresa elegible en el login multi-empresa. Estricto:
    // NULL/0 = NO accesible. Marcá 1 en las empresas donde el módulo debe entrar.
    `ALTER TABLE empresas ADD accesible SMALLINT DEFAULT 0`,
    // Bootstrap: empresa 1 (base) accesible, para que la instalación nueva no quede
    // sin ninguna empresa logueable. No pisa valores ya cargados (solo NULL).
    `UPDATE empresas SET accesible = 1
       WHERE CAST(TRIM(idempresa) AS VARCHAR(2) CHARACTER SET OCTETS) = '1' AND accesible IS NULL`,
  ];

  // BD server: tablas que deben existir + columnas adicionales
  const ddlServer = [
    // CONFIGURACION_USUARIO — tabla de configuración por IP
    // SYSTEM_BD / MASTER_BD evitan el conflicto con palabras reservadas en dialect 1
    `CREATE TABLE configuracion_usuario (
       IP               VARCHAR(20)  NOT NULL,
       SERVER           VARCHAR(60),
       SYSTEM_BD        VARCHAR(60),
       MASTER_BD        VARCHAR(60),
       USER_BD          VARCHAR(20),
       CLAVE            VARCHAR(60),
       LEGAJO           SMALLINT     DEFAULT 0,
       BIOMETRICO       SMALLINT     DEFAULT 0,
       GASTRONOMIA      SMALLINT     DEFAULT 0,
       COMPLEMENTARIO   SMALLINT     DEFAULT 0,
       MAXIMO           INTEGER,
       RUTA_ARCHIVO     VARCHAR(200),
       VERSION_NRO      VARCHAR(20),
       AUTORIZADO       VARCHAR(10),
       CONTABILIDAD     SMALLINT     DEFAULT 0,
       TALENTO_HUMANO   SMALLINT     DEFAULT 0,
       DIAS_INACTIVIDAD INTEGER      DEFAULT 90,
       METADATA_EJECUTADO SMALLINT   DEFAULT 0 NOT NULL,
       CONSTRAINT PK_CFG_USR PRIMARY KEY (IP)
     )`,
    // HISTORIAL_USUARIO — auditoría  (dialect 1: TIMESTAMP en lugar de DATE)
    `CREATE TABLE historial_usuario (
       ID           INTEGER      NOT NULL,
       USUARIO      VARCHAR(10),
       IDOPERACION  INTEGER      NOT NULL,
       FECHA        TIMESTAMP,
       AUTORIZACION VARCHAR(10)  NOT NULL,
       OBSERVACION  BLOB SUB_TYPE 1,
       CONSTRAINT PK_HIST_USR PRIMARY KEY (ID)
     )`,
    // Generador para HISTORIAL_USUARIO
    `CREATE GENERATOR GEN_HISTORIAL_USUARIO`,
    // TIPO_OPERACION — catálogo de operaciones
    `CREATE TABLE tipo_operacion (
       IDTIPO_OPERACION INTEGER     NOT NULL,
       DESCRIPCION      VARCHAR(60) NOT NULL,
       CONSTRAINT PK_TIPO_OP PRIMARY KEY (IDTIPO_OPERACION)
     )`,
    // Columnas adicionales en CONFIGURACION_USUARIO si ya existía sin ellas
    `ALTER TABLE configuracion_usuario ADD METADATA_EJECUTADO SMALLINT DEFAULT 0 NOT NULL`,
    `ALTER TABLE configuracion_usuario ADD CONTABILIDAD   INTEGER DEFAULT 0 NOT NULL`,
    `ALTER TABLE configuracion_usuario ADD TALENTO_HUMANO INTEGER DEFAULT 0 NOT NULL`,
    `ALTER TABLE configuracion_usuario ADD DIAS_INACTIVIDAD INTEGER DEFAULT 90`,
    // Si la tabla existía con SYSTEM/MASTER sin sufijo _BD, agregar las variantes con _BD
    `ALTER TABLE configuracion_usuario ADD SYSTEM_BD VARCHAR(60)`,
    `ALTER TABLE configuracion_usuario ADD MASTER_BD VARCHAR(60)`,
    `ALTER TABLE configuracion_usuario ADD CLAVE     VARCHAR(60)`,
    // AUTORIZADO: iduser habilitado (además de Admin) a ver/editar la sección Configuración.
    // Faltaba en la lista de ALTER (solo estaba en el CREATE), por eso no se agregaba en BD ya existentes.
    `ALTER TABLE configuracion_usuario ADD AUTORIZADO VARCHAR(10)`,
    `ALTER TABLE configuracion_usuario ADD MAIL_RESETCLAVE SMALLINT DEFAULT 0`,
    // CREAR_SIN_ROL: 1 = habilita la opción "Sin Rol" en el desplegable de Perfil al crear usuarios.
    `ALTER TABLE configuracion_usuario ADD CREAR_SIN_ROL SMALLINT DEFAULT 1`,
    // CLONAR:   1 = habilita "Clonar accesos a otra empresa" (misma BD, otra idempresa).
    // REPLICAR: 1 = habilita "Replicar usuario a BD destino (sucursal)" — motor de replicación.
    `ALTER TABLE configuracion_usuario ADD CLONAR   SMALLINT DEFAULT 0`,
    `ALTER TABLE configuracion_usuario ADD REPLICAR SMALLINT DEFAULT 0`,
    // TEMPORIZADOR_REPLICACION: minutos entre ciclos del worker de replicación (red de
    // seguridad de reintentos). Editable desde Configuración. Default 15.
    `ALTER TABLE configuracion_usuario ADD TEMPORIZADOR_REPLICACION INTEGER DEFAULT 15`,
    // RETENCION_REPLICACION_HORAS: horas que se conservan los jobs ENVIADO en la cola antes
    // de purgarlos (los ERROR/BLOQUEADO no se purgan). Editable desde Configuración. Default 48.
    `ALTER TABLE configuracion_usuario ADD RETENCION_REPLICACION_HORAS INTEGER DEFAULT 48`,
    // TIPOMOVIMIENTO: campo ESTADO requerido por obtenerConceptos (WHERE estado = 1).
    // Si la tabla ya existía sin la columna, se agrega con default 1.
    `ALTER TABLE tipomovimiento ADD ESTADO SMALLINT DEFAULT 1`,

    // ── Motor de Replicación (destinos + cola) ──────────────────────────────
    // CONFIGURACION_USUARIO_REPLICA: una fila por local destino (sucursal).
    // PK = IDSUCURSAL "base" del destino (offset para ORDEN y GG_MESERO.IDSUCURSAL).
    // Esquema alineado 1:1 con la tabla real del proyecto (reemplaza RDB$RPL_DESTINO).
    //   HOST_SERVER = host del destino (VPN). USER_BD/CLAVE_BD = credenciales del destino.
    //   SERVER_BD / SYSTEM_BD / MASTER_BD = ruta/alias de cada BD destino (MASTER_BD NULL = sin master).
    // La replicación escribe en las TRES BD según la tabla: SYSTEM_BD (usuario, usuarioempresa,
    //   menu_general), MASTER_BD (usuario, usuarioempresa RRHH/Contab), SERVER_BD (gg_mesero,
    //   rh_persona, rh_cargo, barrio, ciudad, usuario_sucursal/deposito/deposito1/concepto, etc.).
    `CREATE TABLE configuracion_usuario_replica (
       IDSUCURSAL  INTEGER      NOT NULL,
       ESTADO      SMALLINT     NOT NULL,
       ORDEN       INTEGER,
       HOST_SERVER VARCHAR(15),
       USER_BD     VARCHAR(30),
       CLAVE_BD    VARCHAR(30),
       SERVER_BD   VARCHAR(100),
       SYSTEM_BD   VARCHAR(100),
       MASTER_BD   VARCHAR(100),
       CONSTRAINT PK_CFG_USR_REPL PRIMARY KEY (IDSUCURSAL)
     )`,

    // REPLICACION_COLA: outbox. Un job por (usuario, destino, operación).
    // ESTADO: 0 PENDIENTE · 1 PROCESANDO · 2 ENVIADO · 3 ERROR · 4 BLOQUEADO (falta dependencia).
    `CREATE TABLE replicacion_cola (
       ID           INTEGER      NOT NULL,
       IDUSER       VARCHAR(10),
       IDSUCURSAL   INTEGER,
       OPERACION    VARCHAR(20),
       PAYLOAD      BLOB SUB_TYPE 1,
       ESTADO       SMALLINT     DEFAULT 0 NOT NULL,
       INTENTOS     INTEGER      DEFAULT 0,
       ULTIMO_ERROR VARCHAR(200),
       FECHA_ALTA   TIMESTAMP,
       FECHA_PROC   TIMESTAMP,
       CONSTRAINT PK_REPL_COLA PRIMARY KEY (ID)
     )`,
    `CREATE GENERATOR GEN_REPLICACION_COLA`,
    `CREATE INDEX IDX_REPL_COLA_ESTADO ON replicacion_cola (ESTADO)`,
    `CREATE INDEX IDX_REPL_COLA_DEST   ON replicacion_cola (IDSUCURSAL)`,

    // REPLICACION_ROL_PENDIENTE: recordatorio de "rol cambiado, pendiente de propagar a
    // sucursales". Se marca al editar el template de un rol; se ejecuta manualmente desde el
    // menú Replicación (encola a todos los usuarios del rol, con throttling y barra de progreso).
    `CREATE TABLE replicacion_rol_pendiente (
       IDTIPO_USUARIO INTEGER      NOT NULL,
       DESCRIPCION    VARCHAR(60),
       FECHA          TIMESTAMP,
       CONSTRAINT PK_REPL_ROL_PEND PRIMARY KEY (IDTIPO_USUARIO)
     )`,
  ];

  const runDDL = (scope, statements) =>
    new Promise((resolve) => {
      getConnection(scope).then((db) => {
        let i = 0;
        const next = () => {
          if (i >= statements.length) { db.detach(); return resolve(); }
          const sql = statements[i++];
          db.query(sql, [], (err) => {
            if (err) {
              const msg = err.message ?? '';
              const ignorar =
                msg.includes('already exists') ||
                msg.includes('already defined') ||
                msg.includes('duplicate value') ||
                msg.includes('Attempt to store duplicate');
              if (!ignorar) logger.warn({ err: msg.slice(0, 200), sql: sql.slice(0, 80) }, 'MetadataDDL warn');
            }
            next();
          });
        };
        next();
      }).catch((err) => {
        logger.warn({ err, scope }, 'MetadataDDL: no se pudo conectar');
        resolve();
      });
    });

  await runDDL('system', ddlSystem);
  await runDDL('server', ddlServer);

  // BD master (opcional): catálogos TMP$ del panel Contab./RRHH. Solo si el pool
  // master está configurado. Títulos en ASCII (sin acentos) para evitar mojibake
  // al escribir en BD CHARACTER SET NONE (ver §5.12). Idempotente (runDDL ignora
  // "already exists" / "duplicate"). Mientras no existan, el código usa el fallback
  // hardcodeado de catalogo.model.js.
  if (process.env.MASTER_HOST && process.env.MASTER_DATABASE) {
    const PERM_MASTER = [
      [1, 'Agregar', 'GENERAL'], [2, 'Modificar', 'GENERAL'], [3, 'Eliminar', 'GENERAL'],
      [4, 'Imprimir', 'GENERAL'], [5, 'Administrador', 'ADMIN'], [6, 'Conf. Reportes', 'ADMIN'],
      [7, 'RRHH Grupos', 'RRHH'], [8, 'RRHH Supervisor', 'RRHH'], [9, 'RRHH Areas', 'RRHH'],
    ];
    const MENU_MASTER = [
      [1, 'Diario', 1], [2, 'Mayor', 1], [3, 'Libro Fiscal', 1], [4, 'Inventario Activo Fijo', 1],
      [5, 'Procesos', 1], [6, 'Sumas y Saldos', 1], [7, 'Estados de Resultados', 1], [8, 'General', 1],
      [9, 'Impositivo', 1], [10, 'Plan de Cuentas', 1], [11, 'Definiciones', 1], [12, 'Propiedades', 1],
      [13, 'Liquidacion de Salarios', 2], [14, 'Movimientos', 2], [15, 'Control de Acceso', 2],
      [16, 'Planilla Seguro Social', 2], [17, 'Libro Laboral', 2], [18, 'Legajo del Personal', 2],
      [19, 'Propiedades', 2],
    ];
    const ddlMaster = [
      `CREATE TABLE TMP$USUARIO_PERMISOS_MASTER (
         POSICION INTEGER NOT NULL, TITULO VARCHAR(60) NOT NULL, GRUPO VARCHAR(20) NOT NULL,
         CONSTRAINT PK_TMP_PERM_MASTER PRIMARY KEY (POSICION))`,
      ...PERM_MASTER.map(([p, t, g]) =>
        `INSERT INTO TMP$USUARIO_PERMISOS_MASTER (POSICION, TITULO, GRUPO) VALUES (${p}, '${t}', '${g}')`),
      `CREATE TABLE TMP$USUARIO_MENU_MASTER (
         POSICION INTEGER NOT NULL, TITULO VARCHAR(60) NOT NULL, MODULO INTEGER NOT NULL,
         CONSTRAINT PK_TMP_MENU_MASTER PRIMARY KEY (POSICION))`,
      ...MENU_MASTER.map(([p, t, m]) =>
        `INSERT INTO TMP$USUARIO_MENU_MASTER (POSICION, TITULO, MODULO) VALUES (${p}, '${t}', ${m})`),
      // EMPRESA.IDEMPRESA_SYSTEM: mapea la empresa MASTER ← empresa SYSTEM (multi-empresa).
      // NULL/0 = no mapeada → el resolver cae a MASTER_IDEMPRESA. La tabla EMPRESA ya
      // existe en el master legacy; acá solo se agrega la columna.
      `ALTER TABLE empresa ADD idempresa_system VARCHAR(2)`,
    ];
    await runDDL('master', ddlMaster);
  }
}

async function ejecutar() {
  // 1. Verificar cerrojo
  const estado = await obtenerEstado();
  if (estado.ejecutado) {
    const err = new Error('Los metadatos ya fueron inicializados. METADATA_EJECUTADO = 1.');
    err.status = 409;
    throw err;
  }

  // 2. Aplicar migraciones DDL (columnas faltantes) — idempotente
  await migrarDDL();

  const detalle = {
    permisos_generales: 0,
    permisos_pdv: 0,
    permisos_conceptos: 0,
    tipo_usuario: 0,
    tipo_operacion: 0,
    tipo_movimiento: 0,
    usuarios_sin_rol: 0,
  };

  // 3. Seed BD system
  await transaction('system', async (tx) => {
    await seedPermisosGenerales(tx);
    detalle.permisos_generales = PERMISOS_GENERALES.length;

    await seedPermisosPdv(tx);
    detalle.permisos_pdv = PERMISOS_PDV.length;

    await seedPermisosConceptos(tx);
    detalle.permisos_conceptos = PERMISOS_CONCEPTOS.length;

    await seedTipoUsuario(tx);
    detalle.tipo_usuario = TIPO_USUARIO.length;

    // Normalizar usuarios heredados sin rol: idtipo_usuario NULL → -1 ("Sin Asignación"),
    // excepto Admin (que se mantiene en NULL como superusuario). Esto evita perfiles en
    // blanco y potenciales conflictos con la lógica de roles. Los usuarios en -1 quedan
    // fuera de la grilla y reportes (COALESCE(idtipo_usuario,0) <> -1), igual que las
    // plantillas de rol. No afecta a los usuarios "Sin Rol" deliberados (idtipo_usuario = 0).
    // Se asegura primero que exista la fila -1 sin pisar su descripción si ya está.
    const existeSinAsig = await tx.query(
      `SELECT FIRST 1 idtipo_usuario FROM tipo_usuario WHERE idtipo_usuario = -1`,
    );
    if (!existeSinAsig.length) {
      await tx.query(
        `INSERT INTO tipo_usuario (idtipo_usuario, descripcion, iduser, tipo, estado, master, edicion_rol)
         VALUES (-1, 'Sin Asignacion', NULL, 0, 1, 0, 0)`,
      );
    }
    const pend = await tx.query(
      `SELECT COUNT(*) AS n FROM usuario WHERE idtipo_usuario IS NULL AND UPPER(TRIM(iduser)) <> 'ADMIN'`,
    );
    await tx.query(
      `UPDATE usuario SET idtipo_usuario = -1
        WHERE idtipo_usuario IS NULL AND UPPER(TRIM(iduser)) <> 'ADMIN'`,
    );
    detalle.usuarios_sin_rol = Number(pend[0]?.n) || 0;

    // Vigencia (HASTA_VIGENCIA) por defecto para usuarios legados que no la tienen (NULL):
    //   - Activos (1) / Bloqueados (2) → 31/12/2050 (sin caducidad efectiva).
    //   - Inactivos (0)                → fecha actual (ya vencidos).
    // No pisa fechas ya cargadas por el operador. Excluye Admin y plantillas de rol.
    const noReservado = `UPPER(TRIM(iduser)) <> 'ADMIN'
       AND iduser NOT IN (SELECT iduser FROM tipo_usuario WHERE iduser IS NOT NULL)`;
    await tx.query(
      `UPDATE usuario SET hasta_vigencia = CAST('2050-12-31' AS TIMESTAMP)
        WHERE hasta_vigencia IS NULL AND COALESCE(estado,0) IN (1, 2) AND ${noReservado}`,
    );
    await tx.query(
      `UPDATE usuario SET hasta_vigencia = CURRENT_TIMESTAMP
        WHERE hasta_vigencia IS NULL AND COALESCE(estado,0) = 0 AND ${noReservado}`,
    );
  });

  // 4. Seed BD server + marcar como ejecutado
  await transaction('server', async (tx) => {
    await seedTipoOperacion(tx);
    detalle.tipo_operacion = TIPO_OPERACION.length;

    // Habilitar tipos de movimiento (estado = 1) para que aparezcan los conceptos
    await seedTipoMovimiento(tx);
    detalle.tipo_movimiento = 1;

    // Marcar METADATA_EJECUTADO = 1 en todas las filas
    await tx.query('UPDATE configuracion_usuario SET metadata_ejecutado = 1');
  });

  logger.info({ detalle }, 'MetadataService: inicialización completada');
  return { ok: true, detalle };
}

module.exports = { obtenerEstado, ejecutar };
