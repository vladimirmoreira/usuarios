import {
  GraduationCap, LogIn, LayoutDashboard, UserX, UserCog, UserCheck,
  Upload, ScrollText, BarChart2, Copy, Settings, Radio,
} from 'lucide-react';
import { SeccionesView, type Seccion } from '../documentacion/Secciones';
import {
  mLogin, mPanel, mAccionesUsuario, mRoles, mImportacion, mAuditoria,
  mReportes, mClonacion, mConfiguracion, mReplicacion,
} from './mockups';

/* ── Helpers para armar mockups SVG (vectoriales, escalan sin deformarse) ── */
const F = (x: number, y: number, w: number, label: string, val: string, bg = '#ffffff', fg = '#0f172a') => `
  <text x="${x}" y="${y}" font-size="11" fill="#64748b">${label}</text>
  <rect x="${x}" y="${y + 8}" width="${w}" height="32" rx="7" fill="${bg}" stroke="#cbd5e1"/>
  <text x="${x + 12}" y="${y + 29}" font-size="13" fill="${fg}">${val}</text>`;
const SEL = (x: number, y: number, w: number, label: string, val: string) => `
  <text x="${x}" y="${y}" font-size="11" fill="#64748b">${label}</text>
  <rect x="${x}" y="${y + 8}" width="${w}" height="32" rx="7" fill="#eef2ff" stroke="#4f46e5"/>
  <text x="${x + 12}" y="${y + 29}" font-size="13" font-weight="600" fill="#4f46e5">${val}</text>
  <text x="${x + w - 16}" y="${y + 29}" font-size="11" fill="#4f46e5">&#9662;</text>`;
const CO = (x: number, y: number, n: string) =>
  `<circle cx="${x}" cy="${y}" r="10" fill="#f59e0b"/><text x="${x}" y="${y + 4}" font-size="12" font-weight="700" fill="#fff" text-anchor="middle">${n}</text>`;

const svgAltaSinRol = `<svg viewBox="0 0 640 400" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block" font-family="system-ui,Segoe UI,Arial">
  <rect x="8" y="8" width="624" height="384" rx="12" fill="#ffffff" stroke="#e2e8f0"/>
  <path d="M8 20 a12 12 0 0 1 12 -12 h600 a12 12 0 0 1 12 12 v28 h-624 z" fill="#f8fafc"/>
  <line x1="8" y1="48" x2="632" y2="48" stroke="#e2e8f0"/>
  <text x="28" y="34" font-size="15" font-weight="700" fill="#0f172a">Agregar Usuario</text>
  <text x="608" y="36" font-size="18" fill="#94a3b8" text-anchor="end">&#215;</text>
  ${F(28, 78, 178, 'Nombre *', 'Usuario')}
  ${F(226, 78, 178, 'Apellido(s) *', 'Sinrol')}
  ${F(424, 78, 180, 'Usuario *', 'USINROL', '#eef2ff', '#4f46e5')}
  ${F(28, 154, 178, 'Documento *', '90000001')}
  ${SEL(226, 154, 178, 'Perfil *', 'Sin Rol')}
  ${F(424, 154, 180, 'Sucursal (opcional)', '—', '#f8fafc', '#94a3b8')}
  <text x="28" y="238" font-size="11.5" fill="#64748b">“Sin Rol” no lleva sucursal ni permisos: se asignan después desde Accesos.</text>
  <line x1="8" y1="332" x2="632" y2="332" stroke="#e2e8f0"/>
  <rect x="430" y="348" width="88" height="34" rx="8" fill="#ffffff" stroke="#cbd5e1"/>
  <text x="474" y="370" font-size="13" fill="#334155" text-anchor="middle">Cancelar</text>
  <rect x="528" y="348" width="92" height="34" rx="8" fill="#4f46e5"/>
  <text x="574" y="370" font-size="13" font-weight="600" fill="#ffffff" text-anchor="middle">Guardar</text>
  ${CO(20, 90, '1')} ${CO(612, 90, '2')} ${CO(216, 166, '3')}
</svg>`;

