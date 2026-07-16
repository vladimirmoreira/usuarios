import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings, Plus, Pencil, Trash2, X, List, HelpCircle, Database, CheckCircle2, AlertCircle, Building2, Loader2 } from 'lucide-react';
import toast from '../../lib/notify';
import { ConfiguracionAPI, type Configuracion, type Operacion, type MetadataResultado } from '../../api/endpoints';
import { useConfirm } from '../../hooks/useConfirm';

type CfgForm = Omit<Configuracion, 'legajo'|'biometrico'|'gastronomia'|'complementario'|'contabilidad'|'talento_humano'|'crear_sin_rol'|'clonar'|'replicar'> & {
  clave:          string;
  legajo:         boolean;
  biometrico:     boolean;
  gastronomia:    boolean;
  complementario: boolean;
  contabilidad:   boolean;
  talento_humano: boolean;
  crear_sin_rol:  boolean;
  clonar:         boolean;
  replicar:       boolean;
};

const emptyForm: CfgForm = {
  ip: '', server: '', sys_cfg: '', master: '', user_bd: '', clave: '',
  legajo: false, biometrico: false, gastronomia: false, complementario: false,
  contabilidad: false, talento_humano: false, crear_sin_rol: true,
  clonar: false, replicar: false, temporizador_replicacion: 15, retencion_replicacion_horas: 48,
  hora_inicio: null, hora_fin: null,
  maximo: null, ruta_archivo: null, version_nro: null, autorizado: null,
};

const toForm = (r: Configuracion & { clave?: string }): CfgForm => ({
  ...r,
  clave:          '',
  legajo:         r.legajo === 1,
  biometrico:     r.biometrico === 1,
  gastronomia:    r.gastronomia === 1,
  complementario: r.complementario === 1,
  contabilidad:   r.contabilidad === 1,
  talento_humano: r.talento_humano === 1,
  crear_sin_rol:  (r.crear_sin_rol ?? 1) === 1,
  clonar:         (r.clonar ?? 0) === 1,
  replicar:       (r.replicar ?? 0) === 1,
  temporizador_replicacion: r.temporizador_replicacion ?? 15,
  retencion_replicacion_horas: r.retencion_replicacion_horas ?? 48,
  hora_inicio: r.hora_inicio ?? null,
  hora_fin: r.hora_fin ?? null,
});

const fromForm = (f: CfgForm) => {
  const { clave, ...rest } = f;
  return {
    ...rest,
    legajo:         f.legajo ? 1 : 0,
    biometrico:     f.biometrico ? 1 : 0,
    gastronomia:    f.gastronomia ? 1 : 0,
    complementario: f.complementario ? 1 : 0,
    contabilidad:   f.contabilidad ? 1 : 0,
    talento_humano: f.talento_humano ? 1 : 0,
    crear_sin_rol:  f.crear_sin_rol ? 1 : 0,
    clonar:         f.clonar ? 1 : 0,
    replicar:       f.replicar ? 1 : 0,
    temporizador_replicacion:
      f.temporizador_replicacion == null || f.temporizador_replicacion === ('' as any)
        ? 15 : Number(f.temporizador_replicacion),
    retencion_replicacion_horas:
      f.retencion_replicacion_horas == null || f.retencion_replicacion_horas === ('' as any)
        ? 48 : Number(f.retencion_replicacion_horas),
    maximo:         f.maximo === null || f.maximo === ('' as any) ? null : Number(f.maximo),
    hora_inicio:    f.hora_inicio && String(f.hora_inicio).trim() ? String(f.hora_inicio).trim() : null,
    hora_fin:       f.hora_fin && String(f.hora_fin).trim() ? String(f.hora_fin).trim() : null,
    // Omitir clave si está vacía (no cambiar la existente)
    ...(clave?.trim() ? { clave: clave.trim() } : {}),
  };
};

const Flag = ({ v }: { v: boolean }) =>
  v ? <span className="text-emerald-600 font-bold">✓</span>
    : <span className="text-zinc-300">—</span>;

