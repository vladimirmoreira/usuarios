import { ArrowUp, ArrowDown, Check, CheckSquare, Square } from 'lucide-react';
import type { SucursalUsuarioItem } from '../../../api/endpoints';

type Props = {
  items: SucursalUsuarioItem[];
  onChange: (items: SucursalUsuarioItem[]) => void;
};

export default function SucursalesTab({ items, onChange }: Props) {
  const toggle = (idx: number) => {
    const next = items.map((it, i) => (i === idx ? { ...it, habilitada: !it.habilitada } : it));
    onChange(next);
  };

  const setOrden = (idx: number, val: number) => {
    const next = items.map((it, i) => (i === idx ? { ...it, orden: val } : it));
    onChange(next);
  };

  const moverArriba = (idx: number) => {
    if (idx === 0) return;
    const next = [...items];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    // renumerar orden visual
    next.forEach((it, i) => (it.orden = i + 1));
    onChange(next);
  };

  const moverAbajo = (idx: number) => {
    if (idx === items.length - 1) return;
    const next = [...items];
    [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
    next.forEach((it, i) => (it.orden = i + 1));
    onChange(next);
  };

  const habilitarTodos = () =>
    onChange(items.map((it) => ({ ...it, habilitada: true })));
  const deshabilitarTodos = () =>
    onChange(items.map((it) => ({ ...it, habilitada: false })));

  const totalHabilitadas = items.filter((i) => i.habilitada).length;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm text-zinc-600">
          <span className="font-medium text-zinc-800">{totalHabilitadas}</span>{' '}
          de {items.length} sucursales habilitadas
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={habilitarTodos} className="btn-ghost text-xs">
            <Check className="h-3.5 w-3.5" /> Habilitar todas
          </button>
          <button type="button" onClick={deshabilitarTodos} className="btn-ghost text-xs">
            Deshabilitar todas
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-200">
        <table className="w-full text-xs">
          <thead className="bg-zinc-50 text-[10px] uppercase tracking-wide text-zinc-600 dark:bg-zinc-800/70 dark:text-zinc-300">
            <tr>
              <th className="w-14 px-2 py-1 text-left">Cód.</th>
              <th className="px-2 py-1 text-left">Nombre</th>
              <th className="w-16 px-2 py-1 text-center">Hab.</th>
              <th className="w-16 px-2 py-1 text-center">Orden</th>
              <th className="w-16 px-2 py-1 text-center">Mover</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => (
              <tr key={it.idsucursal} className="border-t border-zinc-100 hover:bg-zinc-50 dark:border-zinc-700/60 dark:hover:bg-zinc-800/50">
                <td className="px-2 py-0.5 font-mono text-zinc-500">{it.idsucursal}</td>
                <td className="px-2 py-0.5">{it.nombre}</td>
                <td className="px-2 py-0.5 text-center">
                  <button
                    type="button"
                    onClick={() => toggle(idx)}
                    className="focus:outline-none"
                  >
                    {it.habilitada
                      ? <CheckSquare className="h-3.5 w-3.5 text-brand-600" />
                      : <Square className="h-3.5 w-3.5 text-zinc-300" />}
                  </button>
                </td>
                <td className="px-2 py-0.5 text-center">
                  <input
                    type="number"
                    min={0}
                    disabled={!it.habilitada}
                    value={it.orden ?? 0}
                    onChange={(e) => setOrden(idx, Number(e.target.value) || 0)}
                    className="w-14 rounded border border-zinc-200 px-1 py-0 text-center text-xs disabled:opacity-40"
                  />
                </td>
                <td className="px-2 py-0.5">
                  <div className="flex justify-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => moverArriba(idx)}
                      disabled={idx === 0}
                      className="rounded p-0.5 text-zinc-500 hover:bg-zinc-200 disabled:opacity-30"
                      title="Subir"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moverAbajo(idx)}
                      disabled={idx === items.length - 1}
                      className="rounded p-0.5 text-zinc-500 hover:bg-zinc-200 disabled:opacity-30"
                      title="Bajar"
                    >
                      <ArrowDown className="h-3 w-3" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-2 py-4 text-center text-xs text-zinc-400">
                  No hay sucursales en el catálogo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
