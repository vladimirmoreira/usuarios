import {
  GraduationCap, LogIn, LayoutDashboard, UserX, UserCog, UserCheck,
  Upload, ScrollText, BarChart2, Copy, Settings, Radio,
} from 'lucide-react';
import { SeccionesView, type Seccion } from '../documentacion/Secciones';

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

const proximamente = (extra?: string): Seccion['bloques'] => ([
  { t: 'p', texto: `En construcción.${extra ? ' ' + extra : ''} Se completará con pasos y mockups.` },
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
    ],
  },
  {
    id: 'panel', titulo: 'El panel principal', icon: LayoutDashboard,
    bloques: [
      { t: 'p', texto: 'A la izquierda está el menú. Según tus permisos verás algunas o todas estas opciones: Usuarios, Incidencias, Roles, Auditoría, Reportes y —solo administradores— Configuración, Replicación y Documentación. Tutorial está disponible para todos.' },
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
  { id: 'roles', titulo: '2. Roles (crear, editar, permisos)', icon: UserCog, bloques: proximamente('Alta de rol, plantilla de permisos, edición y baja.') },
  { id: 'usuario-con-rol', titulo: '3. Crear un usuario con Rol', icon: UserCheck, bloques: proximamente('Ejemplos UROLVENTAS (Encargado de Ventas) y UROLPRODUC (Producción). Incluye anexo con el catálogo de operaciones por evento.') },
  { id: 'importacion', titulo: '4. Importación masiva de usuarios', icon: Upload, bloques: proximamente('Carga desde archivo, validaciones y archivo de errores.') },
  { id: 'auditoria', titulo: '5. Auditoría', icon: ScrollText, bloques: proximamente('Historial de acciones: quién, qué y cuándo.') },
  { id: 'reportes', titulo: '6. Reportes', icon: BarChart2, bloques: proximamente('Listados, filtros y exportación.') },
  { id: 'clonacion', titulo: '7. Clonación a otra empresa', icon: Copy, bloques: proximamente('Copiar accesos de un usuario a otra empresa.') },
  { id: 'admin-config', titulo: 'Admin · Configuración', icon: Settings, bloques: proximamente('Flags, temporizadores y metadatos.') },
  { id: 'admin-replicacion', titulo: 'Admin · Replicación', icon: Radio, bloques: proximamente('Destinos, cola, propagación de rol y alertas.') },
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