export default function ConfiguracionPage() {
  const qc = useQueryClient();
  const listQ = useQuery<Configuracion[]>({
    queryKey: ['configuracion'],
    queryFn: ConfiguracionAPI.listar,
  });
  const opsQ = useQuery<Operacion[]>({
    queryKey: ['configuracion-operaciones'],
    queryFn: ConfiguracionAPI.listarOperaciones,
  });

  const [tab, setTab]         = useState<'config' | 'catalogo' | 'metadata' | 'empresas'>('config');
  const metaQ = useQuery<{ ejecutado: boolean }>({queryKey: ['configuracion', 'metadata'], queryFn: ConfiguracionAPI.metadataEstado});
  const metaM = useMutation<MetadataResultado>({mutationFn: ConfiguracionAPI.metadataEjecutar,
    onSuccess: (data) => {
      toast.success('Metadatos inicializados correctamente');
      qc.invalidateQueries({ queryKey: ['configuracion', 'metadata'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Error al ejecutar'),
  });

  // ── Empresas (system + master) ──────────────────────────────────────────
  const empresasQ = useQuery({ queryKey: ['configuracion', 'empresas'], queryFn: ConfiguracionAPI.empresas, enabled: tab === 'empresas' });
  const invalidarEmpresas = () => {
    qc.invalidateQueries({ queryKey: ['configuracion', 'empresas'] });
    qc.invalidateQueries({ queryKey: ['empresas'] });
  };
  const accesibleM = useMutation({
    mutationFn: (v: { idempresa: string; accesible: number }) => ConfiguracionAPI.setEmpresaAccesible(v.idempresa, v.accesible),
    onSuccess: invalidarEmpresas,
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Error al actualizar'),
  });
  const mappingM = useMutation({
    mutationFn: (v: { idempresa: string; idempresa_system: string | null }) => ConfiguracionAPI.setEmpresaMasterMapping(v.idempresa, v.idempresa_system),
    onSuccess: () => { toast.success('Mapeo actualizado'); invalidarEmpresas(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Error al actualizar'),
  });

  const [modal, setModal]     = useState<null | 'crear' | 'editar'>(null);
  const [qOcurre, setQOcurre] = useState<Configuracion | null>(null);

  const activeFlags = (cfg: Configuracion): Set<string> => {
    const f = new Set(['siempre']);
    if (cfg.legajo === 1)                             f.add('legajo');
    if (cfg.biometrico === 1)                         f.add('biometrico');
    if (cfg.gastronomia === 1)                        f.add('gastronomia');
    if (cfg.master != null && cfg.master.trim() !== '') f.add('master');
    return f;
  };

  const bdColor: Record<string, string> = {
    system:   'bg-blue-50 text-blue-700',
    server:   'bg-emerald-50 text-emerald-700',
    master:   'bg-violet-50 text-violet-700',
    externa:  'bg-zinc-100 text-zinc-600',
    pendiente:'bg-amber-50 text-amber-700',
  };
  const flagLabel: Record<string, string> = {
    siempre: '', legajo: 'Legajo', biometrico: 'Bio.', gastronomia: 'Gast.', master: 'Master',
  };
  const [editIp, setEditIp]   = useState<string | null>(null);
  const [form, setForm]       = useState<CfgForm>(emptyForm);

  const abrirCrear = () => { setForm(emptyForm); setEditIp(null); setModal('crear'); };
  const abrirEditar = (r: Configuracion) => { setForm(toForm(r)); setEditIp(r.ip); setModal('editar'); };
  const cerrar = () => { setModal(null); setEditIp(null); };

  const set = (k: keyof CfgForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const crearM = useMutation({
    mutationFn: () => ConfiguracionAPI.crear(fromForm(form)),
    onSuccess: () => { toast.success('Configuración creada'); qc.invalidateQueries({ queryKey: ['configuracion'] }); cerrar(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Error al crear'),
  });

  const editarM = useMutation({
    mutationFn: () => ConfiguracionAPI.actualizar(editIp!, fromForm(form)),
    onSuccess: () => { toast.success('Configuración actualizada'); qc.invalidateQueries({ queryKey: ['configuracion'] }); cerrar(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Error al actualizar'),
  });

  const eliminarM = useMutation({
    mutationFn: (ip: string) => ConfiguracionAPI.eliminar(ip),
    onSuccess: () => { toast.success('Configuración eliminada'); qc.invalidateQueries({ queryKey: ['configuracion'] }); },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Error al eliminar'),
  });

  const onGuardar = () => {
    if (!form.ip.trim()) { toast.error('La IP es requerida'); return; }
    modal === 'crear' ? crearM.mutate() : editarM.mutate();
  };

  const { confirm: confirmDialog, ConfirmDialog } = useConfirm();

  const onEliminar = async (r: Configuracion) => {
    if (!await confirmDialog({ title: 'Eliminar configuración', message: `¿Eliminar la configuración de ${r.ip}?`, confirmLabel: 'Eliminar', variant: 'danger' })) return;
    eliminarM.mutate(r.ip);
  };

  const busy = crearM.isPending || editarM.isPending;

  return (
    <div className="space-y-4">
      <ConfirmDialog />
      {/* Cabecera */}
      <div className="card flex flex-wrap items-center gap-3 p-4">
        <div className="flex-1">
          <h2 className="text-base font-semibold text-zinc-800">Configuración</h2>
          <p className="text-sm text-zinc-500">Parámetros de conexión · <code>configuracion_usuario</code></p>
        </div>
        {/* Tabs */}
        <div className="flex gap-1 rounded-lg bg-zinc-100 p-1">
          <button
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === 'config' ? 'bg-white shadow text-zinc-800' : 'text-zinc-500 hover:text-zinc-700'
            }`}
            onClick={() => setTab('config')}
          >
            <Settings className="h-3.5 w-3.5" /> Configuración
          </button>
          <button
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === 'catalogo' ? 'bg-white shadow text-zinc-800' : 'text-zinc-500 hover:text-zinc-700'
            }`}
            onClick={() => setTab('catalogo')}
          >
            <List className="h-3.5 w-3.5" /> Catálogo de Operaciones
          </button>
          <button
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === 'metadata' ? 'bg-white shadow text-zinc-800' : 'text-zinc-500 hover:text-zinc-700'
            }`}
            onClick={() => setTab('metadata')}
          >
            <Database className="h-3.5 w-3.5" /> Metadatos
          </button>
          <button
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === 'empresas' ? 'bg-white shadow text-zinc-800' : 'text-zinc-500 hover:text-zinc-700'
            }`}
            onClick={() => setTab('empresas')}
          >
            <Building2 className="h-3.5 w-3.5" /> Empresas
          </button>
        </div>
        {tab === 'config' && (listQ.data?.length ?? 0) === 0 && (
          <button className="btn-primary" onClick={abrirCrear}>
            <Plus className="h-4 w-4" /> Nueva configuración
          </button>
        )}
      </div>

      {/* Grid configuración */}
      {tab === 'config' && (
        <div className="card overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-800/70 dark:text-zinc-300">
            <tr>
              <th className="px-3 py-1.5">IP</th>
              <th className="px-3 py-1.5">Servidor</th>
              <th className="px-3 py-1.5">Sistema (BD)</th>
              <th className="px-3 py-1.5">Usuario BD</th>
              <th className="px-3 py-1.5 w-16 text-center">Leg.</th>
              <th className="px-3 py-1.5 w-16 text-center">Bio.</th>
              <th className="px-3 py-1.5 w-16 text-center">Gast.</th>
              <th className="px-3 py-1.5 w-16 text-center">Comp.</th>
              <th className="px-3 py-1.5">Autorizado</th>
              <th className="px-3 py-1.5">Versión</th>
              <th className="px-3 py-1.5 w-24 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {(listQ.data || []).map((r) => (
              <tr key={r.ip} className="border-t border-zinc-100 hover:bg-zinc-50 dark:border-zinc-700/60 dark:hover:bg-zinc-800/50">
                <td className="px-3 py-1.5 font-mono font-medium">{r.ip}</td>
                <td className="px-3 py-1.5 text-zinc-600 truncate max-w-[14rem]">{r.server || '—'}</td>
                <td className="px-3 py-1.5 text-zinc-600">{r.sys_cfg || '—'}</td>
                <td className="px-3 py-1.5 font-mono text-xs text-zinc-500">{r.user_bd || '—'}</td>
                <td className="px-3 py-1.5 text-center"><Flag v={r.legajo === 1} /></td>
                <td className="px-3 py-1.5 text-center"><Flag v={r.biometrico === 1} /></td>
                <td className="px-3 py-1.5 text-center"><Flag v={r.gastronomia === 1} /></td>
                <td className="px-3 py-1.5 text-center"><Flag v={r.complementario === 1} /></td>
                <td className="px-3 py-1.5 font-mono text-xs">{r.autorizado || '—'}</td>
                <td className="px-3 py-1.5 text-xs text-zinc-500">{r.version_nro || '—'}</td>
                <td className="px-3 py-1.5">
                  <div className="flex justify-end gap-1">
                    <button className="btn-ghost" title="¿Qué ocurre?" onClick={() => setQOcurre(r)}>
                      <HelpCircle className="h-4 w-4 text-sky-500" />
                    </button>
                    <button className="btn-ghost" title="Editar" onClick={() => abrirEditar(r)}>
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button className="btn-ghost" title="Eliminar" onClick={() => onEliminar(r)}>
                      <Trash2 className="h-4 w-4 text-rose-500" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!listQ.isLoading && (listQ.data?.length ?? 0) === 0 && (
              <tr><td colSpan={11} className="px-4 py-10 text-center text-zinc-400">Sin configuraciones</td></tr>
            )}
          </tbody>
        </table>
      </div>
      )}

      {/* Catálogo de operaciones */}
      {tab === 'catalogo' && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {(opsQ.data || []).map((op) => {
            return (
              <div key={op.id} className="card p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-sm text-zinc-800">{op.descripcion}</span>
                  <span className="text-xs font-mono text-zinc-400 shrink-0">#{op.id}</span>
                </div>
                <ul className="space-y-1">
                  {op.efectos.map((e, i) => (
                    <li key={i} className="flex items-baseline gap-1.5 text-xs">
                      <span className="text-zinc-400 select-none">&gt;</span>
                      <span className={`rounded px-1 py-0.5 font-mono text-[10px] font-semibold shrink-0 ${
                        bdColor[e.bd] ?? 'bg-zinc-100 text-zinc-600'
                      }`}>{e.bd}</span>
                      <span className="text-zinc-700 leading-tight">{e.accion}</span>
                      {flagLabel[e.flag] && (
                        <span className="ml-auto shrink-0 rounded bg-amber-50 px-1 text-[10px] text-amber-600 font-medium">
                          {flagLabel[e.flag]}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          {opsQ.isLoading && (
            <p className="col-span-full text-center text-sm text-zinc-400 py-10">Cargando catálogo…</p>
          )}
        </div>
      )}

      {/* Panel Metadatos */}
      {tab === 'metadata' && (
        <div className="card p-6 max-w-2xl space-y-5">
          <div className="flex items-start gap-3">
            <Database className="h-6 w-6 text-zinc-400 mt-0.5 shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-zinc-800">Inicialización de Metadatos</h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Puebla los catálogos de referencia en las bases de datos <code className="font-mono">system</code> y{' '}
                <code className="font-mono">server</code>: permisos generales, permisos PDV, tipos de usuario y tipos de operación.
                Solo se puede ejecutar una vez (controlado por el campo <code className="font-mono">METADATA_EJECUTADO</code> en{' '}
                <code className="font-mono">CONFIGURACION_USUARIO</code>).
              </p>
            </div>
          </div>

          {/* Estado */}
          {metaQ.isLoading ? (
            <p className="text-sm text-zinc-400">Verificando estado…</p>
          ) : metaQ.isError ? (
            <div className="flex items-center gap-2 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              No se pudo obtener el estado de metadatos.
            </div>
          ) : metaQ.data?.ejecutado ? (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Los metadatos ya fueron inicializados. <span className="ml-1 font-mono text-xs">METADATA_EJECUTADO = 1</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Pendiente de inicialización. <span className="ml-1 font-mono text-xs">METADATA_EJECUTADO = 0</span>
            </div>
          )}

          {/* Detalle del último resultado */}
          {metaM.isSuccess && metaM.data?.detalle && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Resultado de la ejecución</p>
              <ul className="grid grid-cols-2 gap-1 text-xs text-emerald-800">
                <li>Permisos Generales: <strong>{metaM.data.detalle.permisos_generales}</strong></li>
                <li>Permisos PDV: <strong>{metaM.data.detalle.permisos_pdv}</strong></li>
                <li>Tipos de Usuario: <strong>{metaM.data.detalle.tipo_usuario}</strong></li>
                <li>Tipos de Operación: <strong>{metaM.data.detalle.tipo_operacion}</strong></li>
                <li>Usuarios sin rol → «Sin Asignación»: <strong>{metaM.data.detalle.usuarios_sin_rol ?? 0}</strong></li>
              </ul>
            </div>
          )}

          {/* Tablas que afecta */}
          <div className="rounded-lg border border-zinc-200 p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Tablas afectadas</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { bd: 'system', tabla: 'TMP$USUARIO_PERMISOS_GENERALES', detalle: '39 permisos' },
                { bd: 'system', tabla: 'TMP$USUARIO_PERMISOS_PDV', detalle: '18 permisos' },
                { bd: 'system', tabla: 'TIPO_USUARIO', detalle: '11 roles base' },
                { bd: 'server', tabla: 'TIPO_OPERACION', detalle: '11 operaciones' },
              ].map(({ bd, tabla, detalle }) => (
                <div key={tabla} className="flex items-baseline gap-1.5 text-xs">
                  <span className={`rounded px-1 py-0.5 font-mono text-[10px] font-semibold shrink-0 ${
                    bd === 'system' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'
                  }`}>{bd}</span>
                  <span className="font-mono text-zinc-700">{tabla}</span>
                  <span className="text-zinc-400">({detalle})</span>
                </div>
              ))}
            </div>
          </div>

          {/* Botón de acción */}
          {!metaQ.data?.ejecutado && (
            <div className="flex items-center gap-3 pt-1">
              <button
                className="btn-primary"
                disabled={metaM.isPending || metaQ.isLoading}
                onClick={async () => {
                  if (!await confirmDialog({ title: 'Inicialización de Metadatos', message: '¿Confirma la inicialización de metadatos? Esta operación no se puede repetir.', confirmLabel: 'Ejecutar', variant: 'warning' })) return;
                  metaM.mutate();
                }}
              >
                {metaM.isPending ? 'Ejecutando…' : 'Ejecutar inicialización'}
              </button>
              {metaM.isError && (
                <span className="text-xs text-rose-600">
                  {(metaM.error as any)?.response?.data?.error || 'Error al ejecutar'}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'empresas' && (
        <div className="card p-0 overflow-hidden">
          {empresasQ.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-zinc-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
            </div>
          ) : (
            <div className="grid gap-6 p-4 lg:grid-cols-2">
              {/* SYSTEM */}
              <div>
                <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-zinc-700">
                  <Building2 className="h-4 w-4 text-blue-600" /> Empresas (system)
                </h3>
                <p className="mb-2 text-xs text-zinc-400">Accesible = elegible en el combo de login multi-empresa.</p>
                <div className="max-h-[60vh] divide-y divide-zinc-100 overflow-y-auto rounded-lg border border-zinc-200">
                  {(empresasQ.data?.system ?? []).map((e) => (
                    <div key={e.idempresa} className="flex items-center justify-between px-3 py-1.5 text-xs">
                      <span className="min-w-0 truncate"><span className="font-mono text-zinc-400">#{e.idempresa}</span> {e.nombre}</span>
                      <label className="flex shrink-0 cursor-pointer items-center gap-1.5">
                        <input type="checkbox" className="h-4 w-4 rounded accent-brand-600" checked={e.accesible === 1}
                          disabled={accesibleM.isPending}
                          onChange={(ev) => accesibleM.mutate({ idempresa: e.idempresa, accesible: ev.target.checked ? 1 : 0 })} />
                        <span className={e.accesible === 1 ? 'text-emerald-700' : 'text-zinc-400'}>Accesible</span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              {/* MASTER */}
              <div>
                <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-zinc-700">
                  <Building2 className="h-4 w-4 text-violet-600" /> Empresas (master)
                </h3>
                <p className="mb-2 text-xs text-zinc-400"><code>idempresa_system</code> = empresa system a la que mapea (replica Contab./RRHH).</p>
                <div className="max-h-[60vh] divide-y divide-zinc-100 overflow-y-auto rounded-lg border border-zinc-200">
                  {(empresasQ.data?.master ?? []).map((e) => (
                    <div key={e.idempresa} className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs">
                      <span className="min-w-0 truncate">
                        <span className="font-mono text-zinc-400">#{e.idempresa}</span> {e.razonsocial}
                        {e.estado !== 1 && <span className="ml-1 text-rose-400">(inactiva)</span>}
                      </span>
                      <select className="input w-40 shrink-0 py-0.5 text-xs" value={e.idempresa_system ?? ''}
                        disabled={mappingM.isPending}
                        onChange={(ev) => mappingM.mutate({ idempresa: e.idempresa, idempresa_system: ev.target.value || null })}>
                        <option value="">— sin mapeo —</option>
                        {(empresasQ.data?.system ?? []).map((s) => (
                          <option key={s.idempresa} value={s.idempresa}>{s.idempresa} · {s.nombre}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                  {(empresasQ.data?.master ?? []).length === 0 && (
                    <div className="px-3 py-4 text-center text-xs text-zinc-400">Master no configurado o sin empresas.</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-zinc-500" />
                <h3 className="text-base font-semibold text-zinc-800">
                  {modal === 'crear' ? 'Nueva configuración' : `Editar: ${editIp}`}
                </h3>
              </div>
              <button onClick={cerrar} className="btn-ghost"><X className="h-4 w-4" /></button>
            </div>

            <div className="space-y-4 overflow-y-auto px-6 py-5" style={{ maxHeight: '70vh' }}>

              {/* Conexión */}
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Conexión</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div>
                  <label className="label">IP <span className="text-rose-500">*</span></label>
                  <input className="input mt-1 font-mono" value={form.ip}
                    onChange={set('ip')} maxLength={15} placeholder="192.168.1.1 o localhost"
                    readOnly={modal === 'editar'} />
                </div>
                <div>
                  <label className="label">Servidor</label>
                  <input className="input mt-1" value={form.server ?? ''} onChange={set('server')} maxLength={100} />
                </div>
                <div>
                  <label className="label">Sistema (BD)</label>
                  <input className="input mt-1" value={form.sys_cfg ?? ''} onChange={set('sys_cfg')} maxLength={100} />
                </div>
                <div>
                  <label className="label">Master</label>
                  <input className="input mt-1" value={form.master ?? ''} onChange={set('master')} maxLength={100} />
                </div>
                <div>
                  <label className="label">Usuario BD</label>
                  <input className="input mt-1 font-mono" value={form.user_bd ?? ''} onChange={set('user_bd')} maxLength={10} />
                </div>
                <div>
                  <label className="label">
                    Clave BD {modal === 'editar' && <span className="text-zinc-400 font-normal">(vacío = sin cambios)</span>}
                  </label>
                  <input className="input mt-1 font-mono" type="password" value={form.clave}
                    onChange={set('clave')} maxLength={20} autoComplete="new-password" />
                </div>
              </div>

              {/* Rutas / versión */}
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 pt-2">Rutas y versión</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div>
                  <label className="label">Ruta archivo</label>
                  <input className="input mt-1 font-mono text-xs" value={form.ruta_archivo ?? ''} onChange={set('ruta_archivo')} maxLength={100} />
                </div>
                <div>
                  <label className="label">Versión Nro.</label>
                  <input className="input mt-1" value={form.version_nro ?? ''} onChange={set('version_nro')} maxLength={10} />
                </div>
                <div>
                  <label className="label">Máximo</label>
                  <input className="input mt-1" type="number" min={0}
                    value={form.maximo ?? ''} onChange={set('maximo')} />
                </div>
              </div>

              {/* Flags */}
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 pt-2">Opciones</p>
              <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                {([
                  ['legajo',         'Legajo'],
                  ['biometrico',     'Biométrico'],
                  ['gastronomia',    'Gastronomía (oculta PDV si está desactivado)'],
                  ['complementario', 'Complementario'],
                  ['contabilidad',   'Contabilidad (BD Master)'],
                  ['talento_humano', 'Talento Humano (BD Master)'],
                  ['crear_sin_rol',  'Permitir crear usuarios "Sin Rol"'],
                  ['clonar',         'Clonar accesos a otra empresa (misma BD)'],
                  ['replicar',       'Replicar usuarios a BD destino (sucursales)'],
                ] as [keyof CfgForm, string][]).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer select-none text-sm text-zinc-700">
                    <input type="checkbox" className="h-4 w-4 rounded accent-brand-600"
                      checked={form[key] as boolean}
                      onChange={set(key)} />
                    {label}
                  </label>
                ))}
              </div>

              {/* Parámetros del worker de replicación — solo si Replicar activo */}
              {form.replicar && (
                <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                  <div>
                    <label className="label">Temporizador de replicación (min)</label>
                    <input className="input mt-1" type="number" min={1} max={1440}
                      value={form.temporizador_replicacion ?? 15}
                      onChange={set('temporizador_replicacion')} />
                    <p className="mt-1 text-xs text-zinc-400">
                      Cada cuántos minutos el worker reintenta los envíos pendientes. El envío
                      normal es inmediato. Default 15.
                    </p>
                  </div>
                  <div>
                    <label className="label">Retención de exitosos (horas)</label>
                    <input className="input mt-1" type="number" min={1} max={8760}
                      value={form.retencion_replicacion_horas ?? 48}
                      onChange={set('retencion_replicacion_horas')} />
                    <p className="mt-1 text-xs text-zinc-400">
                      Horas que se muestran los envíos ENVIADO antes de purgarlos de la lista.
                      Los ERROR/BLOQUEADO se mantienen. Default 48.
                    </p>
                  </div>
                </div>
              )}

              {/* Franja horaria de ingreso */}
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 pt-2">Franja horaria de ingreso</p>
              <div className="grid grid-cols-2 gap-x-8 gap-y-2 max-w-md">
                <div>
                  <label className="label">Hora inicio</label>
                  <input className="input mt-1" type="time"
                    value={form.hora_inicio ?? ''} onChange={set('hora_inicio')} />
                </div>
                <div>
                  <label className="label">Hora fin</label>
                  <input className="input mt-1" type="time"
                    value={form.hora_fin ?? ''} onChange={set('hora_fin')} />
                </div>
              </div>
              <p className="text-xs text-zinc-400">
                Restringe el ingreso al módulo a ese rango horario (ej. 06:00 a 20:00). Dejalo vacío para
                sin restricción. No aplica al usuario Admin.
              </p>

              {/* Autorización */}
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 pt-2">Acceso a Configuración</p>
              <div className="max-w-xs">
                <label className="label">Usuario autorizado</label>
                <input className="input mt-1 font-mono" value={form.autorizado ?? ''}
                  onChange={set('autorizado')} maxLength={10}
                  placeholder="iduser (además de Admin)" />
                <p className="mt-1 text-xs text-zinc-400">
                  El usuario Admin siempre tiene acceso. Este campo permite a un usuario adicional ver la sección Configuración.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-zinc-200 px-6 py-4">
              <button type="button" onClick={cerrar} className="btn-outline" disabled={busy}>Cancelar</button>
              <button type="button" onClick={onGuardar} className="btn-primary" disabled={busy}>
                {busy ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal ¿Qué Ocurre? */}
      {qOcurre && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-xl bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-zinc-200 px-6 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-sky-500" />
                  <h3 className="text-base font-semibold text-zinc-800">
                    ¿Qué ocurre en <code className="font-mono text-sky-700">{qOcurre.ip}</code>?
                  </h3>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {[
                    ['siempre',    'siempre',    'bg-zinc-100 text-zinc-600'],
                    ['legajo',     'Legajo',     'bg-blue-50 text-blue-700'],
                    ['biometrico', 'Biométrico', 'bg-amber-50 text-amber-700'],
                    ['gastronomia','Gastronomía','bg-emerald-50 text-emerald-700'],
                    ['master',     'Master',     'bg-violet-50 text-violet-700'],
                  ].map(([key, label, cls]) => (
                    activeFlags(qOcurre).has(key)
                      ? <span key={key} className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{label} ✓</span>
                      : <span key={key} className="rounded-full px-2.5 py-0.5 text-xs font-medium bg-zinc-50 text-zinc-300 line-through">{label}</span>
                  ))}
                </div>
              </div>
              <button onClick={() => setQOcurre(null)} className="btn-ghost shrink-0"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-2 overflow-y-auto px-6 py-4" style={{ maxHeight: '65vh' }}>
              {(opsQ.data || []).map((op) => {
                const flags = activeFlags(qOcurre);
                const ef = op.efectos.filter((e) => flags.has(e.flag));
                if (!ef.length) return null;
                return (
                  <div key={op.id} className="rounded-lg border border-zinc-100 bg-zinc-50 p-3 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-zinc-400">#{op.id}</span>
                      <span className="text-sm font-medium text-zinc-800">{op.descripcion}</span>
                    </div>
                    <ul className="space-y-0.5">
                      {ef.map((e, i) => (
                        <li key={i} className="flex items-baseline gap-1.5 text-xs">
                          <span className="text-zinc-300 select-none">›</span>
                          <span className={`rounded px-1 py-0.5 font-mono text-[10px] font-semibold shrink-0 ${bdColor[e.bd] ?? 'bg-zinc-100 text-zinc-600'}`}>{e.bd}</span>
                          <span className="text-zinc-600 leading-tight">{e.accion}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
              {opsQ.isLoading && (
                <p className="py-8 text-center text-sm text-zinc-400">Cargando catálogo…</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