const svgAltaConRol = `<svg viewBox="0 0 640 400" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block" font-family="system-ui,Segoe UI,Arial">
  <rect x="8" y="8" width="624" height="384" rx="12" fill="#ffffff" stroke="#e2e8f0"/>
  <path d="M8 20 a12 12 0 0 1 12 -12 h600 a12 12 0 0 1 12 12 v28 h-624 z" fill="#f8fafc"/>
  <line x1="8" y1="48" x2="632" y2="48" stroke="#e2e8f0"/>
  <text x="28" y="34" font-size="15" font-weight="700" fill="#0f172a">Agregar Usuario</text>
  <text x="608" y="36" font-size="18" fill="#94a3b8" text-anchor="end">&#215;</text>
  ${F(28, 78, 178, 'Nombre *', 'Usuario')}
  ${F(226, 78, 178, 'Apellido(s) *', 'ROLVENTAS')}
  ${F(424, 78, 180, 'Usuario *', 'UROLVENTAS', '#eef2ff', '#4f46e5')}
  ${F(28, 154, 178, 'Documento *', '90000002')}
  ${SEL(226, 154, 178, 'Perfil *', 'Encargado de Ventas')}
  ${F(424, 154, 180, 'Sucursal *', 'Casa Central', '#eef2ff', '#4f46e5')}
  <text x="28" y="238" font-size="11.5" fill="#64748b">El perfil copia permisos, menú y conceptos. Si es PDV y Gastronomía está activa, crea el mesero.</text>
  <line x1="8" y1="332" x2="632" y2="332" stroke="#e2e8f0"/>
  <rect x="430" y="348" width="88" height="34" rx="8" fill="#ffffff" stroke="#cbd5e1"/>
  <text x="474" y="370" font-size="13" fill="#334155" text-anchor="middle">Cancelar</text>
  <rect x="528" y="348" width="92" height="34" rx="8" fill="#4f46e5"/>
  <text x="574" y="370" font-size="13" font-weight="600" fill="#ffffff" text-anchor="middle">Guardar</text>
  ${CO(216, 166, '1')} ${CO(612, 166, '2')}
</svg>`;

const op = (titulo: string, desc: string, hist: string): Seccion['bloques'] => ([
  { t: 'sub', texto: titulo },
  { t: 'p', texto: desc },
  { t: 'p', texto: `Historial: ${hist}` },
]);

