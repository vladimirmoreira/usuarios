import { CheckSquare, Square } from 'lucide-react';

export default function FlagsTab({
  titulo,
  catalogo,
  flags,
  onChange,
  onSelect,
  columnas = 2,
  readOnly = false,
}: {
  titulo: string;
  catalogo: string[];
  flags: boolean[];
  onChange: (next: boolean[]) => void;
  /** Si se provee, el ícono togglea y el texto llama a onSelect(índice). */
  onSelect?: (index: number) => void;
  columnas?: 1 | 2 | 3 | 4;
  readOnly?: boolean;
}) {
  const colCls = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' }[columnas];
  const total = catalogo.length;
  const activos = flags.slice(0, total).filter(Boolean).length;

  const toggle = (i: number) => {
    if (readOnly) return;
    const next = [...flags];
    next[i] = !next[i];
    onChange(next);
  };
  const setAll = (v: boolean) => { if (!readOnly) onChange(catalogo.map(() => v)); };

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-700">{titulo}</h3>
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <span>{activos}/{total} activos</span>
          {!readOnly && (
            <>
              <button className="text-brand-600 hover:underline" onClick={() => setAll(true)}>Marcar todos</button>
              <button className="text-zinc-500 hover:underline" onClick={() => setAll(false)}>Limpiar</button>
            </>
          )}
        </div>
      </div>

      <div className={`grid gap-x-3 gap-y-0.5 ${colCls}`}>
        {catalogo.map((label, i) =>
          onSelect ? (
            // Modo dividido: ícono = toggle, texto = navegar
            <div
              key={`${label}-${i}`}
              className="flex items-center gap-1.5 rounded px-2 py-0.5 text-sm"
            >
              <button
                onClick={() => toggle(i)}
                title={readOnly ? undefined : (flags[i] ? 'Deshabilitar' : 'Habilitar')}
                className={`shrink-0 rounded focus:outline-none ${readOnly ? 'cursor-default' : 'focus:ring-1 focus:ring-brand-500'}`}
                disabled={readOnly}
              >
                {flags[i] ? (
                  <CheckSquare className="h-4 w-4 text-brand-600" />
                ) : (
                  <Square className="h-4 w-4 text-zinc-300" />
                )}
              </button>
              <button
                onClick={() => onSelect(i)}
                className={`flex-1 text-left text-xs hover:underline focus:outline-none ${
                  flags[i] ? 'text-zinc-800' : 'text-zinc-500'
                }`}
              >
                {label}
              </button>
            </div>
          ) : (
            // Modo original: fila completa togglea
            <button
              key={`${label}-${i}`}
              onClick={() => toggle(i)}
              disabled={readOnly}
              className={`flex items-center gap-1.5 rounded px-2 py-0.5 text-left text-xs ${readOnly ? 'cursor-default' : 'hover:bg-zinc-50'}`}
            >
              {flags[i] ? (
                <CheckSquare className="h-4 w-4 shrink-0 text-brand-600" />
              ) : (
                <Square className="h-4 w-4 shrink-0 text-zinc-300" />
              )}
              <span className={flags[i] ? 'text-zinc-800' : 'text-zinc-500'}>{label}</span>
            </button>
          ),
        )}
      </div>
    </div>
  );
}
