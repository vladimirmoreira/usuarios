import { GraduationCap, LogIn, LayoutDashboard, UserPlus, KeyRound, UserMinus, Radio } from 'lucide-react';
import { SeccionesView, type Seccion } from '../documentacion/Secciones';

const SECCIONES: Seccion[] = [
  {
    id: 'ingresar', titulo: 'Ingresar al sistema', icon: LogIn,
    bloques: [
      { t: 'ul', items: [
        'Escribí tu usuario y contraseña y presioná Ingresar.',
        'Si tu usuario tiene acceso a más de una empresa, se te pide elegir una en un desplegable antes de entrar.',
        'Si olvidaste la clave, pedí a un administrador que la reinicie desde el editor de usuario.',
      ] },
    ],
  },
  {
    id: 'panel', titulo: 'El panel principal', icon: LayoutDashboard,
    bloques: [
      { t: 'p', texto: 'A la izquierda está el menú. Según tus permisos vas a ver algunas o todas estas opciones:' },
      { t: 'ul', items: [
        'Usuarios: alta, edición, baja y búsqueda de usuarios.',
        'Incidencias: usuarios inactivos o con vigencia vencida.',
        'Roles: perfiles y sus plantillas de permisos.',
        'Auditoría: historial de acciones (quién hizo qué y cuándo).',
        'Reportes: listados y exportaciones.',
        'Configuración, Replicación y Documentación: solo para administradores / usuarios autorizados.',
      ] },
    ],
  },
  {
    id: 'crear-usuario', titulo: 'Crear un usuario', icon: UserPlus,
    bloques: [
      { t: 'ul', items: [
        'En Usuarios, presioná "Nuevo".',
        'Completá nombre, apellido y documento. El identificador (iduser) se sugiere solo.',
        'Elegí un Perfil (rol): sus permisos se copian como base. Si está habilitado, podés crear "Sin Rol".',
        'Elegí la sucursal. Guardá.',
        'Para carga masiva, usá la importación desde archivo.',
      ] },
    ],
  },
  {
    id: 'permisos', titulo: 'Asignar permisos y accesos', icon: KeyRound,
    bloques: [
      { t: 'p', texto: 'Desde el usuario (o desde su rol, para afectar a todos) podés ajustar:' },
      { t: 'ul', items: [
        'Permisos generales y de PDV, menú, conceptos de movimiento.',
        'Sucursales y depósitos habilitados.',
        'Accesos del módulo master (Contabilidad / RRHH), si corresponde.',
      ] },
      { t: 'p', texto: 'Cambiar un rol NO cambia solo a sus usuarios: para eso se usa "Propagar" (ver el menú Replicación).' },
    ],
  },
  {
    id: 'baja-reset', titulo: 'Baja, reactivación y reset de clave', icon: UserMinus,
    bloques: [
      { t: 'ul', items: [
        'Baja: inhabilita al usuario (no se borra); se puede Reactivar después.',
        'Reset de clave: reinicia la contraseña del usuario.',
        'Reasignar sucursal / Cambiar perfil: desde las acciones del usuario.',
      ] },
    ],
  },
  {
    id: 'replicar', titulo: 'Replicar a sucursales', icon: Radio,
    bloques: [
      { t: 'p', texto: 'Si tu instalación trabaja con sucursales, cada cambio de usuario se envía solo a los locales. No necesitás hacer nada en el momento.' },
      { t: 'ul', items: [
        'Botón "Replicar" en el editor de usuario: fuerza el envío de ese usuario.',
        'Menú Replicación: muestra el estado por sucursal y avisa (badge rojo) si hay pendientes o errores.',
        'Si una sucursal estuvo sin conexión, el envío queda en cola y se reintenta solo cuando vuelve.',
      ] },
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
      footer="Se irán agregando más pasos y capturas de pantalla."
    />
  );
}