const SECCIONES: Seccion[] = [
  {
    id: 'ingresar', titulo: 'Ingresar al sistema', icon: LogIn,
    bloques: [
      { t: 'pasos', items: [
        'Escribí tu usuario y contraseña y presioná Ingresar.',
        'Si tu usuario tiene acceso a más de una empresa, elegí una en el desplegable.',
        'Si olvidaste la clave, pedí a un administrador que la reinicie.',
      ] },
      { t: 'img', svg: mLogin, caption: 'Pantalla de ingreso.' },
    ],
  },
  {
    id: 'panel', titulo: 'El panel principal', icon: LayoutDashboard,
    bloques: [
      { t: 'p', texto: 'A la izquierda está el menú. Según tus permisos verás algunas o todas estas opciones: Usuarios, Incidencias, Roles, Auditoría, Reportes y —solo administradores— Configuración, Replicación y Documentación. Tutorial está disponible para todos.' },
      { t: 'img', svg: mPanel, caption: 'Menú lateral + lista de usuarios. La columna Acciones (1) tiene los botones de cada fila.' },
      { t: 'sub', texto: 'Acciones rápidas en la lista de usuarios' },
      { t: 'p', texto: 'En la grilla de Usuarios, la columna "Acciones" tiene botones (pasá el mouse para ver el nombre):' },
      { t: 'tabla', head: ['Botón', 'Qué hace'], filas: [
        ['Accesos', 'Configura permisos, menú, PDV, conceptos, sucursales y depósitos del usuario.'],
        ['Modificar', 'Edita nombre, apellido, documento, foto y vigencia (o asigna perfil si está sin rol).'],
        ['Reiniciar clave', 'Reinicia la contraseña del usuario.'],
        ['Historial', 'Muestra las acciones registradas de ese usuario.'],
        ['Sucursal', 'Reasigna la sucursal predeterminada.'],
        ['Vincular a Legajo', 'Asocia el usuario a una persona de RRHH (visible con Gastronomía).'],
        ['Reactivar', 'Vuelve a habilitar un usuario dado de baja.'],
        ['Dar de baja', 'Inhabilita el usuario (no se borra).'],
      ] },
      { t: 'img', svg: mAccionesUsuario, caption: 'Los botones de la columna Acciones (pasá el mouse en la app para ver el nombre).' },
      { t: 'p', texto: 'Arriba, la barra tiene: Nuevo usuario, Importar, Exportar y Selección múltiple (para acciones masivas: baja, reiniciar clave o reasignar sucursal a varios a la vez).' },
    ],
  },
  {
    id: 'usuario-sin-rol', titulo: '1. Crear un usuario Sin Rol', icon: UserX,
    bloques: [
      { t: 'p', texto: 'Un usuario "Sin Rol" nace vacío: no copia ninguna plantilla de permisos. Sirve para casos especiales que no encajan en ningún perfil; sus accesos se cargan a mano después.' },
      { t: 'pasos', items: [
        'En el menú Usuarios, presioná "Nuevo usuario".',
        'Completá Nombre (Usuario) y Apellido(s) (Sinrol). El campo Usuario se genera solo: USINROL.',
        'Ingresá el Documento (por ejemplo 90000001).',
        'En Perfil, elegí "Sin Rol".',
        'La Sucursal queda opcional. Presioná Guardar.',
        'El usuario queda creado sin permisos: asignáselos luego desde el botón Accesos del usuario.',
      ] },
      { t: 'img', svg: svgAltaSinRol, caption: 'Alta de usuario Sin Rol — 1) datos, 2) usuario autogenerado, 3) perfil "Sin Rol".' },
      { t: 'p', texto: 'Nota: la opción "Sin Rol" solo aparece si en Configuración está activo el permiso "Crear usuarios Sin Rol".' },
    ],
  },
  {
    id: 'roles', titulo: '2. Roles (crear, editar, permisos)', icon: UserCog,
    bloques: [
      { t: 'p', texto: 'Un rol (perfil) es una plantilla: define los permisos que heredan los usuarios que se crean con él. Se gestionan desde el menú Roles.' },
      { t: 'pasos', items: [
        'Presioná "Nuevo rol", poné una descripción (ej. Encargado de Ventas) y el tipo (Gestión o PDV).',
        'Guardá: se crea el rol y su usuario-plantilla.',
        'Con "Editar permisos" configurá qué puede hacer el rol (permisos, menú, PDV, conceptos, sucursales, depósitos).',
        'Los usuarios que crees con ese rol copiarán esa plantilla.',
      ] },
      { t: 'sub', texto: 'Acciones rápidas en la lista de roles' },
      { t: 'tabla', head: ['Botón', 'Qué hace'], filas: [
        ['Editar permisos', 'Ajusta la plantilla del rol: permisos, menú, PDV, conceptos, sucursales, depósitos y accesos master.'],
        ['Editar rol', 'Cambia la descripción, el tipo, el estado y las opciones (incluido "Usuario PDV").'],
        ['Desactivar rol', 'Inhabilita el rol (estado 0); deja de ofrecerse al crear usuarios.'],
      ] },
      { t: 'img', svg: mRoles, caption: 'Lista de roles con la columna Acciones (Permisos, Editar, Baja).' },
      { t: 'p', texto: 'Importante: no solo el editor cambia datos — cada botón de acción hace su tarea directa. Si cambiás la plantilla de un rol, para llevar ese cambio a los usuarios ya creados se usa "Propagar" desde el menú Replicación.' },
    ],
  },
  {
    id: 'usuario-con-rol', titulo: '3. Crear un usuario con Rol', icon: UserCheck,
    bloques: [
      { t: 'p', texto: 'A diferencia del "Sin Rol", acá el usuario copia la plantilla del perfil elegido: nace con permisos, menú y conceptos listos. La sucursal es obligatoria.' },
      { t: 'pasos', items: [
        'En Usuarios, presioná "Nuevo usuario".',
        'Completá Nombre (Usuario) y Apellido(s) (ROLVENTAS). El Usuario se genera: UROLVENTAS.',
        'Ingresá el Documento (90000002).',
        'En Perfil elegí "Encargado de Ventas": se copian sus permisos.',
        'Elegí la Sucursal (obligatoria) y presioná Guardar.',
        'Si el perfil es de PDV y Gastronomía está activa, además se crea el mesero (gg_mesero) automáticamente.',
      ] },
      { t: 'img', svg: svgAltaConRol, caption: 'Alta con rol — 1) perfil que aporta los permisos, 2) sucursal obligatoria.' },
      { t: 'p', texto: 'Otro ejemplo: UROLPRODUC (Usuario / Rolproduc) con perfil "Producción" — no es PDV, así que no genera mesero.' },
    ],
  },
  {
    id: 'anexo-operaciones', titulo: 'Anexo · Catálogo de operaciones', icon: ScrollText,
    bloques: [
      { t: 'p', texto: 'Cada acción sobre un usuario queda registrada en el historial (visible en Auditoría). Debajo, qué hace cada una y cómo se guarda.' },
      ...op('Alta de usuario (op. 1)', 'Crea el usuario copiando la plantilla del rol (o vacío si es Sin Rol). Genera usuarioempresa, menú, sucursales y —si aplica— el mesero.', 'op 1 "Alta de Usuario" — ej. «Perfil=7 Suc=1 Doc=90000002».'),
      ...op('Baja de usuario (op. 2)', 'Inhabilita al usuario (estado 0); no se borra. Si es mesero, también lo inactiva; si Biométrico está activo, elimina su huella.', 'op 2 "Baja de Usuario" — ej. «Inactivación de usuario exitoso».'),
      ...op('Re-activar cuenta (op. 11)', 'Vuelve a habilitar (estado 1) un usuario que estaba de baja.', 'op 11 "Re-Activar Cuenta".'),
      ...op('Reinicio de clave (op. 3)', 'Reinicia la contraseña. Si es mesero, también actualiza su código de acceso PDV.', 'op 3 "Reinicio de Clave".'),
      ...op('Reasignación de sucursal (op. 5)', 'Cambia la sucursal predeterminada (orden 1) y reordena las demás; ajusta también los depósitos.', 'op 5 "Reasignación de Sucursal" — ej. «Codigo:1».'),
      ...op('Cambio de perfil (op. 6)', 'Cambia el rol del usuario y, si es mesero, su tipo de mesero.', 'op 6 "Cambio de Perfil".'),
      ...op('Actualización de cuenta (op. 7)', 'Corrige nombre, apellido, documento o foto. También cubre cambios de accesos (permisos, menú, PDV, conceptos, sucursales, depósitos, master) y la clonación a otra empresa.', 'op 7 "Actualización de Cuenta" — ej. «Accesos: menú (19 items)».'),
      ...op('Vinculación con legajo (op. 8)', 'Asocia el usuario a una persona de RRHH por documento.', 'op 8 "Vinculación con Legajo".'),
      ...op('Eliminación de huella (op. 4)', 'Borra la huella biométrica asociada al legajo del usuario.', 'op 4 "Eliminación de Huella" — ej. «cargoID:123».'),
      ...op('Exclusión de cuenta (op. 9)', 'Marca permisos excluidos puntualmente sin cambiar el rol.', 'op 9 "Exclusion de Cuenta".'),
      ...op('Migración / Replicación (op. 10)', 'Encola/replica el usuario a las sucursales, propaga un rol o reintenta envíos.', 'op 10 "Migración de Datos" — ej. «Propagación rol 7: 62 usuario(s)».'),
      { t: 'p', texto: 'Nota: el ingreso al sistema también se registra — op. 12 "Inicio de Sesión" (y op. 13 "Intento de Login Fallido" cuando la credencial es inválida), con la empresa e IP.' },
    ],
  },
  {
    id: 'importacion', titulo: '4. Importación masiva de usuarios', icon: Upload,
    bloques: [
      { t: 'p', texto: 'Podés dar de alta muchos usuarios de una vez desde un archivo CSV o pegando desde Excel.' },
      { t: 'sub', texto: 'Formato (columnas)' },
      { t: 'tabla', head: ['Columna', 'Contenido'], filas: [
        ['nombre', 'Nombre del usuario.'],
        ['apellido', 'Apellido(s).'],
        ['documento', 'Número de documento (único).'],
        ['perfil', 'Rol: su id (7) o la descripción exacta ("Encargado de Ventas"). Debe estar activo y con permisos.'],
        ['idsucursal', 'Id de la sucursal (activa).'],
      ] },
      { t: 'pasos', items: [
        'En Usuarios, presioná "Importar".',
        'Pegá o subí los datos con esas columnas. Sin encabezado, el orden es: nombre, apellido, documento, perfil, idsucursal.',
        'Revisá la previsualización: se marcan las filas con error.',
        'Confirmá para dar de alta las filas válidas.',
        'Si hubo errores, se genera en tu Escritorio el archivo "errImportacionUsuario_DDMMAAAA.txt" con el detalle fila por fila.',
      ] },
      { t: 'img', svg: mImportacion, caption: 'Previsualización: cada fila se marca OK o Error antes de confirmar.' },
      { t: 'p', texto: 'El identificador (iduser) se genera automáticamente para cada usuario.' },
    ],
  },
  {
    id: 'auditoria', titulo: '5. Auditoría', icon: ScrollText,
    bloques: [
      { t: 'p', texto: 'Registra todas las acciones del módulo: quién, qué operación, cuándo, la autorización y una observación.' },
      { t: 'pasos', items: [
        'Entrá al menú Auditoría.',
        'Filtrá por Usuario, Operación, Autorización o rango de Fechas.',
        'La grilla muestra: ID, Fecha, Usuario, Operación, Autorización y Observación.',
        'Podés exportar el resultado.',
      ] },
      { t: 'img', svg: mAuditoria, caption: 'Filtros (Usuario / Operación / Fecha) y la grilla del historial.' },
      { t: 'p', texto: 'El detalle de cada tipo de operación está en el Anexo · Catálogo de operaciones.' },
    ],
  },
  {
    id: 'reportes', titulo: '6. Reportes', icon: BarChart2,
    bloques: [
      { t: 'p', texto: 'Genera una ficha imprimible de un Usuario o de un Rol.' },
      { t: 'pasos', items: [
        'Entrá al menú Reportes y elegí el tipo: Usuario o Rol.',
        'Buscá y seleccioná el registro.',
        'Se muestra la ficha con sus datos (perfil, sucursales y permisos; o la plantilla del rol).',
        'Usá "Imprimir / Exportar a PDF" para guardarla o imprimirla.',
      ] },
      { t: 'img', svg: mReportes, caption: 'Ficha de usuario, lista para imprimir o exportar a PDF.' },
    ],
  },
  {
    id: 'clonacion', titulo: '7. Clonación a otra empresa', icon: Copy,
    bloques: [
      { t: 'p', texto: 'Copia los accesos de un usuario (permisos y menú) a otra empresa dentro de la misma base. Útil cuando el mismo usuario debe operar en varias empresas.' },
      { t: 'pasos', items: [
        'Abrí el editor del usuario (botón Modificar).',
        'En "Clonar accesos a empresa", elegí la empresa destino.',
        'Presioná "Clonar".',
      ] },
      { t: 'img', svg: mClonacion, caption: 'Bloque "Clonar accesos a empresa" en el editor de usuario.' },
      { t: 'p', texto: 'No copia sucursal ni depósitos (son globales del usuario). No sobrescribe si el usuario ya tiene accesos en esa empresa. El botón aparece solo si el flag CLONAR está activo. (Distinto de Replicar, que envía el usuario completo a otras sucursales.)' },
    ],
  },
  {
    id: 'admin-config', titulo: 'Admin · Configuración', icon: Settings,
    bloques: [
      { t: 'p', texto: 'Solo para Admin o el usuario autorizado. Ajusta el comportamiento del módulo por instalación (pestañas):' },
      { t: 'ul', items: [
        'Configuración: interruptores y parámetros (Legajo, Gastronomía, Clonar, Replicar, temporizador y retención de replicación, etc.).',
        'Empresas: qué empresas son accesibles en el login y el mapeo con la BD master.',
        'Metadatos: inicialización de catálogos, una sola vez por instalación.',
      ] },
      { t: 'img', svg: mConfiguracion, caption: 'Pestaña Configuración: interruptores y parámetros de replicación.' },
      { t: 'p', texto: 'El detalle de cada parámetro está en Documentación → Parámetros de configuración.' },
    ],
  },
  {
    id: 'admin-replicacion', titulo: 'Admin · Replicación', icon: Radio,
    bloques: [
      { t: 'p', texto: 'Solo Admin/autorizado y con el flag REPLICAR activo. Muestra el estado del envío de usuarios a las sucursales.' },
      { t: 'ul', items: [
        'Grilla por destino con el conteo por estado: Encolado, Procesando, Enviado, Error, Bloqueado.',
        'Botón Reintentar para reencolar los envíos fallidos.',
        'Sección "Roles pendientes de propagar": botón Replicar con barra de progreso.',
        'Un badge rojo en el menú avisa si hay pendientes o errores, aunque estés en otra pantalla.',
      ] },
      { t: 'img', svg: mReplicacion, caption: 'Roles pendientes de propagar + estado de la cola por sucursal.' },
      { t: 'p', texto: 'El funcionamiento completo (destinos, cola, cascada de dependencias) está en Documentación → Módulo de Replicación.' },
    ],
  },
];

export default function TutorialPage() {
  return (
    <SeccionesView
      titulo="Tutorial"
      subtitulo="Guía de uso paso a paso — en construcción"
      headerIcon={GraduationCap}
      secciones={SECCIONES}
      footer="Se irán agregando las demás secciones con sus mockups."
    />
  );
}
