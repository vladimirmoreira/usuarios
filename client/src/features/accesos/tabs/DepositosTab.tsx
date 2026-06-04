import { useMemo } from 'react';
import { AlertTriangle, CheckSquare, Square } from 'lucide-react';
import type { DepositoUsuarioItem, SucursalUsuarioItem } from '../../../api/endpoints';

type Props = {
  items: DepositoUsuarioItem[];
  /** Necesario para validar la regla: salida solo si la sucursal del depósito está habilitada. */
  sucursales: SucursalUsuarioItem[];
  onChange: (items: DepositoUsuarioItem[]) => void;
};

export default function DepositosTab({ items, sucursales, onChange }: Props) {
  const sucMap = useMemo(() => {
    const m = new Map<number, SucursalUsuarioItem>();
    for (const s of sucursales) m.set(s.idsucursal, s);
    return m;
  }, [sucursales]);

  const isSalidaPermitida = (it: DepositoUsuarioItem) =>
    sucMap.get(it.idsucursal)?.habilitada === true;

  const set = (idx: number, patch: Partial<DepositoUsuarioItem>) => {
    const next = items.map((it, i) => (i === idx ? { ...it, ...patch } : it));
    onChange(next);
  };

  const toggleSalida = (idx: number) => {
    const it = items[idx];
    if (!isSalidaPermitida(it)) return; // bloqueado por regla
    set(idx, { salida: !it.salida });
  };

  const toggleEntrada = (idx: number) => set(idx, { entrada: !items[idx].entrada });

  const habilitarTodosSalida = () => {
    const next = items.map((it) =>
      isSalidaPermitida(it) ? { ...it, salida: true } : it,
    );
    onChange(next);
  };
  const deshabilitarTodosSalida = () =>
    onChange(items.map((it) => ({ ...it, salida: false })));

  const habilitarTodosEntrada = () =>
    onChange(items.map((it) => ({ ...it, entrada: true })));
  const deshabilitarTodosEntrada = () =>
    onChange(items.map((it) => ({ ...it, entrada: false })));

  const conflictos = items.filter((it) => it.salida && !isSalidaPermitida(it));
  const totalSalida = items.filter((i) => i.salida).length;
  const totalEntrada = items.filter((i) => i.entrada).length;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-zinc-600">
          <span className="font-medium text-zinc-800">{totalSalida}</span> salida &nbsp;·&nbsp;
          <span className="font-medium text-zinc-800">{totalEntrada}</span> entrada &nbsp;·&nbsp;
          {items.length} depósitos
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={habilitarTodosSalida} className="btn-ghost text-xs">
            Todos salida
          </button>
          <button type="button" onClick={deshabilitarTodosSalida} className="btn-ghost text-xs">
            Ninguno salida
          </button>
          <span className="text-slate-300">|</span>
          <button type="button" onClick={habilitarTodosEntrada} className="btn-ghost text-xs">
            Todos entrada
          </button>
          <button type="button" onClick={deshabilitarTodosEntrada} className="btn-ghost text-xs">
            Ninguno entrada
          </button>
        </div>
      </div>

      {conflictos.length > 0 && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            <strong>{conflictos.length}</strong> depósito(s) marcado(s) como salida tienen su sucursal deshabilitada.
            Al guardar se descartarán automáticamente (regla del sistema legado).
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-zinc-200">
        <table className="w-full text-xs">
          <thead className="bg-zinc-50 text-[10px] uppercase tracking-wide text-zinc-600 dark:bg-zinc-800/70 dark:text-zinc-300">
            <tr>
              <th className="w-12 px-2 py-1 text-left">Cód.</th>
              <th className="px-2 py-1 text-left">Depósito</th>
              <th className="w-40 px-2 py-1 text-left">Sucursal</th>
              <th className="w-14 px-2 py-1 text-center" title="Salida">Sal.</th>
              <th className="w-14 px-2 py-1 text-center" title="Entrada">Ent.</th>
              <th className="w-16 px-2 py-1 text-center">Ord.S</th>
              <th className="w-16 px-2 py-1 text-center">Ord.E</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => {
              const suc = sucMap.get(it.idsucursal);
              const salidaPermitida = isSalidaPermitida(it);
              return (
                <tr
                  key={it.iddeposito}
                  className={`border-t border-zinc-100 hover:bg-zinc-50 dark:border-zinc-700/60 dark:hover:bg-zinc-800/50 ${
                    it.salida && !salidaPermitida ? 'bg-amber-50 dark:bg-amber-900/20' : ''
                  }`}
                >
                  <td className="px-2 py-0.5 font-mono text-zinc-500">{it.iddeposito}</td>
                  <td className="px-2 py-0.5">{it.descripcion}</td>
                  <td className="px-2 py-0.5">
                    <span className="font-mono text-slate-400">{it.idsucursal}</span>{' '}
                    <span className={suc?.habilitada ? 'text-zinc-700' : 'text-zinc-400 line-through'}>
                      {suc?.nombre ?? '—'}
                    </span>
                  </td>
                  <td className="px-2 py-0.5 text-center">
                    <button
                      type="button"
                      onClick={() => toggleSalida(idx)}
                      disabled={!salidaPermitida}
                      title={salidaPermitida ? '' : 'Sucursal deshabilitada — no puede marcarse como salida'}
                      className="disabled:opacity-30 focus:outline-none"
                    >
                      {it.salida
                        ? <CheckSquare className="h-3.5 w-3.5 text-brand-600" />
                        : <Square className="h-3.5 w-3.5 text-zinc-300" />}
                    </button>
                  </td>
                  <td className="px-2 py-0.5 text-center">
                    <button
                      type="button"
                      onClick={() => toggleEntrada(idx)}
                      className="focus:outline-none"
                    >
                      {it.entrada
                        ? <CheckSquare className="h-3.5 w-3.5 text-brand-600" />
                        : <Square className="h-3.5 w-3.5 text-zinc-300" />}
                    </button>
                  </td>
                  <td className="px-2 py-0.5 text-center">
                    <input
                      type="number"
                      min={0}
                      disabled={!it.salida}
                      value={it.ordenSalida ?? 0}
                      onChange={(e) =>
                        set(idx, { ordenSalida: Number(e.target.value) || 0 })
                      }
                      className="w-14 rounded border border-zinc-200 px-1 py-0 text-center text-xs disabled:opacity-40"
                    />
                  </td>
                  <td className="px-2 py-0.5 text-center">
                    <input
                      type="number"
                      min={0}
                      disabled={!it.entrada}
                      value={it.ordenEntrada ?? 0}
                      onChange={(e) =>
                        set(idx, { ordenEntrada: Number(e.target.value) || 0 })
                      }
                      className="w-14 rounded border border-zinc-200 px-1 py-0 text-center text-xs disabled:opacity-40"
                    />
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-2 py-4 text-center text-xs text-zinc-400">
                  No hay depósitos en el catálogo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
