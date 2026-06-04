import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, MapPin, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { CatalogosAPI, UsuariosAPI } from '../../api/endpoints';

type Sucursal = { idsucursal: number; nombre: string };

type Props = {
  ids: string[];
  onClose: () => void;
  onDone: () => void;
};

export default function ReasignarSucursalBulkModal({ ids, onClose, onDone }: Props) {
  const sucQ = useQuery<Sucursal[]>({ queryKey: ['sucursales'], queryFn: CatalogosAPI.sucursales });
  const [idsucursal, setIdsucursal] = useState<number | ''>('');
  const [busy, setBusy] = useState(false);

  const ejecutar = async () => {
    if (typeof idsucursal !== 'number') return;
    if (!confirm(`¿Reasignar la sucursal seleccionada a ${ids.length} usuario(s)?`)) return;
    setBusy(true);
    const results = await Promise.allSettled(
      ids.map((id) => UsuariosAPI.reasignarSucursal(id, idsucursal)),
    );
    const ok = results.filter((r) => r.status === 'fulfilled' && (r.value as any)?.ok).length;
    const fail = ids.length - ok;
    if (fail === 0) toast.success(`${ok} usuario(s) reasignado(s)`);
    else if (ok === 0) toast.error(`Ningún usuario reasignado (${fail} fallos)`);
    else toast(`${ok} ok · ${fail} con error`, { icon: '⚠️' });
    setBusy(false);
    onDone();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl dark:bg-zinc-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <MapPin className="h-4 w-4 text-teal-600" />
            Reasignar sucursal · {ids.length} usuario{ids.length !== 1 ? 's' : ''}
          </h3>
          <button className="btn-ghost p-1" onClick={onClose} disabled={busy}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="mb-1 block text-xs text-zinc-500">Nueva sucursal principal</label>
        <select
          value={idsucursal}
          onChange={(e) => setIdsucursal(e.target.value ? Number(e.target.value) : '')}
          className="w-full rounded border border-zinc-200 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
          disabled={busy || sucQ.isLoading}
        >
          <option value="">— Elegir sucursal —</option>
          {(sucQ.data ?? []).map((s) => (
            <option key={s.idsucursal} value={s.idsucursal}>{s.nombre}</option>
          ))}
        </select>

        <div className="mt-4 flex justify-end gap-2">
          <button className="btn-outline" onClick={onClose} disabled={busy}>Cancelar</button>
          <button
            className="btn-primary"
            onClick={ejecutar}
            disabled={busy || typeof idsucursal !== 'number'}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Aplicar'}
          </button>
        </div>
      </div>
    </div>
  );
}
