import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, Save, Loader2, Menu as MenuIcon, ListChecks,
  ArrowRightLeft, Store, Briefcase, Building2, Boxes, Lock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { Accesos, AccesosApiAdapter, ConceptosAccesos, SucursalUsuarioItem, DepositoUsuarioItem, AccesosMaster } from '../../api/endpoints';
import MenuTab from './tabs/MenuTab';
import FlagsTab from './tabs/FlagsTab';
import PdvTab from './tabs/PdvTab';
import ConceptosTab from './tabs/ConceptosTab';
import SucursalesTab from './tabs/SucursalesTab';
import DepositosTab from './tabs/DepositosTab';
import MasterPanel from './tabs/MasterPanel';

type TabId = 'menu' | 'permisos' | 'movimientos' | 'pdv' | 'gg' | 'sucursales' | 'depositos';

const TABS: { id: TabId; label: string; icon: any }[] = [
  { id: 'menu', label: 'Menú Gestión', icon: MenuIcon },
  { id: 'permisos', label: 'Permisos Generales', icon: ListChecks },
  { id: 'movimientos', label: 'Movimientos', icon: ArrowRightLeft },
  { id: 'pdv', label: 'Punto de Ventas', icon: Store },
  { id: 'gg', label: 'Contab. / RRHH', icon: Briefcase },
  { id: 'sucursales', label: 'Sucursales', icon: Building2 },
  { id: 'depositos', label: 'Depósitos', icon: Boxes },
];

// Solo los 17 tipos que tienen entrada en mnuAdmMovimientos0..16 de menu_general.
// Pagaré a la Orden, Pagaré Deudas y Otros se gestionan directamente en Menú Gestión.
const MOVIMIENTOS = [
  'Inventario', 'Compra', 'Venta', 'Ajuste', 'Nota de Crédito',
  'Nota de Débito', 'Transferencia', 'Pedido de Venta', 'Pedido de Compra',
  'Presupuesto Venta', 'Presupuesto Compra', 'Importación', 'NC Proveedor',
  'ND Proveedor', 'Devolución', 'Remisión Cliente', 'Remisión Proveedor',
];

const GG_GRUPOS = [
  { label: 'Contabilidad', items: ['Diario','Mayor','Libro Fiscal','Activo Fijo','Procesos','Sumas y Saldos','Estado de Resultado','General','Impositivo','Plan de Cuentas','Definición Contable','Propiedades'] },
  { label: 'Talento Humano', items: ['Liquidación de Salarios','Movimientos','Control de Acceso','Planilla Seguro Social','Libro Laboral','Legajo del Personal','Propiedades','Administrador Grupos','Supervisor','Encargado de Área'] },
  { label: 'Permisos', items: ['Agregar','Modificar','Eliminar','Imprimir'] },
];

export type AccesosEditorProps = {
  id: string | number;
  titulo: string;
  subtitulo?: string;
  backTo: string;
  api: AccesosApiAdapter;
  queryKey: unknown[];
  esAdmin?: boolean;
  /** 'usuario' habilita columnas de personalización por concepto. Default: 'rol'. */
  scope?: 'rol' | 'usuario';
  /** Nodo(s) extra que se renderizan junto al botón "Guardar cambios" (ej: botón Propagar). */
  accionesExtra?: React.ReactNode;
  /** Callback invocado justo después de guardar con éxito. */
  onGuardadoExitoso?: () => void;
};

