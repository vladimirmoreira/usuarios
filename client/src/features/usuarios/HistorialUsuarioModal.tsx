import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { UsuariosAPI, HistorialPage } from '../../api/endpoints';

export default function HistorialUsuarioModal({
  iduser, onClose,
}: { iduser: string; onClose: () => void }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const q = useQuery<HistorialPage>({
    queryKey: ['historial', iduser, page, pageSize],
    queryFn: () => UsuariosAPI.historial(iduser, { page, pageSize }),
    placeholderData: (prev) => prev,
  });

  const data = q.data;
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const rows = data?.rows ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto"
         onClick={onClose}>
      <div className="w-full max-w-4xl rounded-lg bg-white shadow-xl"
           onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-base font-semibold">
            Historial de <span className="font-mono">{iduser}</span>
            <span className="ml-2 text-xs font-normal text-gray-500">({total} eventos)</span>
          </h2>
          <button type="button" className="text-gray-400 hover:text-gray-700" onClick={onClose}
                  aria-label="Cerrar"><X className="h-5 w-5" /></button>
        </div>

        <div className="max-h-[65vh] overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-zinc-50 text-left text-[10px] uppercase tracking-wide text-zinc-500 dark:bg-zinc-800/70 dark:text-zinc-300">
              <tr>
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Operación</th>
                <th className="px-3 py-2">Autorización</th>
                <th className="px-3 py-2">Observación</th>
              </tr>
            </thead>
            <tbody>
              {q.isLoading && (
                <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-500">Cargando…</td></tr>
              )}
              {!q.isLoading && rows.length === 0 && (
                <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-500">Sin eventos.</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-zinc-100 dark:border-zinc-700/60">
                  <td className="px-3 py-1.5 whitespace-nowrap">{formatFecha(r.fecha)}</td>
                  <td className="px-3 py-1.5">
                    <span className="mr-1 inline-flex h-4 min-w-[1rem] items-center justify-center
                                     rounded bg-gray-900 px-1 text-[9px] font-semibold text-white">
                      {r.idoperacion}
                    </span>
                    {r.descripcion || `Op ${r.idoperacion}`}
                  </td>
                  <td className="px-3 py-1.5 font-mono">{r.autorizacion}</td>
                  <td className="px-3 py-1.5 text-gray-600">{r.observacion || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t px-4 py-2 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <span>Filas:</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="rounded border border-zinc-200 px-1.5 py-0.5 text-xs focus:outline-none"
            >
              {[25, 50, 100].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-ghost p-1 disabled:opacity-30"
                    disabled={page <= 1 || q.isFetching}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    aria-label="Anterior">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span>Página {page} de {totalPages}</span>
            <button className="btn-ghost p-1 disabled:opacity-30"
                    disabled={page >= totalPages || q.isFetching}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    aria-label="Siguiente">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatFecha(s: string): string {
  if (!s) return '';
  // El backend devuelve DATE (YYYY-MM-DD) o ISO; mostrarlo dd/mm/yyyy
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}
