import { useMemo, useState } from 'react';
import {
  BookOpen, Search, Database, Clock, Radio, GitBranch, Users, ListChecks, Layers, X,
} from 'lucide-react';

/* ── Modelo de contenido (permite render + búsqueda) ───────────────────── */
type Bloque =
  | { t: 'p'; texto: string }
  | { t: 'sub'; texto: string }
  | { t: 'ul'; items: string[] }
  | { t: 'tabla'; head: string[]; filas: string[][] };

type Seccion = { id: string; titulo: string; icon: any; bloques: Bloque[] };

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
    id: 'metadata', titulo: 'Inicialización de metadatos', icon: ListChecks,
    bloques: [
      { t: 'p', texto: 'Operación de una sola vez por instalación que puebla los catálogos de referencia que el módulo necesita (permisos generales, PDV, conceptos, tipos de usuario y de operación). Solo la ejecuta un usuario ADMIN o el AUTORIZADO.' },
      { t: 'p', texto: 'Un cerrojo (METADATA_EJECUTADO) evita re-ejecutarla. Se accede desde Configuración → pestaña Metadatos. También aplica migraciones de esquema idempotentes (agrega columnas nuevas si faltan).' },
    ],
  },
  {
    id: 'glosario', titulo: 'Glosario', icon: BookOpen,
    bloques: [
      { t: 'tabla', head: ['Término', 'Definición'], filas: [
        ['Central', 'Base de datos principal que recepciona las transacciones; los usuarios se crean acá primero.'],
        ['Destino / Sucursal', 'Base de datos de un local, que recibe la replicación desde la central.'],
        ['Cola (outbox)', 'Lista de trabajos de replicación pendientes de enviar a cada destino.'],
        ['Worker', 'Proceso en segundo plano que drena la cola y reintenta lo que quedó pendiente.'],
        ['Job', 'Un trabajo de la cola = replicar un usuario a un destino.'],
        ['Dedupe', 'Evitar encolar dos veces lo mismo mientras está pendiente.'],
        ['Throttling', 'Procesar en lotes con pausas para no saturar los destinos.'],
        ['Cascada', 'Replicar en orden las dependencias (FK) de un dato antes de escribirlo.'],
        ['Bloqueado', 'Se replicó parcialmente porque faltó una dependencia que no se pudo resolver.'],
        ['Offset', 'Ajuste del IDSUCURSAL del mesero según el local destino.'],
        ['Flag', 'Interruptor de configuración (0/1): CLONAR, REPLICAR, etc.'],
      ] },
    ],
  },
];

/* ── Render de bloques ──────────────────────────────────────────────────── */
function textoDe(s: Seccion): string {
  return (s.titulo + ' ' + s.bloques.map((b) =>
    b.t === 'p' || b.t === 'sub' ? b.texto
      : b.t === 'ul' ? b.items.join(' ')
      : [...b.head, ...b.filas.flat()].join(' ')).join(' ')).toLowerCase();
}

function Bloques({ bloques }: { bloques: Bloque[] }) {
  return (
    <div className="space-y-3">
      {bloques.map((b, i) => {
        if (b.t === 'p') return <p key={i} className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">{b.texto}</p>;
        if (b.t === 'sub') return <h4 key={i} className="pt-1 text-sm font-semibold text-zinc-800 dark:text-zinc-100">{b.texto}</h4>;
        if (b.t === 'ul') return (
          <ul key={i} className="list-disc space-y-1 pl-5 text-sm text-zinc-600 dark:text-zinc-300">
            {b.items.map((it, j) => <li key={j}>{it}</li>)}
          </ul>
        );
        return (
          <div key={i} className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-700">
                  {b.head.map((h, j) => <th key={j} className="px-3 py-1.5 text-left font-semibold text-zinc-500 dark:text-zinc-400">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {b.filas.map((f, j) => (
                  <tr key={j} className="border-b border-zinc-100 dark:border-zinc-800">
                    {f.map((c, k) => <td key={k} className="px-3 py-1.5 align-top text-zinc-600 dark:text-zinc-300">{c}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

export default function DocumentacionPage() {
  const [q, setQ] = useState('');
  const filtro = q.trim().toLowerCase();

  const visibles = useMemo(
    () => (filtro ? SECCIONES.filter((s) => textoDe(s).includes(filtro)) : SECCIONES),
    [filtro],
  );

  const irA = (id: string) => document.getElementById(`doc-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="mx-auto max-w-5xl">
      {/* Encabezado */}
      <div className="mb-4 flex items-center gap-2">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand-600 text-white">
          <BookOpen className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">Documentación</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Ficha técnica del módulo — referencia para el supervisor</p>
        </div>
      </div>

      {/* Buscador */}
      <div className="relative mb-5 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          className="input pl-9 pr-9"
          placeholder="Buscar en la documentación…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {q && (
          <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex gap-6">
        {/* Índice (TOC) */}
        <nav className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-4 space-y-1">
            {visibles.map((s) => (
              <button
                key={s.id}
                onClick={() => irA(s.id)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <s.icon className="h-4 w-4 shrink-0 text-brand-500" />
                <span className="truncate">{s.titulo}</span>
              </button>
            ))}
            {visibles.length === 0 && <p className="px-3 text-xs text-zinc-400">Sin resultados</p>}
          </div>
        </nav>

        {/* Contenido */}
        <div className="min-w-0 flex-1 space-y-6">
          {visibles.map((s) => (
            <section key={s.id} id={`doc-${s.id}`} className="scroll-mt-4 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
              <div className="mb-3 flex items-center gap-2">
                <s.icon className="h-5 w-5 text-brand-600" />
                <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-100">{s.titulo}</h3>
              </div>
              <Bloques bloques={s.bloques} />
            </section>
          ))}
          {visibles.length === 0 && (
            <div className="rounded-xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
              No se encontró nada para “{q}”.
            </div>
          )}

          <p className="pb-6 text-center text-xs text-zinc-400">
            Manual de usuario — próximamente.
          </p>
        </div>
      </div>
    </div>
  );
}
