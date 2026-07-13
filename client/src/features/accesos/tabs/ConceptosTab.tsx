import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, ChevronDown, CheckSquare, Square, MinusSquare, Pencil, Save, X } from 'lucide-react';
import type { ConceptoConfig, GrupoConceptos, PermisoConcepto } from '../../../api/endpoints';
import { CatalogosAPI } from '../../../api/endpoints';

type Scope = 'rol' | 'usuario';

type Props = {
  grupos: GrupoConceptos[];
  permisosCatalogo: PermisoConcepto[];
  onChange: (grupos: GrupoConceptos[]) => void;
  /** Tipo seleccionado externamente (controlado). Si se omite, gestión interna. */
  selectedTipo?: number | null;
  onTipoChange?: (tipo: number) => void;
  /** 'usuario' habilita 5 campos de personalización por concepto. 'rol' los oculta. */
  scope?: Scope;
  readOnly?: boolean;
};

// Fallback si TMP$USUARIO_PERMISOS_CONCEPTOS está vacía
const PERMISOS_FALLBACK: PermisoConcepto[] = [
  { idpermiso_concepto: 0,  descripcion: 'Detalle de Comprobante Directo' },
  { idpermiso_concepto: 1,  descripcion: 'Activar Permisos' },
  { idpermiso_concepto: 2,  descripcion: 'Agregar' },
  { idpermiso_concepto: 3,  descripcion: 'Modificar' },
  { idpermiso_concepto: 4,  descripcion: 'Eliminar' },
  { idpermiso_concepto: 5,  descripcion: 'Anular' },
  { idpermiso_concepto: 6,  descripcion: 'Imprimir' },
  { idpermiso_concepto: 7,  descripcion: 'Estado' },
  { idpermiso_concepto: 8,  descripcion: 'Menu PopUp' },
  { idpermiso_concepto: 9,  descripcion: 'Autorizar/Rechazar Pedido' },
  { idpermiso_concepto: 10, descripcion: 'Informes' },
  { idpermiso_concepto: 11, descripcion: 'Registradora' },
  { idpermiso_concepto: 12, descripcion: 'Emitir Pagares' },
  { idpermiso_concepto: 13, descripcion: 'Generar Facturas' },
  { idpermiso_concepto: 14, descripcion: 'Preparar Pedidos' },
];

