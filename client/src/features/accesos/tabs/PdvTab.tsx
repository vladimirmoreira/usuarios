import { CheckSquare, Square } from 'lucide-react';

type PdvItem = { idpermiso: number; descripcion: string; indice: number };

/**
 * Pestaña Punto de Ventas: muestra el catálogo TMP$USUARIO_PERMISOS_PDV
 * posicionando cada ítem por su `idpermiso` (= número de ítem del menú legacy)
 * contra el string posicional MENU_GG_2. El carácter del ítem N vive en
 * `menu_gg_2[N-1]` (base 0). El campo `indice` del catálogo ya no se usa.
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
  // Posición en menu_gg_2 (base 0) del ítem legacy identificado por idpermiso.
  const pos = (c: PdvItem) => c.idpermiso - 1;

  const toggle = (idx: number) => {
    if (readOnly) return;
    const next = [...flags];
    next[idx] = !next[idx];
    onChange(next);
  };

  const activos = catalogo.filter((c) => flags[pos(c)]).length;

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
            onClick={() => toggle(pos(c))}
            disabled={readOnly}
            className={`flex items-center gap-1.5 rounded px-2 py-0.5 text-left text-xs ${readOnly ? 'cursor-default' : 'hover:bg-zinc-50'}`}
          >
            {flags[pos(c)] ? (
              <CheckSquare className="h-3.5 w-3.5 text-brand-600" />
            ) : (
              <Square className="h-3.5 w-3.5 text-zinc-300" />
            )}
            <span className={flags[pos(c)] ? 'text-zinc-800' : 'text-zinc-500'}>
              {c.descripcion}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