export default function AccesosEditor({ id, titulo, subtitulo, backTo, api, queryKey, esAdmin = false, scope = 'rol', accionesExtra, onGuardadoExitoso }: AccesosEditorProps) {
  const [tab, setTab] = useState<TabId>('menu');
  const [draft, setDraft] = useState<Accesos | null>(null);
  const [dirty, setDirty] = useState<Set<TabId>>(new Set());
  const [saving, setSaving] = useState(false);

  // Estado independiente para conceptos (carga lazy al entrar a la pestaña)
  const [conceptosDraft, setConceptosDraft] = useState<ConceptosAccesos | null>(null);
  const [conceptosDirty, setConceptosDirty] = useState(false);
  // Tipo activo en el selector de conceptos (sincronizado con los flags de movimientos)
  const [conceptoTipoActivo, setConceptoTipoActivo] = useState<number | null>(null);

  // Estado independiente para sucursales y depósitos (carga lazy)
  const [sucursalesDraft, setSucursalesDraft] = useState<SucursalUsuarioItem[] | null>(null);
  const [sucursalesDirty, setSucursalesDirty] = useState(false);
  const [depositosDraft, setDepositosDraft] = useState<DepositoUsuarioItem[] | null>(null);
  const [depositosDirty, setDepositosDirty] = useState(false);

  // Estado independiente para Master (carga lazy al entrar al tab gg)
  const [masterDraft, setMasterDraft] = useState<AccesosMaster | null>(null);
  const [masterDirty, setMasterDirty] = useState(false);

  // Snapshots de los datos originales para detección de cambios reales
  const snapMain       = useRef<string | null>(null);
  const snapConceptos  = useRef<string | null>(null);
  const snapSucursales = useRef<string | null>(null);
  const snapDepositos  = useRef<string | null>(null);
  const snapMaster     = useRef<string | null>(null);

  const q = useQuery({
    queryKey,
    queryFn: () => api.obtener(id),
    enabled: id !== '' && id != null,
  });

  // Carga de conceptos: lazy cuando el usuario hace clic en la pestaña Movimientos
  const conceptosEnabled =
    tab === 'movimientos' &&
    id !== '' &&
    id != null &&
    typeof api.obtenerConceptos === 'function';

  const conceptosQ = useQuery({
    queryKey: [...queryKey, 'conceptos'],
    queryFn: () => api.obtenerConceptos!(id),
    enabled: conceptosEnabled,
    staleTime: 60_000,
  });

  // Carga lazy de sucursales: al entrar a Sucursales o Depósitos (este último las necesita).
  const sucursalesEnabled =
    (tab === 'sucursales' || tab === 'depositos') &&
    id !== '' && id != null &&
    typeof api.obtenerSucursales === 'function';

  const sucursalesQ = useQuery({
    queryKey: [...queryKey, 'sucursales'],
    queryFn: () => api.obtenerSucursales!(id),
    enabled: sucursalesEnabled,
    staleTime: 60_000,
  });

  const depositosEnabled =
    tab === 'depositos' && id !== '' && id != null &&
    typeof api.obtenerDepositos === 'function';

  const depositosQ = useQuery({
    queryKey: [...queryKey, 'depositos'],
    queryFn: () => api.obtenerDepositos!(id),
    enabled: depositosEnabled,
    staleTime: 60_000,
  });

  const masterEnabled =
    tab === 'gg' && id !== '' && id != null && typeof api.obtenerMaster === 'function';

  const masterQ = useQuery({
    queryKey: [...queryKey, 'master'],
    queryFn: () => api.obtenerMaster!(id),
    enabled: masterEnabled,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (conceptosQ.data && !conceptosDirty) {
      snapConceptos.current = JSON.stringify(conceptosQ.data);
      setConceptosDraft(structuredClone(conceptosQ.data));
    }
  }, [conceptosQ.data]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (sucursalesQ.data && !sucursalesDirty) {
      snapSucursales.current = JSON.stringify(sucursalesQ.data.items);
      setSucursalesDraft(structuredClone(sucursalesQ.data.items));
    }
  }, [sucursalesQ.data]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (depositosQ.data && !depositosDirty) {
      snapDepositos.current = JSON.stringify(depositosQ.data.items);
      setDepositosDraft(structuredClone(depositosQ.data.items));
    }
  }, [depositosQ.data]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (masterQ.data && !masterDirty) {
      snapMaster.current = JSON.stringify(masterQ.data);
      setMasterDraft(structuredClone(masterQ.data));
    }
  }, [masterQ.data]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (q.data) {
      snapMain.current = JSON.stringify(q.data);
      setDraft(structuredClone(q.data));
    }
  }, [q.data]);

  const setDraftAndMark = (next: Accesos, t: TabId) => {
    setDraft(next);
    // Solo marcar dirty si realmente difiere del snapshot original
    if (snapMain.current !== null && JSON.stringify(next) !== snapMain.current) {
      setDirty((s) => new Set(s).add(t));
    } else {
      setDirty((s) => { const n = new Set(s); n.delete(t); return n; });
    }
  };

  const guardar = async () => {
    if (!draft) return;
    setSaving(true);
    // Calcular qué secciones lazy realmente cambiaron
    const conceptosCambiados = conceptosDraft !== null && snapConceptos.current !== null && JSON.stringify(conceptosDraft) !== snapConceptos.current;
    const sucursalesCambiadas = sucursalesDraft !== null && snapSucursales.current !== null && JSON.stringify(sucursalesDraft) !== snapSucursales.current;
    const depositosCambiados  = depositosDraft !== null && snapDepositos.current !== null && JSON.stringify(depositosDraft) !== snapDepositos.current;
    const masterCambiado      = masterDraft !== null && snapMaster.current !== null && JSON.stringify(masterDraft) !== snapMaster.current;
    try {
      const tasks: Promise<unknown>[] = [];
      if (dirty.has('menu')) {
        tasks.push(
          api.guardarMenu(
            id,
            draft.menu.map((m) => ({ idmenu_principal: m.idmenu_principal, permiso: m.permiso })),
          ),
        );
      }
      if (dirty.has('permisos')) tasks.push(api.guardarPermisosGenerales(id, draft.permisosGenerales.flags));
      if (dirty.has('movimientos')) tasks.push(api.guardarMovimientos(id, draft.movimientos.flags));
      if (dirty.has('pdv')) tasks.push(api.guardarPdv(id, draft.pdv.flags));
      if (dirty.has('gg')) tasks.push(api.guardarPermisoGg(id, draft.permisoGg.flags));

      // Guardar conceptos si fueron modificados
      if (conceptosCambiados && conceptosDraft && api.guardarConceptos) {
        const items = conceptosDraft.grupos.flatMap((g) =>
          g.conceptos.map((c) => {
            const base: any = {
              idtipomovimiento: c.idtipomovimiento,
              permiso: c.permiso,
              permisoVarios: c.permisoVarios,
            };
            // Solo en modo usuario propagamos los 5 campos de personalización.
            if (scope === 'usuario') {
              base.idtalonario = c.idtalonario ?? null;
              base.idvendedor  = c.idvendedor  ?? null;
              base.idpersona   = c.idpersona   ?? null;
              base.idplanventa = c.idplanventa ?? null;
              base.idcondicion = c.idcondicion ?? null;
            }
            return base;
          }),
        );
        tasks.push(api.guardarConceptos(id, items));
      }

      // Sucursales
      if (sucursalesCambiadas && sucursalesDraft && api.guardarSucursales) {
        tasks.push(api.guardarSucursales(id, sucursalesDraft));
      }
      // Depósitos
      if (depositosCambiados && depositosDraft && api.guardarDepositos) {
        tasks.push(api.guardarDepositos(id, depositosDraft));
      }
      // Master
      if (masterCambiado && masterDraft && api.guardarMaster) {
        tasks.push(api.guardarMaster(id, { permisos: masterDraft.permisos, menu: masterDraft.menu }));
      }

      await Promise.all(tasks);
      toast.success('Accesos actualizados');
      setDirty(new Set());
      // Actualizar snapshots y refetch
      q.refetch();
      if (conceptosCambiados) conceptosQ.refetch();
      if (sucursalesCambiadas) sucursalesQ.refetch();
      if (depositosCambiados) { depositosQ.refetch(); sucursalesQ.refetch(); }
      if (masterCambiado) masterQ.refetch();
      onGuardadoExitoso?.();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Error guardando');
    } finally {
      setSaving(false);
    }
  };

  const hayCambios = dirty.size > 0 ||
    (conceptosDraft !== null && snapConceptos.current !== null && JSON.stringify(conceptosDraft) !== snapConceptos.current) ||
    (sucursalesDraft !== null && snapSucursales.current !== null && JSON.stringify(sucursalesDraft) !== snapSucursales.current) ||
    (depositosDraft !== null && snapDepositos.current !== null && JSON.stringify(depositosDraft) !== snapDepositos.current) ||
    (masterDraft !== null && snapMaster.current !== null && JSON.stringify(masterDraft) !== snapMaster.current);

  // Solo lectura de tabs de permisos cuando el rol tiene edicion_rol=true
  const TABS_RESTRINGIDAS: TabId[] = ['menu', 'permisos', 'movimientos', 'pdv', 'gg'];
  const soloRol = scope === 'usuario' && (draft?.edicion_rol ?? false);
  const tabEsReadOnly = (t: TabId) => soloRol && TABS_RESTRINGIDAS.includes(t);

  // Pestaña Movimientos sólo visible si el ítem mnuAdminMovimientos está habilitado en el menú
  const movimientosHabilitado =
    draft?.menu.some((m) => m.idmenu === 'mnuAdminMovimientos' && m.permiso === 1) ?? false;

  // Si el tab activo es 'movimientos' y se deshabilitó, volver a 'menu'
  useEffect(() => {
    if (tab === 'movimientos' && !movimientosHabilitado) setTab('menu');
  }, [movimientosHabilitado, tab]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to={backTo} className="btn-ghost">
            <ArrowLeft className="h-4 w-4" /> Volver
          </Link>
          <div>
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">{titulo}</h2>
            {subtitulo && <p className="text-sm text-zinc-500 dark:text-zinc-400">{subtitulo}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {accionesExtra}
          <button className="btn-primary" onClick={guardar} disabled={!hayCambios || saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar cambios
            {hayCambios && (
              <span className="ml-1 rounded-full bg-white/20 px-1.5 text-xs">{dirty.size}</span>
            )}
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        {soloRol && (
          <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-300">
            <Lock className="h-3.5 w-3.5 shrink-0" />
            <span>Los permisos de este usuario se gestionan únicamente a través del <strong>rol asignado</strong>. Sucursales y depósitos pueden editarse directamente.</span>
          </div>
        )}
        <div className="flex flex-wrap gap-1 border-b border-zinc-200 bg-zinc-50 px-2 py-2 dark:border-zinc-700 dark:bg-zinc-900">
          {TABS.filter((t) => {
            if (t.id === 'movimientos' && !movimientosHabilitado) return false;
            if (t.id === 'sucursales' && !api.obtenerSucursales) return false;
            if (t.id === 'depositos' && !api.obtenerDepositos) return false;
            return true;
          }).map(({ id: tid, label, icon: Icon }) => {
            const isActive = tab === tid;
            const isDirty = dirty.has(tid) ||
              (tid === 'movimientos' && conceptosDirty) ||
              (tid === 'sucursales' && sucursalesDirty) ||
              (tid === 'depositos' && depositosDirty) ||
              (tid === 'gg' && masterDirty);
            return (
              <button
                key={tid}
                onClick={() => setTab(tid)}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'bg-white text-brand-700 shadow-sm dark:bg-zinc-800 dark:text-brand-400'
                    : 'text-zinc-600 hover:bg-white/60 dark:text-zinc-400 dark:hover:bg-zinc-800/60'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
                {tabEsReadOnly(tid) && <Lock className="h-3 w-3 text-amber-500" />}
                {isDirty && <span className="h-2 w-2 rounded-full bg-brand-500" />}
              </button>
            );
          })}
        </div>

        <div className="p-4">
          {q.isLoading || !draft ? (
            <div className="flex items-center justify-center py-20 text-zinc-400">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando…
            </div>
          ) : (
            <>
              {tab === 'menu' && (
                <MenuTab
                  items={draft.menu}
                  esAdmin={esAdmin}
                  readOnly={tabEsReadOnly('menu')}
                  onChange={(items) => setDraftAndMark({ ...draft, menu: items }, 'menu')}
                />
              )}
              {tab === 'permisos' && (
                <FlagsTab
                  titulo="Permisos Generales"
                  catalogo={draft.permisosGenerales.catalogo.map((c) => c.descripcion)}
                  flags={draft.permisosGenerales.flags}
                  readOnly={tabEsReadOnly('permisos')}
                  onChange={(flags) =>
                    setDraftAndMark(
                      { ...draft, permisosGenerales: { ...draft.permisosGenerales, flags } },
                      'permisos',
                    )
                  }
                  columnas={4}
                />
              )}
              {tab === 'movimientos' && (
                <>
                  <FlagsTab
                    titulo="Movimientos habilitados"
                    catalogo={MOVIMIENTOS}
                    flags={draft.movimientos.flags.slice(0, MOVIMIENTOS.length)}
                    readOnly={tabEsReadOnly('movimientos')}
                    onChange={(flags) => {
                      const full = [...draft.movimientos.flags];
                      flags.forEach((v, i) => (full[i] = v));
                      // Sincronizar mnuAdmMovimientos{N} en el menú
                      const newMenu = draft.menu.map((m) => {
                        const match = m.idmenu.match(/^mnuAdmMovimientos(\d+)$/i);
                        if (match) {
                          const idx = parseInt(match[1], 10);
                          if (idx < flags.length) return { ...m, permiso: flags[idx] ? 1 : 0 };
                        }
                        return m;
                      });
                      setDraft({ ...draft, movimientos: { flags: full }, menu: newMenu });
                      setDirty((s) => { const n = new Set(s); n.add('movimientos'); n.add('menu'); return n; });
                    }}
                    onSelect={setConceptoTipoActivo}
                    columnas={3}
                  />

                  {/* ── Conceptos por tipo de movimiento ── */}
                  {api.obtenerConceptos && (
                    <div className="mt-6 border-t border-zinc-200 pt-5">
                      {conceptosQ.isLoading ? (
                        <div className="flex items-center gap-2 py-8 justify-center text-zinc-400">
                          <Loader2 className="h-4 w-4 animate-spin" /> Cargando conceptos…
                        </div>
                      ) : conceptosQ.isError ? (
                        <p className="py-6 text-center text-sm text-red-500">
                          Error al cargar conceptos:{' '}
                          {(conceptosQ.error as any)?.response?.data?.error ?? 'Error del servidor'}
                        </p>
                      ) : (
                        <ConceptosTab
                          grupos={conceptosDraft?.grupos ?? []}
                          permisosCatalogo={conceptosDraft?.permisosCatalogo ?? []}
                          selectedTipo={conceptoTipoActivo}
                          onTipoChange={setConceptoTipoActivo}
                          scope={scope}
                          readOnly={tabEsReadOnly('movimientos')}
                          onChange={(grupos) => {
                            setConceptosDraft(
                              conceptosDraft
                                ? { ...conceptosDraft, grupos }
                                : { permisosCatalogo: [], grupos },
                            );
                            setConceptosDirty(true);
                          }}
                        />
                      )}
                    </div>
                  )}
                </>
              )}
              {tab === 'pdv' && (
                <PdvTab
                  catalogo={draft.pdv.catalogo}
                  flags={draft.pdv.flags}
                  readOnly={tabEsReadOnly('pdv')}
                  onChange={(flags) => setDraftAndMark({ ...draft, pdv: { ...draft.pdv, flags } }, 'pdv')}
                />
              )}
              {tab === 'gg' && (() => {
                const masterDisponible = !!api.obtenerMaster && masterQ.data?.habilitado === true;
                return (
                  <>
                    {/* GgTab clásico sólo si Master no está activo (evita redundancia) */}
                    {!masterDisponible && (
                      <GgTab
                        flags={draft.permisoGg.flags}
                        onChange={(flags) => setDraftAndMark({ ...draft, permisoGg: { flags } }, 'gg')}
                      />
                    )}
                    {api.obtenerMaster && (
                      masterQ.isLoading ? (
                        <div className="flex items-center gap-2 py-6 justify-center text-zinc-400">
                          <Loader2 className="h-4 w-4 animate-spin" /> Cargando Master…
                        </div>
                      ) : masterQ.isError ? (
                        <p className="py-4 text-center text-xs text-red-500">
                          Error al cargar Master:{' '}
                          {(masterQ.error as any)?.response?.data?.error ?? 'Error del servidor'}
                        </p>
                      ) : (
                        <MasterPanel
                          draft={masterDraft}
                          esAdmin={(draft.iduser || '').trim().toUpperCase() === 'ADMIN'}
                          readOnly={tabEsReadOnly('gg')}
                          onChange={(next) => { setMasterDraft(next); setMasterDirty(true); }}
                        />
                      )
                    )}
                  </>
                );
              })()}
              {tab === 'sucursales' && (
                sucursalesQ.isLoading ? (
                  <div className="flex items-center justify-center gap-2 py-12 text-zinc-400">
                    <Loader2 className="h-4 w-4 animate-spin" /> Cargando sucursales…
                  </div>
                ) : sucursalesQ.isError ? (
                  <p className="py-6 text-center text-sm text-red-500">
                    Error al cargar sucursales:{' '}
                    {(sucursalesQ.error as any)?.response?.data?.error ?? 'Error del servidor'}
                  </p>
                ) : (
                  <SucursalesTab
                    items={sucursalesDraft ?? []}
                    onChange={(items) => { setSucursalesDraft(items); setSucursalesDirty(true); }}
                  />
                )
              )}
              {tab === 'depositos' && (
                (sucursalesQ.isLoading || depositosQ.isLoading) ? (
                  <div className="flex items-center justify-center gap-2 py-12 text-zinc-400">
                    <Loader2 className="h-4 w-4 animate-spin" /> Cargando depósitos…
                  </div>
                ) : depositosQ.isError ? (
                  <p className="py-6 text-center text-sm text-red-500">
                    Error al cargar depósitos:{' '}
                    {(depositosQ.error as any)?.response?.data?.error ?? 'Error del servidor'}
                  </p>
                ) : (
                  <DepositosTab
                    items={depositosDraft ?? []}
                    sucursales={sucursalesDraft ?? []}
                    onChange={(items) => { setDepositosDraft(items); setDepositosDirty(true); }}
                  />
                )
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function GgTab({ flags, onChange }: { flags: boolean[]; onChange: (f: boolean[]) => void }) {
  let offset = 0;
  return (
    <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
      {GG_GRUPOS.map((grupo) => {
        const start = offset;
        offset += grupo.items.length;
        return (
          <div key={grupo.label} className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-700">
            <h3 className="mb-1 text-xs font-semibold text-zinc-700 dark:text-zinc-300">{grupo.label}</h3>
            <ul className="space-y-0">
              {grupo.items.map((label, i) => {
                const idx = start + i;
                return (
                  <li key={label}>
                    <label className="flex cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-700">
                      <input
                        type="checkbox"
                        checked={!!flags[idx]}
                        onChange={(e) => {
                          const next = [...flags];
                          next[idx] = e.target.checked;
                          onChange(next);
                        }}
                        className="h-3.5 w-3.5 rounded border-zinc-300 text-brand-600 focus:ring-brand-500"
                      />
                      {label}
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
