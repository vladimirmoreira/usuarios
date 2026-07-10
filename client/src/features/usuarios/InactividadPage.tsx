import { useState, useMemo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Search, Power, AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import toast from '../../lib/notify';
import { CatalogosAPI, UsuariosAPI, InactivoRow, MotivoIncidencia } from '../../api/endpoints';
import { useConfirm } from '../../hooks/useConfirm';

/**
 * Página: Incidencias de cuentas.
 * Vista unificada que lista cuentas que requieren atención:
 *   - "Caducado": vigencia (HASTA_VIGENCIA) ya vencida.
 *   - "Por caducar": vigencia a vencer dentro de la ventana configurada.
 *   - "A inactivar": sin actividad en REGISTRO por más del umbral de días.
 * Se puede inhabilitar (BAJA) por fila o por lote a los caducados/inactivos
 * (los "por caducar" son informativos, todavía no vencieron).
 */
const MOTIVO: Record<MotivoIncidencia, { label: string; cls: string }> = {
  caducado:    { label: 'Caducado',    cls: 'bg-rose-100 text-rose-800' },
  inactividad: { label: 'A inactivar', cls: 'bg-amber-100 text-amber-800' },
  por_caducar: { label: 'Por caducar', cls: 'bg-sky-100 text-sky-800' },
};

const accionable = (r: InactivoRow) => r.motivo !== 'por_caducar';

export default function InactividadPage() {
  const [dias, setDias] = useState(90);
  const [diasPorCaducar, setDiasPorCaducar] = useState(30);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [ejecutado, setEjecutado] = useState(false);

  const perfilesQ = useQuery({ queryKey: ['perfiles'], queryFn: CatalogosAPI.perfiles });
  const perfilesMap = useMemo<Record<number, string>>(
    () => Object.fromEntries((perfilesQ.data ?? []).map((p: any) => [p.idtipo_usuario, p.descripcion])),
    [perfilesQ.data],
  );

  const verificarQ = useQuery({
    queryKey: ['incidencias', dias, diasPorCaducar],
    queryFn: () => UsuariosAPI.listarInactivos({ dias, diasPorCaducar }),
    enabled: false,        // Sólo bajo demanda (botón Verificar)
    gcTime: 5 * 60_000,
  });

  const rows = verificarQ.data?.rows ?? [];
  const accionables = useMemo(() => rows.filter(accionable), [rows]);

  const handleVerificar = async () => {
    setSeleccion(new Set());
    setEjecutado(true);
    await verificarQ.refetch();
  };

  const toggle = (iduser: string) =>
    setSeleccion((prev) => {
      const next = new Set(prev);
      next.has(iduser) ? next.delete(iduser) : next.add(iduser);
      return next;
    });

  const toggleAll = () =>
    setSeleccion((prev) =>
      prev.size === accionables.length ? new Set() : new Set(accionables.map((r) => r.iduser)),
    );

  const inhabilitarUno = useMutation({
    mutationFn: (iduser: string) => UsuariosAPI.inhabilitarUno(iduser),
    onSuccess: (r: any, iduser) => {
      r?.ok === false
        ? toast.error(r.mensaje || `No se pudo inhabilitar ${iduser}`)
        : toast.success(r?.detalle ? `${iduser} · ${r.detalle}` : `${iduser} inhabilitado`);
      verificarQ.refetch();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Error al inhabilitar'),
  });

  const inhabilitarLote = useMutation({
    mutationFn: () => UsuariosAPI.inhabilitarLote(Array.from(seleccion), dias),
    onSuccess: (r: any) => {
      toast.success(
        `Inhabilitados: ${r.exitosos}/${r.procesados}` +
        (r.fallidos ? ` · ${r.fallidos} con error` : '') +
        (r.omitidos?.length ? ` · ${r.omitidos.length} omitidos (ya no califican)` : ''),
      );
      setSeleccion(new Set());
      verificarQ.refetch();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Error en lote'),
  });

  const cargando = verificarQ.isFetching;
  const { confirm: confirmDialog, ConfirmDialog } = useConfirm();

  const onInhabilitarLote = async () => {
    if (!await confirmDialog({
      title: 'Inhabilitar usuarios',
      message: `¿Inhabilitar ${seleccion.size} usuario(s)? Se ejecutará una BAJA completa (sistema, mesero, biométrico, master).`,
      confirmLabel: 'Inhabilitar',
      variant: 'danger',
    })) return;
    inhabilitarLote.mutate();
  };

  const onInhabilitarUno = async (iduser: string) => {
    if (!await confirmDialog({
      title: 'Inhabilitar usuario',
      message: `¿Inhabilitar ${iduser}? Se ejecutará una BAJA completa.`,
      confirmLabel: 'Inhabilitar',
      variant: 'danger',
    })) return;
    inhabilitarUno.mutate(iduser);
  };

  // Conteo por motivo para el resumen
  const conteo = useMemo(() => {
    const c = { caducado: 0, inactividad: 0, por_caducar: 0 };
    for (const r of rows) c[r.motivo]++;
    return c;
  }, [rows]);

  return (
    <div className="space-y-3">
      <ConfirmDialog />
      {/* Cabecera */}
      <div className="card flex flex-wrap items-end justify-between gap-3 p-3">
        <div>
          <h2 className="text-base font-semibold">Incidencias de cuentas</h2>
          <p className="text-xs text-zinc-500">
            Cuentas activas que requieren atención: <strong>caducadas</strong> (vigencia vencida),
            <strong> por caducar</strong> (próximas a vencer) y <strong>a inactivar</strong> (sin actividad).
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-zinc-600">
            Inactividad (días)
            <input
              type="number" min={1} max={3650}
              value={dias}
              onChange={(e) => setDias(Math.max(1, Number(e.target.value) || 90))}
              className="mt-1 w-24 rounded border border-zinc-200 px-2 py-1 text-sm focus:outline-none"
            />
          </label>
          <label className="text-xs text-zinc-600">
            Por caducar (días)
            <input
              type="number" min={0} max={3650}
              value={diasPorCaducar}
              onChange={(e) => setDiasPorCaducar(Math.max(0, Number(e.target.value) || 0))}
              className="mt-1 w-24 rounded border border-zinc-200 px-2 py-1 text-sm focus:outline-none"
            />
          </label>
          <button className="btn-outline" onClick={handleVerificar} disabled={cargando}>
            {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Verificar
          </button>
          {ejecutado && accionables.length > 0 && (
            <button className="btn-outline border-rose-200 text-rose-700 hover:bg-rose-50"
                    disabled={seleccion.size === 0 || inhabilitarLote.isPending}
                    onClick={onInhabilitarLote}>
              <Power className="h-4 w-4" />
              Inhabilitar seleccionados ({seleccion.size})
            </button>
          )}
          <button className="btn-ghost" onClick={() => verificarQ.refetch()} disabled={!ejecutado}
                  title="Recargar">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Resumen por motivo */}
      {ejecutado && rows.length > 0 && (
        <div className="flex flex-wrap gap-2 px-1 text-xs">
          <span className={`rounded-full px-2 py-0.5 font-medium ${MOTIVO.caducado.cls}`}>Caducados: {conteo.caducado}</span>
          <span className={`rounded-full px-2 py-0.5 font-medium ${MOTIVO.inactividad.cls}`}>A inactivar: {conteo.inactividad}</span>
          <span className={`rounded-full px-2 py-0.5 font-medium ${MOTIVO.por_caducar.cls}`}>Por caducar: {conteo.por_caducar}</span>
        </div>
      )}

      {/* Resultado */}
      <div className="card overflow-hidden">
        {!ejecutado && (
          <div className="px-4 py-10 text-center text-sm text-zinc-500">
            Presioná <strong>Verificar</strong> para listar incidencias.
          </div>
        )}
        {ejecutado && !cargando && rows.length === 0 && (
          <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-emerald-700">
            <AlertTriangle className="h-4 w-4" />
            No hay incidencias con los umbrales seleccionados.
          </div>
        )}
        {rows.length > 0 && (
          <table className="w-full text-xs">
            <thead className="bg-zinc-50 text-left text-[10px] uppercase tracking-wide text-zinc-500 dark:bg-zinc-800/70 dark:text-zinc-300">
              <tr>
                <th className="px-3 py-2">
                  <input type="checkbox"
                         checked={accionables.length > 0 && seleccion.size === accionables.length}
                         onChange={toggleAll} />
                </th>
                <th className="px-3 py-2">Usuario</th>
                <th className="px-3 py-2">Nombre</th>
                <th className="px-3 py-2">Perfil</th>
                <th className="px-3 py-2">Motivo</th>
                <th className="px-3 py-2">Vigencia</th>
                <th className="px-3 py-2">Inactividad</th>
                <th className="px-3 py-2 text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: InactivoRow) => {
                const sel = seleccion.has(r.iduser);
                const puede = accionable(r);
                const m = MOTIVO[r.motivo];
                return (
                  <tr key={r.iduser} className={`border-b border-zinc-100 dark:border-zinc-700/60 ${sel ? 'bg-rose-50/40 dark:bg-rose-900/20' : ''}`}>
                    <td className="px-3 py-1.5">
                      <input type="checkbox" checked={sel} disabled={!puede}
                             title={puede ? undefined : 'Todavía no venció; no se puede inhabilitar'}
                             onChange={() => toggle(r.iduser)} />
                    </td>
                    <td className="px-3 py-1.5 font-mono">{r.iduser}</td>
                    <td className="px-3 py-1.5">{r.nombre} {r.apellido}</td>
                    <td className="px-3 py-1.5">{perfilesMap[r.idtipo_usuario] ?? r.idtipo_usuario}</td>
                    <td className="px-3 py-1.5">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${m.cls}`}>{m.label}</span>
                    </td>
                    <td className="px-3 py-1.5">
                      {r.hastaVigencia
                        ? <span>
                            {formatFecha(r.hastaVigencia)}{' '}
                            <span className={(r.diasParaCaducar ?? 0) < 0 ? 'text-rose-600' : 'text-zinc-400'}>
                              ({(r.diasParaCaducar ?? 0) < 0
                                ? `venció hace ${Math.abs(r.diasParaCaducar ?? 0)}d`
                                : `en ${r.diasParaCaducar}d`})
                            </span>
                          </span>
                        : <span className="text-zinc-300">—</span>}
                    </td>
                    <td className="px-3 py-1.5">
                      {r.diasInactivo != null
                        ? <span>{formatFecha(r.ultimaFecha)}{' '}<span className="text-zinc-400">({r.diasInactivo}d)</span></span>
                        : <span className="text-zinc-300">—</span>}
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <button className="btn-ghost p-1 disabled:opacity-30" title={puede ? 'Inhabilitar' : 'Todavía no venció'}
                              disabled={!puede || inhabilitarUno.isPending}
                              onClick={() => onInhabilitarUno(r.iduser)}>
                        <Power className="h-3.5 w-3.5 text-rose-600" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function formatFecha(s?: string): string {
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}
