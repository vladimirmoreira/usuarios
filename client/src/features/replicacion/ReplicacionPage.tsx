import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Radio, RefreshCw, Server, Loader2, AlertTriangle, CheckCircle2, Clock, Ban, UserCog } from 'lucide-react';
import toast from '../../lib/notify';
import { ReplicacionAPI, type ReplicacionDestino } from '../../api/endpoints';

const fmt = (s: string | null) => (s ? new Date(s).toLocaleString() : '—');

function Badge({ n, tone, icon: Icon, label }: {
  n: number; tone: string; icon: any; label: string;
}) {
  return (
    <span
      title={label}
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${tone} ${n === 0 ? 'opacity-40' : ''}`}
    >
      <Icon className="h-3 w-3" /> {n}
    </span>
  );
}

export default function ReplicacionPage() {
  const qc = useQueryClient();
  const [sel, setSel] = useState<number | null>(null);

  const estadoQ = useQuery({
    queryKey: ['replicacion', 'estado'],
    queryFn: ReplicacionAPI.estado,
    refetchInterval: 15_000, // la cola se drena sola cuando vuelve la VPN
  });

  const colaQ = useQuery({
    queryKey: ['replicacion', 'cola', sel],
    queryFn: () => ReplicacionAPI.cola(sel != null ? { idsucursal: sel } : {}),
    enabled: sel != null,
  });

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ['replicacion'] });
  };

  const reintentarDestinoM = useMutation({
    mutationFn: (idsucursal?: number) => ReplicacionAPI.reintentarDestino(idsucursal),
    onSuccess: () => { toast.success('Jobs fallidos reencolados'); invalidar(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Error al reintentar'),
  });

  const reintentarJobM = useMutation({
    mutationFn: (id: number) => ReplicacionAPI.reintentar(id),
    onSuccess: () => { toast.success('Job reencolado'); invalidar(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Error al reintentar'),
  });

  // ── Propagación de rol (con barra de progreso + throttling en el server) ──
  const [propagando, setPropagando] = useState<{ idtipo: number; total: number; baseline: number } | null>(null);

  const rolesPendQ = useQuery({
    queryKey: ['replicacion', 'roles-pendientes'],
    queryFn: ReplicacionAPI.rolesPendientes,
    refetchInterval: 15_000,
  });

  const progresoQ = useQuery({
    queryKey: ['replicacion', 'progreso'],
    queryFn: ReplicacionAPI.progreso,
    enabled: propagando != null,
    refetchInterval: propagando != null ? 1200 : false,
  });

  const propagarM = useMutation({
    mutationFn: async (idtipo: number) => {
      const baseline = (await ReplicacionAPI.progreso()).abierto; // jobs abiertos previos
      const r = await ReplicacionAPI.propagarRol(idtipo);
      return { idtipo, baseline, ...r };
    },
    onSuccess: (r) => {
      if (r.encolados > 0) setPropagando({ idtipo: r.idtipo, total: r.encolados, baseline: r.baseline });
      else toast.success('Sin usuarios/destinos que propagar');
      invalidar();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Error al propagar'),
  });

  // Fin de la propagación cuando los jobs abiertos vuelven al nivel previo.
  useEffect(() => {
    if (!propagando || progresoQ.data == null) return;
    const restante = Math.max(0, progresoQ.data.abierto - propagando.baseline);
    if (restante <= 0) {
      setPropagando(null);
      toast.success('Propagación completada');
      invalidar();
    }
  }, [progresoQ.data, propagando]);

  const pctProp = propagando
    ? Math.min(100, Math.round(
        100 * (propagando.total - Math.max(0, (progresoQ.data?.abierto ?? propagando.total) - propagando.baseline)) / propagando.total))
    : 0;

  const destinos = estadoQ.data?.destinos ?? [];
  const totalError = destinos.reduce((a, d) => a + d.error + d.bloqueado, 0);
  const rolesPend = rolesPendQ.data ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand-600 text-white">
            <Radio className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">Replicación</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Estado de la cola de replicación a las sucursales destino
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {totalError > 0 && (
            <button
              className="btn-outline"
              disabled={reintentarDestinoM.isPending}
              onClick={() => reintentarDestinoM.mutate(undefined)}
              title="Reencola todos los jobs en Error/Bloqueado"
            >
              <RefreshCw className="h-4 w-4" /> Reintentar todo ({totalError})
            </button>
          )}
          <button className="btn-ghost" onClick={invalidar} title="Refrescar">
            <RefreshCw className={`h-4 w-4 ${estadoQ.isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Roles pendientes de propagar */}
      {(rolesPend.length > 0 || propagando) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/40 dark:bg-amber-900/10">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-300">
            <UserCog className="h-4 w-4" /> Roles pendientes de propagar a sucursales
          </div>

          {propagando && (
            <div className="mb-3">
              <div className="mb-1 flex justify-between text-xs text-zinc-600 dark:text-zinc-300">
                <span>Propagando rol… (encola a todos sus usuarios, con throttling)</span>
                <span>{pctProp}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                <div className="h-full bg-brand-600 transition-all duration-500" style={{ width: `${pctProp}%` }} />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            {rolesPend.map((r) => (
              <div key={r.idtipo_usuario}
                className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm dark:bg-zinc-900">
                <div>
                  <span className="font-medium text-zinc-800 dark:text-zinc-100">{r.descripcion || `Rol ${r.idtipo_usuario}`}</span>
                  <span className="ml-2 text-xs text-zinc-400">#{r.idtipo_usuario} · {r.usuarios} usuario(s) · {fmt(r.fecha)}</span>
                </div>
                <button
                  className="btn-outline text-xs px-2 py-1"
                  disabled={propagando != null || propagarM.isPending}
                  onClick={() => propagarM.mutate(r.idtipo_usuario)}
                  title="Encola la replicación de todos los usuarios de este rol a las sucursales"
                >
                  {propagarM.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Radio className="h-3.5 w-3.5" />}
                  Replicar
                </button>
              </div>
            ))}
            {rolesPend.length === 0 && propagando && (
              <div className="text-xs text-zinc-500">Propagación en curso…</div>
            )}
          </div>
        </div>
      )}

      {/* Destinos */}
      {estadoQ.isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-zinc-400" /></div>
      ) : destinos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
          <Server className="mx-auto mb-2 h-6 w-6 text-zinc-400" />
          No hay destinos configurados en <code>configuracion_usuario_replica</code>.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-2 text-left">Destino</th>
                <th className="px-3 py-2 text-center">Estados de la cola</th>
                <th className="px-3 py-2 text-center"
                    title="¿Este destino tiene BD master configurada? ✓ = también se le replica RRHH/Contabilidad. — = solo system + server. No es un estado de éxito.">
                  Repl. Master
                </th>
                <th className="px-3 py-2 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {destinos.map((d: ReplicacionDestino) => {
                const conError = d.error + d.bloqueado > 0;
                return (
                  <tr
                    key={d.idsucursal}
                    className={`cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${sel === d.idsucursal ? 'bg-brand-50 dark:bg-brand-900/20' : ''}`}
                    onClick={() => setSel(sel === d.idsucursal ? null : d.idsucursal)}
                  >
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <Server className={`h-4 w-4 ${d.activo ? 'text-emerald-500' : 'text-zinc-300'}`} />
                        <div>
                          <div className="font-medium text-zinc-800 dark:text-zinc-100">{d.nombre}</div>
                          <div className="text-xs text-zinc-400">
                            #{d.idsucursal}{d.servidor ? ` · ${d.servidor}` : ''}{!d.activo ? ' · inactivo' : ''}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center justify-center gap-1.5">
                        <Badge n={d.pendiente}  label="Encolado"  icon={Clock}         tone="bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" />
                        <Badge n={d.procesando} label="Procesando" icon={Loader2}       tone="bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" />
                        <Badge n={d.enviado}    label="Enviado"    icon={CheckCircle2}  tone="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" />
                        <Badge n={d.error}      label="Error"      icon={AlertTriangle} tone="bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300" />
                        <Badge n={d.bloqueado}  label="Bloqueado (falta dependencia)" icon={Ban} tone="bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" />
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center text-xs">
                      {d.replica_master
                        ? <span className="text-emerald-600" title="Tiene BD master → replica RRHH/Contabilidad">✓</span>
                        : <span className="text-zinc-300" title="Sin BD master (solo system + server)">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {conError && (
                        <button
                          className="btn-outline text-xs px-2 py-1"
                          disabled={reintentarDestinoM.isPending}
                          onClick={(e) => { e.stopPropagation(); reintentarDestinoM.mutate(d.idsucursal); }}
                        >
                          <RefreshCw className="h-3.5 w-3.5" /> Reintentar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Detalle de la cola del destino seleccionado */}
      {sel != null && (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
          <div className="border-b border-zinc-100 px-4 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-800 dark:text-zinc-200">
            Jobs de la sucursal #{sel}
          </div>
          {colaQ.isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-zinc-400" /></div>
          ) : (colaQ.data ?? []).length === 0 ? (
            <div className="py-8 text-center text-sm text-zinc-400">Sin jobs para este destino.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                <tr>
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Usuario</th>
                  <th className="px-3 py-2 text-left">Operación</th>
                  <th className="px-3 py-2 text-left">Estado</th>
                  <th className="px-3 py-2 text-center">Int.</th>
                  <th className="px-3 py-2 text-left">Alta</th>
                  <th className="px-3 py-2 text-left">Último error</th>
                  <th className="px-3 py-2 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {(colaQ.data ?? []).map((j) => (
                  <tr key={j.id}>
                    <td className="px-3 py-1.5 text-zinc-400">{j.id}</td>
                    <td className="px-3 py-1.5 font-mono">{j.iduser}</td>
                    <td className="px-3 py-1.5">{j.operacion}</td>
                    <td className="px-3 py-1.5">{j.estado_label}</td>
                    <td className="px-3 py-1.5 text-center">{j.intentos}</td>
                    <td className="px-3 py-1.5 text-xs text-zinc-500">{fmt(j.fecha_alta)}</td>
                    <td className="px-3 py-1.5 text-xs text-red-500">{j.ultimo_error || ''}</td>
                    <td className="px-3 py-1.5 text-right">
                      {(j.estado === 3 || j.estado === 4) && (
                        <button
                          className="btn-outline text-xs px-2 py-1"
                          disabled={reintentarJobM.isPending}
                          onClick={() => reintentarJobM.mutate(j.id)}
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <p className="text-xs text-zinc-400">
        La cola se procesa automáticamente y reintenta los destinos sin conexión (VPN caída) cuando vuelven a estar en línea.
      </p>
    </div>
  );
}
