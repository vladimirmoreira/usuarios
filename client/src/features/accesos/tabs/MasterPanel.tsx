import { useQuery } from '@tanstack/react-query';
import { Loader2, Database, ShieldAlert, CheckSquare, Square } from 'lucide-react';
import { CatalogosAPI, type AccesosMaster, type MenuMasterItem, type PermisoMaster } from '../../../api/endpoints';

type Props = {
  draft: AccesosMaster | null;
  esAdmin: boolean;
  onChange: (next: AccesosMaster) => void;
  readOnly?: boolean;
};

/**
 * Panel "Permisos Contabilidad / Talento Humano" (replica a BD Master).
 * - 19 checks de menú (12 Contab + 7 RRHH).
 * - 9 permisos: 4 generales, 2 admin (sólo si iduser=ADMIN), 3 RRHH.
 */
export default function MasterPanel({ draft, esAdmin, onChange, readOnly = false }: Props) {
  const permisosQ = useQuery<PermisoMaster[]>({
    queryKey: ['catalogo', 'permisos-master'],
    queryFn: CatalogosAPI.permisosMaster,
    staleTime: 5 * 60_000,
  });
  const menuQ = useQuery<MenuMasterItem[]>({
    queryKey: ['catalogo', 'menu-master'],
    queryFn: CatalogosAPI.menuMaster,
    staleTime: 5 * 60_000,
  });

  if (!draft) return null;
  if (!draft.habilitado) {
    return (
      <div className="mt-4 rounded-lg border border-dashed border-zinc-300 p-4 text-center text-xs text-zinc-500">
        <ShieldAlert className="inline h-4 w-4 mr-1 text-slate-400" />
        Replicación a Master deshabilitada (no hay BD configurada en <code>.env</code>).
      </div>
    );
  }
  if (permisosQ.isLoading || menuQ.isLoading) {
    return (
      <div className="flex items-center gap-2 py-6 justify-center text-zinc-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando permisos master…
      </div>
    );
  }

  const permisos = permisosQ.data ?? [];
  const menu = menuQ.data ?? [];
  const contab = menu.filter((m) => m.modulo === 1);
  const rrhh   = menu.filter((m) => m.modulo === 2);
  const permGen   = permisos.filter((p) => p.grupo === 'GENERAL');
  const permAdmin = permisos.filter((p) => p.grupo === 'ADMIN');
  const permRrhh  = permisos.filter((p) => p.grupo === 'RRHH');

  const toggleMenu = (pos: number) => {
    if (readOnly) return;
    const next = [...draft.menu];
    next[pos - 1] = !next[pos - 1];
    onChange({ ...draft, menu: next });
  };
  const togglePerm = (pos: number) => {
    if (readOnly) return;
    const next = [...draft.permisos];
    next[pos - 1] = !next[pos - 1];
    onChange({ ...draft, permisos: next });
  };

  const Check = ({ checked, onClick, label }: { checked: boolean; onClick: () => void; label: string }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={readOnly}
      className={`flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left text-xs focus:outline-none ${readOnly ? 'cursor-default' : 'hover:bg-zinc-50'}`}
    >
      {checked
        ? <CheckSquare className="h-3.5 w-3.5 shrink-0 text-brand-600" />
        : <Square className="h-3.5 w-3.5 shrink-0 text-zinc-300" />}
      <span className={checked ? 'text-zinc-800' : 'text-zinc-500'}>{label}</span>
    </button>
  );

  // Módulos calculados visualmente
  const contabAct = contab.some((m) => draft.menu[m.posicion - 1]);
  const rrhhAct   = rrhh.some((m) => draft.menu[m.posicion - 1]);

  return (
    <div className="pt-1">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-brand-700">
          <Database className="h-4 w-4" />
          Permisos Contabilidad / Talento Humano
        </h3>
        <div className="flex items-center gap-2 text-xs">
          <span className={`rounded-full px-2 py-0.5 ${contabAct ? 'bg-brand-100 text-brand-700' : 'bg-zinc-100 text-zinc-400'}`}>
            Contabilidad {contabAct ? 'ON' : 'off'}
          </span>
          <span className={`rounded-full px-2 py-0.5 ${rrhhAct ? 'bg-brand-100 text-brand-700' : 'bg-zinc-100 text-zinc-400'}`}>
            RRHH {rrhhAct ? 'ON' : 'off'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {/* Menú Contabilidad */}
        <div className="rounded-lg border border-zinc-200 px-3 py-2">
          <h4 className="mb-1 text-xs font-semibold text-zinc-700">Menú · Contabilidad</h4>
          <ul className="space-y-0">
            {contab.map((m) => (
              <li key={m.posicion}>
                <Check
                  checked={!!draft.menu[m.posicion - 1]}
                  onClick={() => toggleMenu(m.posicion)}
                  label={m.titulo}
                />
              </li>
            ))}
          </ul>
        </div>

        {/* Menú RRHH */}
        <div className="rounded-lg border border-zinc-200 px-3 py-2">
          <h4 className="mb-1 text-xs font-semibold text-zinc-700">Menú · RRHH</h4>
          <ul className="space-y-0">
            {rrhh.map((m) => (
              <li key={m.posicion}>
                <Check
                  checked={!!draft.menu[m.posicion - 1]}
                  onClick={() => toggleMenu(m.posicion)}
                  label={m.titulo}
                />
              </li>
            ))}
          </ul>
        </div>

        {/* Permisos */}
        <div className="rounded-lg border border-zinc-200 px-3 py-2">
          <h4 className="mb-1 text-xs font-semibold text-zinc-700">Permisos</h4>
          <ul className="space-y-0">
            {permGen.map((p) => (
              <li key={p.posicion}>
                <Check
                  checked={!!draft.permisos[p.posicion - 1]}
                  onClick={() => togglePerm(p.posicion)}
                  label={p.titulo}
                />
              </li>
            ))}
            {esAdmin && permAdmin.length > 0 && (
              <>
                <li className="mt-1 border-t border-dashed border-zinc-200 pt-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                  Admin
                </li>
                {permAdmin.map((p) => (
                  <li key={p.posicion}>
                    <Check
                      checked={!!draft.permisos[p.posicion - 1]}
                      onClick={() => togglePerm(p.posicion)}
                      label={p.titulo}
                    />
                  </li>
                ))}
              </>
            )}
            {permRrhh.length > 0 && (
              <>
                <li className="mt-1 border-t border-dashed border-zinc-200 pt-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                  RRHH
                </li>
                {permRrhh.map((p) => (
                  <li key={p.posicion}>
                    <Check
                      checked={!!draft.permisos[p.posicion - 1]}
                      onClick={() => togglePerm(p.posicion)}
                      label={p.titulo}
                    />
                  </li>
                ))}
              </>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