// ── Panel de permisos globales por grupo ──────────────────────────────────────
function GlobalPermisosPanel({
  grupo,
  catalogo,
  onApply,
  readOnly = false,
}: {
  grupo: GrupoConceptos;
  catalogo: PermisoConcepto[];
  onApply: (conceptos: ConceptoConfig[]) => void;
  readOnly?: boolean;
}) {
  const activos = grupo.conceptos.filter((c) => c.permiso === 1);
  const n = activos.length;

  // El panel siempre se muestra (no se oculta en rol nuevo), pero queda
  // deshabilitado mientras no haya conceptos elegidos: sin conceptos activos
  // no hay a qué aplicar los permisos en lote.
  const disabled = readOnly || n === 0;

  // Estado de cada permiso: 'all' | 'partial' | 'none'
  const estados = catalogo.map((_, i) => {
    const count = activos.filter((c) => c.permisoVarios[i]).length;
    return count === 0 ? 'none' : count === n ? 'all' : 'partial';
  });

  const toggleGlobal = (i: number) => {
    if (disabled) return;
    const setTo = estados[i] !== 'all'; // si ya están todos, quitar; si no, poner
    onApply(
      grupo.conceptos.map((c) => {
        if (c.permiso !== 1) return c;
        const next = [...c.permisoVarios];
        next[i] = setTo;
        return { ...c, permisoVarios: next };
      }),
    );
  };

  const setAllGlobal = (v: boolean) => {
    if (disabled) return;
    onApply(
      grupo.conceptos.map((c) => {
        if (c.permiso !== 1) return c;
        return { ...c, permisoVarios: c.permisoVarios.map(() => v) };
      }),
    );
  };

  return (
    <div className={`mb-2 rounded-lg border px-3 py-2 ${n === 0 ? 'border-zinc-200 bg-zinc-50' : 'border-brand-200 bg-brand-50'}`}>
      <div className="mb-1.5 flex items-center justify-between">
        <span className={`text-xs font-semibold uppercase tracking-wide ${n === 0 ? 'text-zinc-400' : 'text-brand-700'}`}>
          {n === 0
            ? 'Permisos globales — elegí conceptos para aplicarlos en lote'
            : `Permisos globales — aplica a ${n} concepto${n !== 1 ? 's' : ''} activo${n !== 1 ? 's' : ''}`}
        </span>
        {!disabled && (
          <div className="flex gap-3 text-xs">
            <button className="text-brand-600 hover:underline" onClick={() => setAllGlobal(true)}>
              Marcar todos
            </button>
            <button className="text-zinc-400 hover:underline" onClick={() => setAllGlobal(false)}>
              Limpiar
            </button>
          </div>
        )}
      </div>
      <div className={`grid grid-cols-3 gap-x-4 gap-y-0.5 ${n === 0 ? 'opacity-60' : ''}`}>
        {catalogo.map((p, i) => (
          <button
            key={p.idpermiso_concepto}
            onClick={() => toggleGlobal(i)}
            disabled={disabled}
            title={
              disabled
                ? (n === 0 ? 'Marcá conceptos activos para habilitar los permisos globales' : undefined)
                : estados[i] === 'all'
                ? 'Todos los conceptos activos lo tienen — clic para quitar'
                : estados[i] === 'partial'
                  ? 'Algunos conceptos lo tienen — clic para marcar todos'
                  : 'Ningún concepto activo lo tiene — clic para marcar todos'
            }
            className={`flex items-center gap-1.5 rounded px-1.5 py-0.5 text-left text-xs ${disabled ? 'cursor-not-allowed' : 'hover:bg-brand-100'}`}
          >
            {estados[i] === 'all' ? (
              <CheckSquare className="h-3.5 w-3.5 shrink-0 text-brand-600" />
            ) : estados[i] === 'partial' ? (
              <MinusSquare className="h-3.5 w-3.5 shrink-0 text-amber-400" />
            ) : (
              <Square className="h-3.5 w-3.5 shrink-0 text-zinc-300" />
            )}
            <span className={estados[i] !== 'none' ? 'text-zinc-700' : 'text-zinc-400'}>
              {i}-{p.descripcion}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Panel de configuración adicional por concepto (solo modo usuario) ───────
function ConfigAdicionalesPanel({
  concepto,
  onChange,
}: {
  concepto: ConceptoConfig;
  onChange: (next: ConceptoConfig) => void;
}) {
  const talQ  = useQuery({ queryKey: ['cat','talonarios'],  queryFn: CatalogosAPI.talonarios,  staleTime: 5*60_000 });
  const venQ  = useQuery({ queryKey: ['cat','vendedores'],  queryFn: CatalogosAPI.vendedores,  staleTime: 5*60_000 });
  const plaQ  = useQuery({ queryKey: ['cat','planventas'],  queryFn: CatalogosAPI.planventas,  staleTime: 5*60_000 });
  const conQ  = useQuery({ queryKey: ['cat','condiciones'], queryFn: CatalogosAPI.condiciones, staleTime: 5*60_000 });

  const setField = <K extends keyof ConceptoConfig>(k: K, v: ConceptoConfig[K]) =>
    onChange({ ...concepto, [k]: v });

  const numOrNull = (s: string) => (s === '' ? null : Number(s));
  const fmtFecha = (s: string | null) => {
    if (!s) return '';
    const d = new Date(s);
    return isNaN(d.getTime()) ? s : d.toLocaleDateString();
  };

  return (
    <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
      <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-amber-700">
        Configuración adicional (por usuario)
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 lg:grid-cols-5">
        {/* Talonario */}
        <div>
          <label className="block text-[10px] font-medium text-zinc-600">Talonario</label>
          <select
            className="input mt-0.5 py-0.5 text-xs"
            value={concepto.idtalonario ?? ''}
            onChange={(e) => setField('idtalonario', numOrNull(e.target.value))}
          >
            <option value="">— sin asignar</option>
            {(talQ.data ?? []).map((t) => (
              <option key={t.idtalonario} value={t.idtalonario}>
                {t.sucursal ? `[${t.sucursal}] ` : ''}#{t.idtalonario}
                {t.desde != null && t.hasta != null ? ` (${t.desde}–${t.hasta})` : ''}
                {t.vencimiento ? ` vence ${fmtFecha(t.vencimiento)}` : ''}
              </option>
            ))}
          </select>
        </div>
        {/* Persona (input numérico libre, son millones) */}
        <div>
          <label className="block text-[10px] font-medium text-zinc-600">Persona (id)</label>
          <input
            type="number"
            className="input mt-0.5 py-0.5 text-xs font-mono"
            value={concepto.idpersona ?? ''}
            onChange={(e) => setField('idpersona', numOrNull(e.target.value))}
            placeholder="ID contribuyente"
          />
        </div>
        {/* Vendedor */}
        <div>
          <label className="block text-[10px] font-medium text-zinc-600">Vendedor</label>
          <select
            className="input mt-0.5 py-0.5 text-xs"
            value={concepto.idvendedor ?? ''}
            onChange={(e) => setField('idvendedor', numOrNull(e.target.value))}
          >
            <option value="">— sin asignar</option>
            {(venQ.data ?? []).map((v) => (
              <option key={v.idvendedor} value={v.idvendedor}>
                {v.apellido}, {v.nombre}
              </option>
            ))}
          </select>
        </div>
        {/* Plan de venta */}
        <div>
          <label className="block text-[10px] font-medium text-zinc-600">Plan venta</label>
          <select
            className="input mt-0.5 py-0.5 text-xs"
            value={concepto.idplanventa ?? ''}
            onChange={(e) => setField('idplanventa', numOrNull(e.target.value))}
          >
            <option value="">— sin asignar</option>
            {(plaQ.data ?? []).map((p) => (
              <option key={p.idplanventa} value={p.idplanventa}>{p.descripcion}</option>
            ))}
          </select>
        </div>
        {/* Condición */}
        <div>
          <label className="block text-[10px] font-medium text-zinc-600">Condición</label>
          <select
            className="input mt-0.5 py-0.5 text-xs"
            value={concepto.idcondicion ?? ''}
            onChange={(e) => setField('idcondicion', numOrNull(e.target.value))}
          >
            <option value="">— sin asignar</option>
            {(conQ.data ?? []).map((c) => (
              <option key={c.idcondicion} value={c.idcondicion}>{c.descripcion}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

// ── Fila individual por concepto ────────────────────────────────
function ConceptoRow({
  concepto,
  catalogo,
  scope,
  onChange,
  readOnly = false,
}: {
  concepto: ConceptoConfig;
  catalogo: PermisoConcepto[];
  scope: Scope;
  onChange: (next: ConceptoConfig) => void;
  readOnly?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing]   = useState(false);
  // Buffer local de permisos durante la edición (no propaga hasta Guardar)
  const [draft, setDraft]       = useState<boolean[]>(concepto.permisoVarios);

  const permisos = editing ? draft : concepto.permisoVarios;
  const activosIdx = permisos
    .map((v, i) => (v ? i : -1))
    .filter((i) => i >= 0);
  const activosLabels = activosIdx.map((i) => catalogo[i]?.descripcion ?? `P${i}`);
  const resumen =
    activosLabels.length === 0
      ? 'sin permisos'
      : activosLabels.slice(0, 4).join(', ') + (activosLabels.length > 4 ? '…' : '');

  const togglePermiso = (i: number) => {
    if (readOnly || !editing) return;
    const next = [...draft];
    next[i] = !next[i];
    setDraft(next);
  };

  const setAll = (v: boolean) => {
    if (readOnly || !editing) return;
    setDraft(draft.map(() => v));
  };

  const startEdit = () => {
    setDraft(concepto.permisoVarios);
    setEditing(true);
  };
  const cancelEdit = () => {
    setDraft(concepto.permisoVarios);
    setEditing(false);
  };
  const saveEdit = () => {
    onChange({ ...concepto, permisoVarios: draft });
    setEditing(false);
  };

  return (
    <div className="border border-zinc-100 rounded-lg overflow-hidden">
      {/* Cabecera del concepto */}
      <div
        className="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-zinc-50 select-none"
        onClick={() => setExpanded((e) => !e)}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" />
        )}

        {/* Toggle permiso general del concepto */}
        <button
          className="shrink-0"
          title={readOnly ? undefined : 'Habilitar/deshabilitar concepto'}
          disabled={readOnly}
          onClick={(e) => {
            e.stopPropagation();
            if (!readOnly) onChange({ ...concepto, permiso: concepto.permiso ? 0 : 1 });
          }}
        >
          {concepto.permiso ? (
            <CheckSquare className="h-4 w-4 text-brand-600" />
          ) : (
            <Square className="h-4 w-4 text-zinc-300" />
          )}
        </button>

        <span className="text-sm font-medium text-zinc-700 shrink-0">
          {concepto.idtipomovimiento} - {concepto.descripcion}
        </span>
        <span className="text-xs text-zinc-400 ml-1 truncate">
          ({activosIdx.length}/{catalogo.length}: {resumen})
        </span>
      </div>

      {/* Grid de permisos (expandido) */}
      {expanded && (
        <div className="px-3 py-2 bg-zinc-50 border-t border-zinc-100">
          {scope === 'usuario' && (
            <ConfigAdicionalesPanel concepto={concepto} onChange={onChange} />
          )}
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
              Permisos de acción {editing && <span className="ml-1 text-amber-600">(editando)</span>}
            </span>
            {!readOnly && (
              <div className="flex items-center gap-3 text-xs">
                {editing ? (
                  <>
                    <button className="text-brand-600 hover:underline" onClick={() => setAll(true)}>
                      Marcar todos
                    </button>
                    <button className="text-zinc-400 hover:underline" onClick={() => setAll(false)}>
                      Limpiar
                    </button>
                    <span className="h-3 w-px bg-zinc-300" />
                    <button
                      className="flex items-center gap-1 rounded bg-brand-600 px-2 py-0.5 text-white hover:bg-brand-700"
                      onClick={saveEdit}
                      title="Aplicar los cambios al borrador (luego usar 'Guardar' general para persistir)"
                    >
                      <Save className="h-3 w-3" /> Guardar cambios
                    </button>
                    <button
                      className="flex items-center gap-1 rounded border border-zinc-300 px-2 py-0.5 text-zinc-600 hover:bg-zinc-100"
                      onClick={cancelEdit}
                      title="Descartar cambios"
                    >
                      <X className="h-3 w-3" /> Cancelar
                    </button>
                  </>
                ) : (
                  <button
                    className="flex items-center gap-1 rounded border border-zinc-300 px-2 py-0.5 text-zinc-700 hover:bg-white"
                    onClick={startEdit}
                    title="Habilitar edición de los permisos de este concepto"
                  >
                    <Pencil className="h-3 w-3" /> Editar
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-x-4 gap-y-1.5">
            {catalogo.map((p, i) => {
              const disabled = readOnly || !editing;
              return (
                <button
                  key={p.idpermiso_concepto}
                  onClick={() => togglePermiso(i)}
                  disabled={disabled}
                  title={disabled && !readOnly ? 'Haz clic en "Editar" para modificar' : undefined}
                  className={`flex items-center gap-1.5 rounded px-1.5 py-1 text-left text-xs ${disabled ? 'cursor-not-allowed opacity-70' : 'hover:bg-white'}`}
                >
                  {permisos[i] ? (
                    <CheckSquare className="h-3.5 w-3.5 shrink-0 text-brand-600" />
                  ) : (
                    <Square className="h-3.5 w-3.5 shrink-0 text-zinc-300" />
                  )}
                  <span className={permisos[i] ? 'text-zinc-700' : 'text-zinc-400'}>
                    {i}-{p.descripcion}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ConceptosTab({ grupos, permisosCatalogo, onChange, selectedTipo: extTipo, onTipoChange, scope = 'rol', readOnly = false }: Props) {
  const catalogo =
    permisosCatalogo.length > 0 ? permisosCatalogo : PERMISOS_FALLBACK;

  // Estado interno como fallback cuando no se provee prop externa
  const [internalTipo, setInternalTipo] = useState<number | null>(
    grupos.length > 0 ? grupos[0].tipo : null,
  );

  // Tipo activo: externo si se provee, interno si no
  const selectedTipo = extTipo != null ? extTipo : internalTipo;

  const handleTipoChange = (tipo: number) => {
    setInternalTipo(tipo);
    onTipoChange?.(tipo);
  };

  const updateGrupo = (idx: number, next: GrupoConceptos) => {
    const next_grupos = [...grupos];
    next_grupos[idx] = next;
    onChange(next_grupos);
  };

  if (grupos.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-zinc-400">
        No hay tipos de movimiento con estado activo en la base de datos.
      </p>
    );
  }

  const grupoActivo = grupos.find((g) => g.tipo === selectedTipo) ?? grupos[0];
  const idxActivo   = grupos.findIndex((g) => g.tipo === selectedTipo);

  const totalConceptos  = grupoActivo.conceptos.length;
  const activosConceptos = grupoActivo.conceptos.filter((c) => c.permiso === 1).length;

  const setAllConceptos = (permiso: 0 | 1) =>
    updateGrupo(idxActivo, {
      ...grupoActivo,
      conceptos: grupoActivo.conceptos.map((c) => ({ ...c, permiso })),
    });

  return (
    <div>
      {/* Cabecera con selector de tipo */}
      <div className="mb-2 flex items-center justify-between border-b border-zinc-200 pb-2">
        <div className="flex items-center gap-2">
          <label htmlFor="filtro-tipo" className="text-sm font-semibold text-zinc-700">
            Tipo de movimiento:
          </label>
          <select
            id="filtro-tipo"
            value={selectedTipo ?? ''}
            onChange={(e) => handleTipoChange(Number(e.target.value))}
            className="input py-1 text-sm"
          >
            {grupos.map((g) => {
              const habiles = g.conceptos.filter((c) => c.permiso).length;
              return (
                <option key={g.tipo} value={g.tipo}>
                  {g.label} ({habiles}/{g.conceptos.length})
                </option>
              );
            })}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500">
            {activosConceptos}/{totalConceptos} conceptos activos
          </span>
          {!readOnly && (
            <>
              <button
                className="text-xs text-brand-600 hover:underline"
                onClick={() => setAllConceptos(1)}
              >
                Marcar todos
              </button>
              <button
                className="text-xs text-zinc-400 hover:underline"
                onClick={() => setAllConceptos(0)}
              >
                Desmarcar todos
              </button>
            </>
          )}
        </div>
      </div>

      {/* Panel de permisos globales (aplica a todos los conceptos activos del tipo) */}
      <GlobalPermisosPanel
        grupo={grupoActivo}
        catalogo={catalogo}
        readOnly={readOnly}
        onApply={(conceptos) => updateGrupo(idxActivo, { ...grupoActivo, conceptos })}
      />

      {/* Conceptos del tipo seleccionado */}
      <div className="space-y-1">
        {grupoActivo.conceptos.map((c, idx) => (
          <ConceptoRow
            key={c.idtipomovimiento}
            concepto={c}
            catalogo={catalogo}
            scope={scope}
            readOnly={readOnly}
            onChange={(next) => {
              const conceptos = [...grupoActivo.conceptos];
              conceptos[idx] = next;
              updateGrupo(idxActivo, { ...grupoActivo, conceptos });
            }}
          />
        ))}
        {grupoActivo.conceptos.length === 0 && (
          <p className="py-8 text-center text-sm text-zinc-400 italic">
            No hay conceptos para {grupoActivo.label}.
          </p>
        )}
      </div>
    </div>
  );
}
