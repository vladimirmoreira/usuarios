import { CheckSquare, Square } from 'lucide-react';

type PdvItem = { idpermiso: number; descripcion: string; indice: number };

/**
 * Pestaña Punto de Ventas: muestra el catálogo TMP$USUARIO_PERMISOS_PDV
 * mapeando por `indice` contra el string posicional MENU_GG_2.
 */
export default function PdvTab({
  catalogo,
  flags,
  onChange,
  readOnly = false,
}: {
  catalogo: PdvItem[];
  flags: boolean[];
  onChange: (next: boolean[]) => void;
  readOnly?: boolean;
}) {
  const toggle = (idx: number) => {
    if (readOnly) return;
    const next = [...flags];
    next[idx] = !next[idx];
    onChange(next);
  };

  const activos = catalogo.filter((c) => flags[c.indice]).length;

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-700">Permisos Punto de Ventas</h3>
        <span className="text-xs text-zinc-500">{activos}/{catalogo.length} activos</span>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 md:grid-cols-3 lg:grid-cols-4">
        {catalogo.map((c) => (
          <button
            key={c.idpermiso}
            onClick={() => toggle(c.indice)}
            disabled={readOnly}
            className={`flex items-center gap-1.5 rounded px-2 py-0.5 text-left text-xs ${readOnly ? 'cursor-default' : 'hover:bg-zinc-50'}`}
          >
            {flags[c.indice] ? (
              <CheckSquare className="h-3.5 w-3.5 text-brand-600" />
            ) : (
              <Square className="h-3.5 w-3.5 text-zinc-300" />
            )}
            <span className={flags[c.indice] ? 'text-zinc-800' : 'text-zinc-500'}>
              {c.descripcion}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
