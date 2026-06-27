import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X, MapPin, Loader2, ChevronLeft, ChevronRight, CalendarDays, Zap, Trash2, Copy,
} from 'lucide-react';
import toast from '../../lib/notify';
import { UsuariosAPI, CatalogosAPI, type Usuario } from '../../api/endpoints';

/* ── Helpers de fecha ─────────────────────────────────────────────────────── */
const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function isoFecha(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function diasDelMes(anio: number, mes: number): Date[] {
  const days: Date[] = [];
  const last = new Date(anio, mes, 0).getDate();
  for (let d = 1; d <= last; d++) days.push(new Date(anio, mes - 1, d));
  return days;
}

/* ── Paleta de colores para sucursales ───────────────────────────────────── */
const COLORS = [
  'bg-brand-500', 'bg-violet-500', 'bg-emerald-500', 'bg-rose-500',
  'bg-amber-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-pink-500',
];
const TEXT_COLORS = [
  'text-brand-700', 'text-violet-700', 'text-emerald-700', 'text-rose-700',
  'text-amber-700', 'text-cyan-700', 'text-indigo-700', 'text-pink-700',
];
const LIGHT_COLORS = [
  'bg-brand-50 border-brand-200', 'bg-violet-50 border-violet-200',
  'bg-emerald-50 border-emerald-200', 'bg-rose-50 border-rose-200',
  'bg-amber-50 border-amber-200', 'bg-cyan-50 border-cyan-200',
  'bg-indigo-50 border-indigo-200', 'bg-pink-50 border-pink-200',
];

type Sucursal = { idsucursal: number; nombre: string };

type Props = {
  usuario: Usuario;
  onClose: () => void;
};

type SelectMode = 'dia' | 'rango' | 'semanal';

export default function ReasignarSucursalModal({ usuario, onClose }: Props) {
  const qc = useQueryClient();
  const now = new Date();

  // ── Sección: Reasignación inmediata ───────────────────────────────────────
  const [sucursalInmediata, setSucursalInmediata] = useState<number | ''>('');

  // ── Sección: Calendario ───────────────────────────────────────────────────
  const [anio, setAnio] = useState(now.getFullYear());
  const [mes,  setMes]  = useState(now.getMonth() + 1);
  const [modo, setModo] = useState<SelectMode>('dia');
  const [sucursalCal, setSucursalCal] = useState<number | ''>('');
  const [rangoInicio, setRangoInicio] = useState<string | null>(null);
  // turnosDraft: fecha → idsucursal (null = borrar)
  const [turnosDraft, setTurnosDraft] = useState<Record<string, number | null>>({});
  const [calDirty, setCalDirty] = useState(false);

  const sucursalesQ = useQuery({
    queryKey: ['catalogos', 'sucursales'],
    queryFn: CatalogosAPI.sucursales,
    staleTime: 300_000,
  });

  const sucursalPrincipalQ = useQuery({
    queryKey: ['sucursal-principal', usuario.iduser],
    queryFn: () => UsuariosAPI.sucursalPrincipal(usuario.iduser),
    staleTime: 60_000,
  });

  const turnosQ = useQuery({
    queryKey: ['turnos', usuario.iduser, anio, mes],
    queryFn: () => UsuariosAPI.turnosMes(usuario.iduser, anio, mes),
    staleTime: 30_000,
  });

  const sucursales: Sucursal[] = sucursalesQ.data ?? [];

  // Mapa idSucursal → index de color
  const colorIdx = useMemo(() => {
    const m: Record<number, number> = {};
    sucursales.forEach((s, i) => { m[s.idsucursal] = i % COLORS.length; });
    return m;
  }, [sucursales]);

  // Merge turnos del servidor con el draft local
  const turnosMerged = useMemo<Record<string, number>>(() => {
    const base: Record<string, number> = {};
    for (const t of turnosQ.data ?? []) {
      base[t.fecha.slice(0, 10)] = t.idsucursal;
    }
    for (const [f, s] of Object.entries(turnosDraft)) {
      if (s === null) delete base[f];
      else base[f] = s;
    }
    return base;
  }, [turnosQ.data, turnosDraft]);

  // ── Mutación inmediata ────────────────────────────────────────────────────
  const reasignarM = useMutation({
    mutationFn: () => UsuariosAPI.reasignarSucursal(usuario.iduser, Number(sucursalInmediata)),
    onSuccess: (r: any) => {
      if (r.ok) {
        toast.success('Sucursal reasignada');
        qc.invalidateQueries({ queryKey: ['usuarios'] });
        qc.invalidateQueries({ queryKey: ['sucursal-principal', usuario.iduser] });
        sucursalPrincipalQ.refetch();
      } else {
        toast.error(r.mensaje || 'No se pudo reasignar');
      }
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Error'),
  });

  // ── Mutación calendario ───────────────────────────────────────────────────
  const guardarCalM = useMutation({
    mutationFn: () => {
      const items = Object.entries(turnosMerged).map(([fecha, idsucursal]) => ({
        idsucursal,
        fecha,
      }));
      return UsuariosAPI.guardarTurnosMes(usuario.iduser, anio, mes, items);
    },
    onSuccess: () => {
      toast.success('Programación guardada');
      setTurnosDraft({});
      setCalDirty(false);
      turnosQ.refetch();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Error guardando'),
  });

  // ── Acciones del calendario ───────────────────────────────────────────────
  const dias = diasDelMes(anio, mes);
  const primerDiaSemana = dias[0].getDay(); // 0=Dom

  const toggleDia = (fecha: string) => {
    if (!sucursalCal) { toast('Seleccioná primero una sucursal', { icon: '⚠️' }); return; }
    const idSuc = Number(sucursalCal);

    if (modo === 'dia') {
      setTurnosDraft((prev) => {
        const actual = turnosMerged[fecha];
        // Si ya tiene esta sucursal → borrar; si no → asignar
        const nuevo = actual === idSuc ? null : idSuc;
        return { ...prev, [fecha]: nuevo };
      });
      setCalDirty(true);
      return;
    }

    if (modo === 'rango') {
      if (!rangoInicio) {
        setRangoInicio(fecha);
        return;
      }
      // Confirmar rango
      const [a, b] = [rangoInicio, fecha].sort();
      const draft: Record<string, number> = {};
      const [aY, aM, aD] = a.split('-').map(Number);
      const [bY, bM, bD] = b.split('-').map(Number);
      const start = new Date(aY, aM - 1, aD);
      const end   = new Date(bY, bM - 1, bD);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        draft[isoFecha(d)] = idSuc;
      }
      setTurnosDraft((prev) => ({ ...prev, ...draft }));
      setRangoInicio(null);
      setCalDirty(true);
      return;
    }

    if (modo === 'semanal') {
      const dayOfWeek = new Date(fecha).getDay();
      const draft: Record<string, number> = {};
      for (const d of dias) {
        if (d.getDay() === dayOfWeek) draft[isoFecha(d)] = idSuc;
      }
      setTurnosDraft((prev) => ({ ...prev, ...draft }));
      setCalDirty(true);
    }
  };

  const limpiarDia = (fecha: string) => {
    setTurnosDraft((prev) => ({ ...prev, [fecha]: null }));
    setCalDirty(true);
  };

  const prevMes = () => {
    if (mes === 1) { setAnio(anio - 1); setMes(12); }
    else setMes(mes - 1);
    setRangoInicio(null);
  };
  const nextMes = () => {
    if (mes === 12) { setAnio(anio + 1); setMes(1); }
    else setMes(mes + 1);
    setRangoInicio(null);
  };

  // ── Limpiar todo el mes ───────────────────────────────────────────────────
  const limpiarMes = () => {
    const draft: Record<string, null> = {};
    for (const d of dias) draft[isoFecha(d)] = null;
    setTurnosDraft((prev) => ({ ...prev, ...draft }));
    setCalDirty(true);
  };

  // ── Copiar al mes siguiente ───────────────────────────────────────────────
  const copiarM = useMutation({
    mutationFn: () => {
      const nextMesN  = mes === 12 ? 1 : mes + 1;
      const nextAnioN = mes === 12 ? anio + 1 : anio;
      const maxDay    = new Date(nextAnioN, nextMesN, 0).getDate();

      const items = Object.entries(turnosMerged)
        .map(([fecha, idsucursal]) => {
          const day = parseInt(fecha.split('-')[2], 10);
          if (day > maxDay) return null;   // día que no existe en el mes destino
          return {
            idsucursal,
            fecha: `${nextAnioN}-${String(nextMesN).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
          };
        })
        .filter((x): x is { idsucursal: number; fecha: string } => x !== null);

      return UsuariosAPI.guardarTurnosMes(usuario.iduser, nextAnioN, nextMesN, items);
    },
    onSuccess: () => {
      const nextMesN  = mes === 12 ? 1 : mes + 1;
      const nextAnioN = mes === 12 ? anio + 1 : anio;
      toast.success(`Copiado a ${MESES[nextMesN - 1]} ${nextAnioN}`);
      qc.invalidateQueries({ queryKey: ['turnos', usuario.iduser] });
      // Navegar al mes destino para ver el resultado
      setMes(nextMesN);
      setAnio(nextAnioN);
      setTurnosDraft({});
      setCalDirty(false);
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Error al copiar'),
  });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl dark:bg-zinc-900 my-8">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-700">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-brand-600" />
            <div>
              <h3 className="font-semibold text-zinc-800 dark:text-zinc-100">
                Asignación de Sucursal — <span className="font-mono text-brand-600">{usuario.iduser}</span>
              </h3>
              <p className="text-xs text-zinc-500">{usuario.nombre} {usuario.apellido}</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost p-1"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-5 px-5 py-4">

          {/* ── Sucursal actual ──────────────────────────────────────── */}
          <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800/50">
            <MapPin className="h-4 w-4 shrink-0 text-zinc-400" />
            <div className="flex-1">
              <p className="text-xs text-zinc-500">Sucursal actual (orden 1)</p>
              {sucursalPrincipalQ.isLoading
                ? <span className="text-sm text-zinc-400">Cargando…</span>
                : sucursalPrincipalQ.data
                  ? <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                      {sucursalPrincipalQ.data.nombre}
                    </span>
                  : <span className="text-sm italic text-zinc-400">Sin sucursal asignada</span>
              }
            </div>
          </div>

          {/* ── Reasignación inmediata ───────────────────────────────── */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Reasignar ahora
              </span>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={sucursalInmediata}
                onChange={(e) => setSucursalInmediata(e.target.value === '' ? '' : Number(e.target.value))}
                className="input flex-1"
              >
                <option value="">Seleccionar sucursal…</option>
                {sucursales.map((s) => (
                  <option key={s.idsucursal} value={s.idsucursal}>{s.nombre}</option>
                ))}
              </select>
              <button
                className="btn-primary shrink-0"
                disabled={!sucursalInmediata || reasignarM.isPending}
                onClick={() => reasignarM.mutate()}
              >
                {reasignarM.isPending
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <><MapPin className="h-4 w-4" /> Reasignar</>
                }
              </button>
            </div>
            <p className="mt-1 text-xs text-zinc-400">
              Actualiza USUARIO_SUCURSAL, USUARIO_DEPOSITO y USUARIO_DEPOSITO1 con auditoría.
            </p>
          </div>

          {/* ── Divider ──────────────────────────────────────────────── */}
          <div className="flex items-center gap-2">
            <div className="flex-1 border-t border-zinc-200 dark:border-zinc-700" />
            <span className="text-xs text-zinc-400">Programar asignaciones</span>
            <div className="flex-1 border-t border-zinc-200 dark:border-zinc-700" />
          </div>

          {/* ── Controles de calendario ──────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Navegar mes */}
            <div className="flex items-center gap-1">
              <button onClick={prevMes} className="btn-ghost p-1"><ChevronLeft className="h-4 w-4" /></button>
              <span className="min-w-[140px] text-center text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {MESES[mes - 1]} {anio}
              </span>
              <button onClick={nextMes} className="btn-ghost p-1"><ChevronRight className="h-4 w-4" /></button>
            </div>

            {/* Modo de selección */}
            <div className="flex rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden text-xs">
              {(['dia', 'rango', 'semanal'] as SelectMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => { setModo(m); setRangoInicio(null); }}
                  className={`px-3 py-1.5 capitalize transition ${
                    modo === m
                      ? 'bg-brand-600 text-white'
                      : 'bg-white text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
                  }`}
                >
                  {m === 'dia' ? 'Día' : m === 'rango' ? 'Rango' : 'Semanal'}
                </button>
              ))}
            </div>

            {/* Selector de sucursal para el calendario */}
            <select
              value={sucursalCal}
              onChange={(e) => setSucursalCal(e.target.value === '' ? '' : Number(e.target.value))}
              className="input max-w-[180px] text-xs"
            >
              <option value="">— sucursal a pintar —</option>
              {sucursales.map((s, i) => (
                <option key={s.idsucursal} value={s.idsucursal}>{s.nombre}</option>
              ))}
            </select>

            {/* Limpiar todo el mes */}
            <button
              onClick={limpiarMes}
              className="btn-ghost flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700"
              title="Quitar todas las asignaciones del mes"
            >
              <Trash2 className="h-3.5 w-3.5" /> Limpiar mes
            </button>
          </div>

          {/* Hint modo */}
          {modo === 'rango' && (
            <p className="text-xs text-zinc-400">
              {rangoInicio
                ? `Desde ${rangoInicio} — clic en el día final para completar el rango`
                : 'Clic en el primer día del rango'
              }
            </p>
          )}
          {modo === 'semanal' && (
            <p className="text-xs text-zinc-400">Clic en cualquier día para asignar ese día de la semana en todo el mes</p>
          )}

          {/* ── Leyenda de sucursales ────────────────────────────────── */}
          {sucursales.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {sucursales.map((s, i) => (
                <span key={s.idsucursal}
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${LIGHT_COLORS[i % LIGHT_COLORS.length]} ${TEXT_COLORS[i % TEXT_COLORS.length]}`}
                >
                  <span className={`h-2 w-2 rounded-full ${COLORS[i % COLORS.length]}`} />
                  {s.nombre}
                </span>
              ))}
            </div>
          )}

          {/* ── Calendario cuadrícula ────────────────────────────────── */}
          {turnosQ.isLoading
            ? <div className="flex items-center justify-center py-12 text-zinc-400">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando…
              </div>
            : (
              <div className="select-none rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
                {/* Encabezado días de la semana */}
                <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-semibold text-zinc-400">
                  {DIAS_SEMANA.map((d) => <div key={d}>{d}</div>)}
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {/* Celdas vacías al inicio del mes */}
                  {Array.from({ length: primerDiaSemana }).map((_, i) => (
                    <div key={`empty-${i}`} />
                  ))}

                  {dias.map((d) => {
                    const fecha = isoFecha(d);
                    const suc = turnosMerged[fecha];
                    const idx = suc != null ? (colorIdx[suc] ?? 0) : -1;
                    const esHoy = fecha === isoFecha(now);
                    const esRangoInicio = rangoInicio === fecha;
                    const sucObj = suc != null ? sucursales.find((s) => s.idsucursal === suc) : null;
                    const enDraft = fecha in turnosDraft;

                    return (
                      <button
                        key={fecha}
                        onClick={() => toggleDia(fecha)}
                        onContextMenu={(e) => { e.preventDefault(); limpiarDia(fecha); }}
                        title={sucObj ? `${sucObj.nombre}${enDraft ? ' (sin guardar)' : ''}` : ''}
                        className={[
                          'relative flex flex-col items-center justify-center rounded-lg py-1 text-[12px] font-medium transition',
                          'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400',
                          suc != null
                            ? `${COLORS[idx]} text-white shadow-sm`
                            : 'bg-white text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700',
                          esHoy && suc == null && 'ring-2 ring-brand-400',
                          esRangoInicio && 'ring-2 ring-amber-400',
                        ].join(' ')}
                      >
                        {d.getDate()}
                        {enDraft && suc != null && (
                          <span className="absolute bottom-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-white/70" />
                        )}
                      </button>
                    );
                  })}
                </div>

                <p className="mt-2 text-[10px] text-zinc-400">
                  Clic izquierdo: asignar · Clic derecho: quitar un día · "Limpiar mes" para borrar todo
                </p>
              </div>
            )
          }
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-zinc-200 px-5 py-3 dark:border-zinc-700">
          <p className="text-xs text-zinc-400">
            {calDirty
              ? <span className="font-medium text-amber-600">Hay cambios en el calendario sin guardar</span>
              : <span>Clic derecho en un día para quitar la asignación</span>
            }
          </p>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="btn-ghost">Cerrar</button>
            <button
              onClick={() => copiarM.mutate()}
              disabled={Object.keys(turnosMerged).length === 0 || copiarM.isPending}
              className="btn-outline flex items-center gap-1.5 text-sm"
              title={`Copiar asignaciones de ${MESES[mes - 1]} al mes siguiente`}
            >
              {copiarM.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <><Copy className="h-4 w-4" /> Copiar al siguiente mes</>
              }
            </button>
            <button
              onClick={() => guardarCalM.mutate()}
              disabled={!calDirty || guardarCalM.isPending}
              className="btn-primary"
            >
              {guardarCalM.isPending
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando…</>
                : <><CalendarDays className="h-4 w-4" /> Guardar calendario</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
