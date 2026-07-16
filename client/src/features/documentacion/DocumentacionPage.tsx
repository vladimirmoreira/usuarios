import {
  BookOpen, Database, Clock, Radio, GitBranch, Users, ListChecks, Layers,
  Sliders, Wrench, Lock, Boxes, Network,
} from 'lucide-react';
import { SeccionesView, type Seccion } from './Secciones';

const SECCIONES: Seccion[] = [
  {
    id: 'arquitectura', titulo: 'Arquitectura y bases de datos', icon: Database,
    bloques: [
      { t: 'p', texto: 'El módulo opera sobre Firebird en un esquema multi-base. Cada cliente usa un par de BD (system + server) y, opcionalmente, una BD master para los módulos de Contabilidad y Talento Humano (RRHH).' },
      { t: 'tabla', head: ['Base de datos', 'Contenido'], filas: [
        ['system_*', 'Usuarios, roles (tipo_usuario), permisos y menú del ERP (usuario, usuarioempresa, menu_general).'],
        ['server_*', 'Historial, configuración, catálogos operativos y asignaciones (sucursales, depósitos, conceptos, gg_mesero, rh_persona, rh_cargo).'],
        ['master_*', 'Espejo de usuario/usuarioempresa para los módulos RRHH / Contabilidad. Opcional.'],
      ] },
      { t: 'p', texto: 'La capa de acceso a datos vive en Node.js (server/src). Los stored procedures legacy (PCD_USUARIO, PCD_OPERACIONES) quedan deprecados: la lógica fue reimplementada en modelos y servicios para mayor control y auditoría.' },
      { t: 'sub', texto: 'Dialecto Firebird' },
      { t: 'p', texto: 'La BD server central (orgonita_server) es dialecto 3; system y las BD destino de las sucursales son dialecto 1. Por eso se cuida la aritmética de fechas (DATEADD) y las palabras reservadas (SYSTEM, MASTER, MIN) según la base.' },
    ],
  },
  {
    id: 'procesos', titulo: 'Procesos programados (jobs)', icon: Clock,
    bloques: [
      { t: 'p', texto: 'El backend ejecuta tareas automáticas en segundo plano. Se pueden apagar por variable de entorno.' },
      { t: 'tabla', head: ['Proceso', 'Frecuencia', 'Qué hace'], filas: [
        ['Inactividad', 'Configurable', 'Detecta usuarios sin actividad según DIAS_INACTIVIDAD.'],
        ['Vigencia', '04:00 diario', 'Inhabilita (estado 0) usuarios cuya HASTA_VIGENCIA venció.'],
        ['Turno / Sucursal', 'Diario', 'Aplica la programación de sucursal por turno.'],
        ['Replicación', 'Cada TEMPORIZADOR_REPLICACION min (default 15)', 'Red de seguridad: reprocesa la cola de replicación pendiente (destinos que estuvieron caídos) y purga los envíos exitosos vencidos.'],
      ] },
      { t: 'p', texto: 'El worker de Replicación NO es el que replica en el momento normal (eso es inmediato al guardar). Es una red de seguridad de reintentos: su intervalo se lee de CONFIGURACION_USUARIO.TEMPORIZADOR_REPLICACION en cada ciclo, así se ajusta desde Configuración sin reiniciar el servidor.' },
      { t: 'p', texto: 'Cada job puede apagarse por variable de entorno (ENABLE_..._JOB=0) y su horario ajustarse por cron (VIGENCIA_CRON, etc.). La zona horaria por defecto es America/Asuncion.' },
    ],
  },
  {
    id: 'configuracion', titulo: 'Parámetros de configuración (flags)', icon: Sliders,
    bloques: [
      { t: 'p', texto: 'La tabla CONFIGURACION_USUARIO guarda una fila por instalación (identificada por IP) con interruptores (flags 0/1) y parámetros que cambian el comportamiento del módulo. Se editan desde el menú Configuración. Solo los ve/edita el usuario ADMIN o el listado en AUTORIZADO.' },
      { t: 'tabla', head: ['Parámetro', 'Efecto'], filas: [
        ['LEGAJO', 'Habilita la vinculación con legajos de RRHH (rh_persona / rh_cargo). Si está apagado, el mesero puede no tener persona/cargo.'],
        ['GASTRONOMIA', 'Habilita el módulo PDV / meseros (gg_mesero). Si está apagado, oculta esa parte.'],
        ['BIOMETRICO', 'Habilita el manejo de huellas de acceso (rh_cargo_bio).'],
        ['CONTABILIDAD / TALENTO_HUMANO', 'Habilitan la replicación a la BD master (módulos Contab. / RRHH).'],
        ['CREAR_SIN_ROL', 'Permite crear usuarios "Sin Rol" (sin plantilla de permisos).'],
        ['CLONAR', 'Muestra el botón "Clonar accesos a otra empresa" en el editor de usuario.'],
        ['REPLICAR', 'Activa el módulo de Replicación: menú, botón "Replicar", recordatorios de rol y badge de alerta.'],
        ['TEMPORIZADOR_REPLICACION', 'Minutos entre ciclos del worker de replicación (default 15).'],
        ['RETENCION_REPLICACION_HORAS', 'Horas que se conservan los envíos exitosos antes de purgarlos de la lista (default 48).'],
        ['DIAS_INACTIVIDAD', 'Umbral (en días) para considerar a un usuario inactivo (default 90).'],
        ['AUTORIZADO', 'Usuario (además de ADMIN) habilitado a ver/editar Configuración, Replicación y Documentación.'],
        ['METADATA_EJECUTADO', 'Cerrojo: 1 = la inicialización de metadatos ya se ejecutó.'],
      ] },
    ],
  },
  {
    id: 'catalogos', titulo: 'Catálogos y tablas de referencia', icon: Boxes,
    bloques: [
      { t: 'p', texto: 'Los catálogos definen QUÉ permisos, menús y operaciones existen. Son dato de instalación: se siembran una vez por base y NO viajan con la replicación de usuarios (cada base tiene los suyos).' },
      { t: 'tabla', head: ['Tabla', 'BD', 'Función', 'Se puebla desde'], filas: [
        ['TMP$USUARIO_PERMISOS_GENERALES', 'system', 'Lista de permisos del ERP (Gestión Empresarial) — 39 ítems.', 'Metadatos (botón Ejecutar)'],
        ['TMP$USUARIO_PERMISOS_PDV', 'system', 'Permisos del módulo PDV / Punto de Venta — 18 ítems.', 'Metadatos (botón Ejecutar)'],
        ['TMP$USUARIO_PERMISOS_CONCEPTOS', 'system', 'Permisos de acción por concepto de movimiento — 15 ítems.', 'Metadatos (botón Ejecutar)'],
        ['TIPO_USUARIO', 'system', 'Roles / perfiles base (Administración, Ventas, Caja, etc.).', 'Metadatos (botón Ejecutar)'],
        ['TIPO_OPERACION', 'server', 'Catálogo de operaciones para la auditoría (alta, baja, reset, migración…).', 'Metadatos (botón Ejecutar)'],
        ['TMP$USUARIO_PERMISOS_MASTER', 'master', 'Permisos del módulo master (Contabilidad / RRHH) — 9 ítems.', 'migrarDDL (esquema)'],
        ['TMP$USUARIO_MENU_MASTER', 'master', 'Ítems de menú de Contabilidad y RRHH — 19 ítems.', 'migrarDDL (esquema)'],
      ] },
      { t: 'sub', texto: 'Nota sobre las TMP$ del ERP legacy' },
      { t: 'p', texto: 'La BD server tiene muchas otras tablas TMP$ (TMP$USUARIO_SUCURSAL, TMP$USUARIO_DEPOSITO, TMP$USUARIO_DEPOSITO1, etc.) que son temporales de trabajo del sistema legacy Delphi (las usaba el SP PCD_OPERACIONES). El módulo Node NO las usa ni las siembra: no forman parte de esta aplicación.' },
    ],
  },
  {
    id: 'replicacion', titulo: 'Módulo de Replicación', icon: Radio,
    bloques: [
      { t: 'p', texto: 'Replica los usuarios de la base central a las bases de cada sucursal destino. Reemplaza el mecanismo legacy de "Migración de Datos" (operación 10) por un motor en Node con cola resiliente.' },
      { t: 'sub', texto: 'Destinos (configuracion_usuario_replica)' },
      { t: 'p', texto: 'Una fila por local: IDSUCURSAL (base/offset), HOST_SERVER, USER_BD/CLAVE_BD y las rutas SERVER_BD / SYSTEM_BD / MASTER_BD. Si MASTER_BD es nulo, ese local no replica a master (solo system + server).' },
      { t: 'sub', texto: 'Cola (outbox) y estados' },
      { t: 'tabla', head: ['Estado', 'Significado'], filas: [
        ['Encolado (0)', 'Pendiente de enviar. Se acumula si el destino está caído (VPN).'],
        ['Procesando (1)', 'En envío en este momento (transitorio).'],
        ['Enviado (2)', 'Replicado con éxito. Se purga a las RETENCION_REPLICACION_HORAS (default 48).'],
        ['Error (3)', 'Falló por un problema de datos. Requiere reintento manual.'],
        ['Bloqueado (4)', 'Se replicó parcialmente: faltó una dependencia (FK) que no se pudo resolver. Requiere atención.'],
      ] },
      { t: 'p', texto: 'El envío normal es inmediato: al dar de alta/baja o cambiar permisos de un usuario, se encola y se drena en el acto. Si el destino no responde, el job queda Encolado y el worker lo reintenta en su ciclo.' },
      { t: 'sub', texto: 'Resiliencia a VPN caída' },
      { t: 'p', texto: 'Un cambio no bloquea la operación esperando a las sucursales. Se encola por destino; cuando el local vuelve en línea, la cola se drena sola. El menú Replicación muestra el conteo por destino y un badge de alerta en la barra lateral para notar acumulaciones aunque se esté trabajando en otro menú.' },
      { t: 'sub', texto: 'Dedupe y credenciales' },
      { t: 'ul', items: [
        'No se duplica un job Encolado del mismo (usuario, destino): el worker lee los datos en vivo al procesar, así que un pendiente basta.',
        'Cada destino trae sus propias credenciales (USER_BD / CLAVE_BD); el worker abre conexión Firebird directa a cada BD del local.',
      ] },
    ],
  },
  {
    id: 'transformaciones', titulo: 'Transformaciones y cascada de dependencias', icon: Layers,
    bloques: [
      { t: 'p', texto: 'Replicar no es copiar tal cual: se transforman datos según el local y se ratifican las dependencias antes de escribir (nunca se ejecuta un INSERT/UPDATE sin verificar que los ID referenciados existan).' },
      { t: 'sub', texto: 'Transformaciones' },
      { t: 'ul', items: [
        'ORDEN de sucursal/depósito: la sucursal propia del destino queda en orden 1; las demás en orden 2.',
        'GG_MESERO.IDSUCURSAL = IDSUCURSAL del destino (offset por local). El IDMESERO se preserva.',
      ] },
      { t: 'sub', texto: 'Cascada de dependencias (constraint-driven)' },
      { t: 'p', texto: 'El motor no asume un grafo de dependencias fijo: lee las claves foráneas REALES de cada tabla del destino y las resuelve recursivamente, replicando de central lo que falte, en el orden correcto. Así cubre automáticamente toda la cadena del legajo del mesero, por ejemplo:' },
      { t: 'p', texto: 'RH_PERSONA (→ ciudad, barrio, país, profesión, estado civil) · RH_CARGO (→ departamento, tipo de cargo, tipo de salario, tipo de contrato, forma de pago, moneda) · GG_MESERO (→ tipo de mesero). Ciudad → división geográfica; barrio → ciudad.' },
      { t: 'p', texto: 'Es best-effort por dependencia: si una no se puede resolver, se marca Bloqueado y no se aborta el resto. Los datos base con id 0 (centinela) y las empresas se consideran dato de instalación de la sucursal; no se replican por usuario.' },
      { t: 'sub', texto: 'Datos opcionales del mesero' },
      { t: 'p', texto: 'La persona (rh_idpersona) y el cargo del mesero pueden venir vacíos según el flag LEGAJO de configuracion_usuario. En ese caso el mesero se replica igual, sin esos vínculos. En USUARIO_CONCEPTO la única FK dura es el tipo de movimiento; las demás columnas no tienen constraint y se copian tal cual. En USUARIOEMPRESA se omite la fila si su empresa no existe en la sucursal.' },
    ],
  },
  {
    id: 'distribuida', titulo: 'BD distribuida: identidad y colisiones', icon: Network,
    bloques: [
      { t: 'p', texto: 'Al replicar entre bases, el riesgo clásico es que un ID generado en una base pise datos de otro registro en la base destino. El módulo lo evita con dos estrategias según el tipo de dato.' },
      { t: 'tabla', head: ['Estrategia', 'Tablas', 'Cómo evita la colisión'], filas: [
        ['Regenerar PK local + clave natural', 'menu_general (por iduser); usuario_sucursal / deposito / deposito1 / concepto (sin PK)', 'Se borra por iduser y se re-inserta; el ID surrogate lo asigna el generador del propio destino. Nunca se pisa el ID de otro usuario.'],
        ['Preservar PK (identidad global)', 'usuario, usuarioempresa, gg_mesero, rh_persona, rh_cargo, tipo_usuario', 'El ID lo asigna SIEMPRE la central; la sucursal solo lo recibe. Mismo ID = misma entidad, así el upsert es seguro.'],
      ] },
      { t: 'sub', texto: 'Regla de oro' },
      { t: 'p', texto: 'La central es el único lugar donde se CREAN las entidades con identidad global (usuario, mesero, persona, cargo, rol). Las sucursales solo reciben. Por eso "mismo idmesero = mismo mesero" en todas las bases y el upsert nunca reemplaza otra entidad.' },
      { t: 'sub', texto: 'menu_general en detalle' },
      { t: 'p', texto: 'menu_general NO se replica por su PK: en el destino se BORRA por iduser y se RE-INSERTA generando un idmenu_principal nuevo con el generador local. Por eso el cambio de un usuario nunca puede reemplazar el menú de otro, aunque el número de ID coincida entre bases.' },
      { t: 'sub', texto: 'Si en el futuro una sucursal necesitara crear localmente' },
      { t: 'ul', items: [
        'Rangos / offset por nodo: cada sucursal usa un bloque de IDs disjunto (ya se aplica en el offset de GG_MESERO.IDSUCURSAL).',
        'Claves compuestas o naturales donde se pueda (por ejemplo iduser + idempresa).',
        'Asignación central: la sucursal pide un bloque de IDs a la central antes de crear.',
      ] },
    ],
  },
  {
    id: 'clonar-vs-replicar', titulo: 'Clonar vs Replicar', icon: GitBranch,
    bloques: [
      { t: 'p', texto: 'Son dos operaciones distintas que a veces se confunden.' },
      { t: 'tabla', head: ['', 'Clonar', 'Replicar'], filas: [
        ['Destino', 'Otra empresa dentro de la MISMA base', 'Las bases de OTRAS sucursales (server/system/master)'],
        ['Qué copia', 'Permisos y menú (no sucursal/depósitos)', 'El usuario completo (accesos, sucursales, depósitos, conceptos, mesero)'],
        ['Transforma', 'No', 'Sí (ORDEN, offset de sucursal del mesero)'],
        ['Dependencias', 'Mismo entorno, ya existen', 'Ratifica y replica las FK que falten (cascada)'],
        ['Se activa con', 'Flag CLONAR', 'Flag REPLICAR'],
      ] },
    ],
  },
  {
    id: 'roles', titulo: 'Roles y propagación', icon: Users,
    bloques: [
      { t: 'p', texto: 'Un rol (perfil / tipo_usuario) define una plantilla de permisos. Al crear un usuario con un rol, sus permisos se copian de esa plantilla.' },
      { t: 'sub', texto: 'El rol como dependencia' },
      { t: 'p', texto: 'Al replicar un usuario, primero se garantiza que su rol (TIPO_USUARIO) exista en la sucursal destino, y se sincroniza. Un usuario "Sin Rol" (idtipo ≤ 0) no genera dependencia.' },
      { t: 'sub', texto: 'Propagar un cambio de rol' },
      { t: 'p', texto: 'Cuando se edita la plantilla de un rol, NO se re-replican todos sus usuarios automáticamente (evita inundar la cola). En su lugar se deja un recordatorio "Rol pendiente de propagar" que aparece en el menú Replicación. Desde ahí, el botón Replicar encola a todos los usuarios del rol en lotes con barra de progreso y throttling.' },
    ],
  },
  {
    id: 'operaciones', titulo: 'Operaciones sobre usuarios', icon: Wrench,
    bloques: [
      { t: 'p', texto: 'Cada cambio sobre un usuario queda auditado en HISTORIAL_USUARIO y, si el flag REPLICAR está activo, dispara la replicación automática a las sucursales (solo el usuario tocado).' },
      { t: 'tabla', head: ['Operación', 'Qué hace'], filas: [
        ['Alta', 'Crea el usuario (copia la plantilla del rol) o lo crea "Sin Rol". Alta masiva por importación disponible.'],
        ['Baja / Reactivar', 'Inhabilita (estado 0) o rehabilita el usuario. La baja se replica: el usuario queda inactivo también en la sucursal.'],
        ['Reset de clave', 'Reinicia la contraseña; también actualiza el código del vendedor/mesero si corresponde.'],
        ['Reasignar sucursal', 'Cambia la sucursal predeterminada y reordena las demás (orden 1 = la elegida).'],
        ['Cambiar perfil', 'Cambia el rol del usuario y el tipo de mesero asociado.'],
        ['Vincular legajo', 'Asocia el usuario a una persona de RRHH por documento.'],
        ['Corregir datos', 'Actualiza nombre, apellido, documento y foto.'],
        ['Exclusión', 'Excluye permisos puntuales sin cambiar el rol.'],
      ] },
    ],
  },
  {
    id: 'metadata', titulo: 'Inicialización de metadatos', icon: ListChecks,
    bloques: [
      { t: 'p', texto: 'Operación de una sola vez por instalación que puebla los catálogos de referencia que el módulo necesita (permisos generales, PDV, conceptos, tipos de usuario y de operación). Solo la ejecuta un usuario ADMIN o el AUTORIZADO.' },
      { t: 'p', texto: 'Un cerrojo (METADATA_EJECUTADO) evita re-ejecutarla. Se accede desde Configuración → pestaña Metadatos. También aplica migraciones de esquema idempotentes (agrega columnas nuevas si faltan).' },
    ],
  },
  {
    id: 'seguridad', titulo: 'Seguridad y consideraciones', icon: Lock,
    bloques: [
      { t: 'ul', items: [
        'Autenticación por token JWT con refresh; las rutas de administración exigen ser ADMIN o AUTORIZADO.',
        'Login multi-empresa: valida usuario global y calcula las empresas accesibles; con más de una, se elige en un combo.',
        'Las contraseñas se guardan en texto plano por restricción del sistema legacy (Delphi). No modificar sin coordinar con Sistemas.',
        'La CLAVE de configuración y la CLAVE_BD de los destinos nunca se exponen por la API.',
        'El frontend se sirve por nginx; la API va por proxy inverso (mismo origen). Firebird es local al servidor.',
        'Cada acción relevante queda auditada en HISTORIAL_USUARIO (quién, qué, cuándo).',
      ] },
    ],
  },
  {
    id: 'glosario', titulo: 'Glosario', icon: BookOpen,
    bloques: [
      { t: 'tabla', head: ['Término', 'Definición'], filas: [
        ['Best-effort', 'Se intenta hacer; si falla, no rompe la operación principal (se registra y sigue).'],
        ['Bloqueado', 'Estado de un envío que se replicó parcialmente porque faltó una dependencia que no se pudo resolver.'],
        ['Cascada', 'Replicar en orden las dependencias (claves foráneas) de un dato antes de escribirlo.'],
        ['Central', 'Base de datos principal que recepciona las transacciones; los usuarios se crean acá primero.'],
        ['Clonar', 'Copiar los accesos de un usuario a otra empresa dentro de la misma base.'],
        ['Cola (outbox)', 'Lista de trabajos de replicación pendientes de enviar a cada destino.'],
        ['Constraint / FK', 'Regla de integridad: una clave foránea (FK) obliga a que el ID referenciado exista en su tabla.'],
        ['Dedupe', 'Evitar encolar dos veces lo mismo mientras está pendiente.'],
        ['Destino / Sucursal', 'Base de datos de un local, que recibe la replicación desde la central.'],
        ['Dialecto', 'Modo de compatibilidad de Firebird (1 o 3) que cambia sintaxis y palabras reservadas.'],
        ['Drenar', 'Procesar los trabajos pendientes de la cola.'],
        ['Encolar', 'Poner un trabajo en la cola para que se envíe.'],
        ['Flag', 'Interruptor de configuración (0/1): CLONAR, REPLICAR, LEGAJO, etc.'],
        ['Idempotente', 'Que se puede ejecutar varias veces sin efectos adicionales (ej. las migraciones de esquema).'],
        ['Introspección', 'Leer la estructura de la BD (columnas, FKs) desde su metadata para adaptarse al esquema real.'],
        ['Job', 'Un trabajo de la cola = replicar un usuario a un destino.'],
        ['Legajo', 'Datos de RRHH de una persona (rh_persona) y su cargo (rh_cargo).'],
        ['Master', 'Base de datos de los módulos Contabilidad / RRHH (opcional).'],
        ['Offset', 'Ajuste del IDSUCURSAL del mesero según el local destino.'],
        ['PDV', 'Punto de venta (módulo de gastronomía / meseros).'],
        ['Plantilla (rol)', 'Usuario modelo de un rol del que se copian los permisos al crear usuarios.'],
        ['Purga', 'Borrado automático de los envíos exitosos vencidos, para no acumular historial en la cola.'],
        ['Replicar', 'Sincronizar un usuario completo a las bases de otras sucursales.'],
        ['Retención', 'Horas que se conservan los envíos exitosos antes de purgarlos.'],
        ['Sentinela (id 0)', 'Valor "sin referencia" (0) que representa la ausencia de un vínculo.'],
        ['Throttling', 'Procesar en lotes con pausas para no saturar los destinos.'],
        ['Upsert', 'Insertar la fila si no existe, o actualizarla si ya existe.'],
        ['VPN', 'Enlace de red entre la central y las sucursales; si se cae, la cola espera y reintenta.'],
        ['Worker', 'Proceso en segundo plano que drena la cola y reintenta lo que quedó pendiente.'],
      ] },
    ],
  },
];

export default function DocumentacionPage() {
  return (
    <SeccionesView
      titulo="Documentación"
      subtitulo="Ficha técnica del módulo — referencia para el supervisor"
      headerIcon={BookOpen}
      secciones={SECCIONES}
      footer="Manual de usuario: ver el menú Tutorial."
    />
  );
}
