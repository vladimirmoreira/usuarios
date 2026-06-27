import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Download, Upload, CheckSquare, X, Power, KeyRound, MapPin, Loader2 } from 'lucide-react';
import toast from '../../lib/notify';
import { CatalogosAPI, UsuariosAPI, ConfiguracionAPI, Usuario } from '../../api/endpoints';
import { useConfirm } from '../../hooks/useConfirm';
import AgregarUsuarioModal from './AgregarUsuarioModal';
import EditarUsuarioModal from './EditarUsuarioModal';
import UsuariosDataGrid from './UsuariosDataGrid';
import HistorialUsuarioModal from './HistorialUsuarioModal';
import ImportarUsuariosModal from './ImportarUsuariosModal';
import ReasignarSucursalModal from './ReasignarSucursalModal';
import ReasignarSucursalBulkModal from './ReasignarSucursalBulkModal';

export default function UsuariosPage() {
  const [showAgregar, setShowAgregar]       = useState(false);
  const [usuarioAEditar, setUsuarioAEditar] = useState<Usuario | null>(null);
  const [selectedId, setSelectedId]         = useState<string | null>(null);
  const [historialFor, setHistorialFor]     = useState<string | null>(null);
  const [showImportar, setShowImportar]     = useState(false);
  const [sucursalFor, setSucursalFor]       = useState<Usuario | null>(null);
  const [multiSelect, setMultiSelect]       = useState(false);
  const [selectedIds, setSelectedIds]       = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy]             = useState(false);
  const [showBulkSucursal, setShowBulkSucursal] = useState(false);
  const [barPos, setBarPos] = useState<{ x: number; y: number } | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const hoverBarRef = useRef(false);

  // Hacer que la barra flotante siga al cursor (con offset y clamp al viewport)
  useEffect(() => {
    if (!multiSelect || selectedIds.size === 0) return;
    const onMove = (e: MouseEvent) => {
      // No mover la barra si el cursor está encima de ella (permite hacer click)
      if (hoverBarRef.current) return;
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const bar = barRef.current;
        const bw = bar?.offsetWidth  ?? 420;
        const bh = bar?.offsetHeight ?? 40;
        const pad = 12;
        const offset = 18;
        let x = e.clientX + offset;
        let y = e.clientY + offset;
        if (x + bw + pad > window.innerWidth)  x = e.clientX - bw - offset;
        if (y + bh + pad > window.innerHeight) y = e.clientY - bh - offset;
        x = Math.max(pad, Math.min(x, window.innerWidth  - bw - pad));
        y = Math.max(pad, Math.min(y, window.innerHeight - bh - pad));
        setBarPos({ x, y });
      });
    };
    window.addEventListener('mousemove', onMove);
    return () => {
      window.removeEventListener('mousemove', onMove);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [multiSelect, selectedIds.size]);

  const perfilesQ = useQuery({ queryKey: ['perfiles'], queryFn: CatalogosAPI.perfiles });
  const flagsQ    = useQuery({ queryKey: ['cfg-flags'], queryFn: ConfiguracionAPI.flags });
  const usuariosQ = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => UsuariosAPI.listar({}),
  });

  const perfilesMap = useMemo<Record<number, string>>(
    () => Object.fromEntries((perfilesQ.data ?? []).map((p: any) => [p.idtipo_usuario, p.descripcion])),
    [perfilesQ.data],
  );

  const perfilesMaster = useMemo<Set<number>>(
    () => new Set((perfilesQ.data ?? []).filter((p: any) => Number(p.master) === 1).map((p: any) => p.idtipo_usuario)),
    [perfilesQ.data],
  );

  // Al montar: bloquear activos sin menús (estado 1 → 2)
  useEffect(() => {
    UsuariosAPI.bloquearSinMenu().catch(() => {}).finally(() => usuariosQ.refetch());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { confirm: confirmDialog, ConfirmDialog } = useConfirm();

  const onReset = async (iduser: string) => {
    if (!await confirmDialog({ title: 'Reiniciar clave', message: `¿Reiniciar clave de ${iduser}?`, confirmLabel: 'Reiniciar', variant: 'warning' })) return;
    try {
      const r = await UsuariosAPI.resetClave(iduser);
      r.ok
        ? toast.success(r.detalle ? `Clave reiniciada · ${r.detalle}` : 'Clave reiniciada')
        : toast.error(r.mensaje || 'No se pudo reiniciar');
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Error al reiniciar la clave');
    }
  };
  const onBaja = async (iduser: string) => {
    if (!await confirmDialog({ title: 'Dar de baja', message: `¿Dar de baja a ${iduser}?`, confirmLabel: 'Dar de baja', variant: 'danger' })) return;
    try {
      const r = await UsuariosAPI.baja(iduser);
      r.ok
        ? toast.success(r.detalle ? `Usuario inactivado · ${r.detalle}` : 'Usuario inactivado')
        : toast.error(r.mensaje || 'No se pudo dar de baja');
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Error al dar de baja');
    }
    usuariosQ.refetch();
  };
  const onReactivar = async (iduser: string) => {
    if (!await confirmDialog({ title: 'Reactivar usuario', message: `¿Reactivar a ${iduser}?`, confirmLabel: 'Reactivar', variant: 'info' })) return;
    try {
      const r = await UsuariosAPI.reactivar(iduser);
      r.ok
        ? toast.success(r.detalle ? `Usuario reactivado · ${r.detalle}` : 'Usuario reactivado')
        : toast.error(r.mensaje || 'No se pudo reactivar');
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Error al reactivar');
    }
    usuariosQ.refetch();
  };
  const onVincularLegajo = async (iduser: string) => {
    if (!await confirmDialog({ title: 'Vincular legajo', message: `¿Vincular ${iduser} con su legajo (último cargo activo)?`, confirmLabel: 'Vincular', variant: 'info' })) return;
    try {
      const r = await UsuariosAPI.vincularLegajo(iduser);
      r.ok
        ? toast.success(r.detalle ? `Vinculado · ${r.detalle}` : 'Vinculado al legajo')
        : toast.error(r.mensaje || 'No se pudo vincular');
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Error al vincular legajo');
    }
    usuariosQ.refetch();
  };

  /* ---------- Selección múltiple ---------- */
  const toggleMulti = () => {
    setMultiSelect((m) => !m);
    setSelectedIds(new Set());
  };
  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAllSelected = (ids: string[]) => {
    setSelectedIds((prev) => {
      const allChecked = ids.length > 0 && ids.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allChecked) { ids.forEach((id) => next.delete(id)); }
      else { ids.forEach((id) => next.add(id)); }
      return next;
    });
  };

  const bulkRun = async (
    label: string,
    fn: (id: string) => Promise<any>,
  ) => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    if (!await confirmDialog({ title: label, message: `¿${label} a ${ids.length} usuario(s)?`, confirmLabel: label, variant: 'warning' })) return;
    setBulkBusy(true);
    const results = await Promise.allSettled(ids.map((id) => fn(id)));
    const ok = results.filter((r) => r.status === 'fulfilled' && (r.value as any)?.ok).length;
    const fail = ids.length - ok;
    if (fail === 0) toast.success(`${ok} usuario(s) procesado(s)`);
    else if (ok === 0) toast.error(`Sin éxito (${fail} fallo(s))`);
    else toast(`${ok} ok · ${fail} con error`, { icon: '⚠️' });
    setBulkBusy(false);
    setSelectedIds(new Set());
    usuariosQ.refetch();
  };

  const onBulkBaja  = () => bulkRun('Dar de baja', UsuariosAPI.baja);
  const onBulkReset = () => bulkRun('Reiniciar clave', UsuariosAPI.resetClave);

  return (
    <div className="space-y-3">
      <ConfirmDialog />
      <div className="flex justify-end gap-2">
        <button className="btn-outline" onClick={() => setShowAgregar(true)}>
          <Plus className="h-4 w-4" /> Agregar
        </button>
        <button className="btn-outline" onClick={() => setShowImportar(true)}>
          <Upload className="h-4 w-4" /> Importar
        </button>
        <button className="btn-outline" onClick={async () => {
          try { await UsuariosAPI.exportCsv(); toast.success('CSV generado'); }
          catch (e: any) { toast.error(e?.response?.data?.error || 'Error al exportar'); }
        }}>
          <Download className="h-4 w-4" /> Exportar CSV
        </button>
        <button
          className={`btn-outline ${multiSelect ? 'border-brand-500 bg-brand-50 text-brand-700' : ''}`}
          onClick={toggleMulti}
          title="Activar/Desactivar selección múltiple (solo usuarios activos)"
        >
          <CheckSquare className="h-4 w-4" /> {multiSelect ? 'Salir selección' : 'Selección múltiple'}
        </button>
      </div>

      <UsuariosDataGrid
        data={usuariosQ.data ?? []}
        perfiles={perfilesMap}
        perfilesMaster={perfilesMaster}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onEditar={setUsuarioAEditar}
        onReset={onReset}
        onBaja={onBaja}
        onReactivar={onReactivar}
        onVincularLegajo={onVincularLegajo}
        gastronomia={flagsQ.data?.gastronomia ?? false}
        onHistorial={setHistorialFor}
        onSucursal={setSucursalFor}
        multiSelect={multiSelect}
        selectedIds={selectedIds}
        onToggleSelected={toggleSelected}
        onToggleAllSelected={toggleAllSelected}
      />
      {showAgregar && <AgregarUsuarioModal onClose={() => { setShowAgregar(false); usuariosQ.refetch(); }} />}
      {usuarioAEditar && (
        <EditarUsuarioModal
          usuario={usuarioAEditar}
          onClose={() => { setUsuarioAEditar(null); usuariosQ.refetch(); }}
        />
      )}
      {historialFor && (
        <HistorialUsuarioModal iduser={historialFor} onClose={() => setHistorialFor(null)} />
      )}
      {showImportar && (
        <ImportarUsuariosModal
          onClose={() => setShowImportar(false)}
          onImportado={() => usuariosQ.refetch()}
        />
      )}
      {sucursalFor && (
        <ReasignarSucursalModal
          usuario={sucursalFor}
          onClose={() => { setSucursalFor(null); usuariosQ.refetch(); }}
        />
      )}

      {/* Barra flotante de acciones masivas (sigue al cursor) */}
      {multiSelect && selectedIds.size > 0 && (
        <div
          ref={barRef}
          onMouseEnter={() => { hoverBarRef.current = true; }}
          onMouseLeave={() => { hoverBarRef.current = false; }}
          style={barPos
            ? { position: 'fixed', left: barPos.x, top: barPos.y }
            : { position: 'fixed', left: '50%', bottom: 16, transform: 'translateX(-50%)' }}
          className="pointer-events-auto z-40 flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 shadow-lg transition-opacity dark:border-zinc-700 dark:bg-zinc-900"
        >
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            {selectedIds.size} seleccionado{selectedIds.size !== 1 ? 's' : ''}
          </span>
          <span className="h-5 w-px bg-zinc-200 dark:bg-zinc-700" />
          <button
            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-rose-700 hover:bg-rose-50 disabled:opacity-50"
            onClick={onBulkBaja}
            disabled={bulkBusy}
            title="Dar de baja a los seleccionados"
          >
            <Power className="h-3.5 w-3.5" /> Dar de baja
          </button>
          <button
            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            onClick={onBulkReset}
            disabled={bulkBusy}
            title="Reiniciar clave de los seleccionados"
          >
            <KeyRound className="h-3.5 w-3.5" /> Reiniciar clave
          </button>
          <button
            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-teal-700 hover:bg-teal-50 disabled:opacity-50"
            onClick={() => setShowBulkSucursal(true)}
            disabled={bulkBusy}
            title="Reasignar sucursal de los seleccionados"
          >
            <MapPin className="h-3.5 w-3.5" /> Reasignar sucursal
          </button>
          {bulkBusy && <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />}
          <span className="h-5 w-px bg-zinc-200 dark:bg-zinc-700" />
          <button
            className="rounded p-1 hover:bg-zinc-100"
            onClick={() => setSelectedIds(new Set())}
            disabled={bulkBusy}
            title="Limpiar selección"
          >
            <X className="h-4 w-4 text-zinc-500" />
          </button>
        </div>
      )}

      {showBulkSucursal && (
        <ReasignarSucursalBulkModal
          ids={Array.from(selectedIds)}
          onClose={() => setShowBulkSucursal(false)}
          onDone={() => { setSelectedIds(new Set()); usuariosQ.refetch(); }}
        />
      )}
    </div>
  );
}
