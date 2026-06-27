import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ShieldCheck, Plus, Pencil, Trash2, X, AlertTriangle, Search, Database, Lock } from 'lucide-react';
import toast from '../../lib/notify';
import { RolesAPI, type Rol } from '../../api/endpoints';
import { useConfirm } from '../../hooks/useConfirm';

const TIPOS = [
  { value: 0, label: 'Admin' },
  { value: 1, label: 'PDV' },
];

const emptyForm = { descripcion: '', iduser: '', tipo: 0, master: 0, edicion_rol: 0 };

export default function RolesPage() {
  const qc = useQueryClient();
  const [filtroEstado, setFiltroEstado] = useState<number | undefined>(1);
  const [filtroTexto, setFiltroTexto] = useState('');
  const rolesQ = useQuery<Rol[]>({
    queryKey: ['perfiles', filtroEstado],
    queryFn: () => RolesAPI.listar(filtroEstado != null ? { estado: filtroEstado } : undefined),
  });

  // Modal
  const [modal, setModal] = useState<null | 'crear' | 'editar'>(null);
  const [editando, setEditando] = useState<Rol | null>(null);
  const [form, setForm] = useState(emptyForm);

  const abrirCrear = () => {
    setForm(emptyForm);
    setEditando(null);
    setModal('crear');
  };
  const abrirEditar = (r: Rol) => {
    setForm({ descripcion: r.descripcion, iduser: r.iduser ?? '', tipo: r.tipo ?? 0, master: r.master ?? 0, edicion_rol: r.edicion_rol ?? 0 });
    setEditando(r);
    setModal('editar');
  };
  const cerrar = () => { setModal(null); setEditando(null); };

  const crearM = useMutation({
    mutationFn: () => RolesAPI.crear({ descripcion: form.descripcion, iduser: form.iduser, tipo: form.tipo, master: form.master }),
    onSuccess: () => { toast.success('Rol creado'); qc.invalidateQueries({ queryKey: ['perfiles'] }); qc.invalidateQueries({ queryKey: ['roles'] }); cerrar(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Error al crear'),
  });

  const editarM = useMutation({
    mutationFn: () => RolesAPI.actualizar(editando!.idtipo_usuario, { descripcion: form.descripcion, tipo: form.tipo, estado: editando!.estado, master: form.master, edicion_rol: form.edicion_rol }),
    onSuccess: () => { toast.success('Rol actualizado'); qc.invalidateQueries({ queryKey: ['perfiles'] }); qc.invalidateQueries({ queryKey: ['roles'] }); cerrar(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Error al actualizar'),
  });

  const eliminarM = useMutation({
    mutationFn: (id: number) => RolesAPI.eliminar(id),
    onSuccess: () => { toast.success('Rol desactivado'); qc.invalidateQueries({ queryKey: ['perfiles'] }); qc.invalidateQueries({ queryKey: ['roles'] }); },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Error al eliminar'),
  });

  const { confirm: confirmDialog, ConfirmDialog } = useConfirm();

  const onEliminar = async (r: Rol) => {
    if (!await confirmDialog({ title: 'Desactivar rol', message: `¿Desactivar el rol "${r.descripcion}"?`, confirmLabel: 'Desactivar', variant: 'danger' })) return;
    eliminarM.mutate(r.idtipo_usuario);
  };

  const onGuardar = () => {
    if (!form.descripcion.trim()) { toast.error('La descripción es requerida'); return; }
    if (modal === 'crear' && !form.iduser.trim()) { toast.error('El usuario plantilla es requerido'); return; }
    modal === 'crear' ? crearM.mutate() : editarM.mutate();
  };

  const busy = crearM.isPending || editarM.isPending;

  return (
    <div className="space-y-4">
      <ConfirmDialog />
      <div className="card flex flex-wrap items-center gap-3 p-4">
        <div className="flex-1">
          <h2 className="text-base font-semibold text-zinc-800">Roles / Perfiles</h2>
          <p className="text-sm text-zinc-500">Catálogo de <code>tipo_usuario</code>.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
            <input
              className="input py-1 pl-8 text-xs w-40"
              placeholder="Buscar rol…"
              value={filtroTexto}
              onChange={(e) => setFiltroTexto(e.target.value)}
            />
          </div>
          <label className="label">Estado</label>
          <select
            className="input py-1 text-xs"
            value={filtroEstado ?? ''}
            onChange={(e) => setFiltroEstado(e.target.value === '' ? undefined : Number(e.target.value))}
          >
            <option value={1}>Activos</option>
            <option value={0}>Inactivos</option>
            <option value="">Todos</option>
          </select>
        </div>
        <button className="btn-primary" onClick={abrirCrear}>
          <Plus className="h-4 w-4" /> Nuevo rol
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-800/70 dark:text-zinc-300">
            <tr>
              <th className="px-3 py-1.5 w-16">ID</th>
              <th className="px-3 py-1.5">Descripción</th>
              <th className="px-3 py-1.5">Usuario plantilla</th>
              <th className="px-3 py-1.5 w-24">Tipo</th>
              <th className="px-3 py-1.5 w-24">Estado</th>
              <th className="px-3 py-1.5 w-36 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {(rolesQ.data || [])
              .filter((r) => !filtroTexto || r.descripcion.toLowerCase().includes(filtroTexto.toLowerCase()))
              .map((r) => {
              const esAdmin = r.idtipo_usuario === 0;
              return (
              <tr key={r.idtipo_usuario} className="border-t border-zinc-100 hover:bg-zinc-50 dark:border-zinc-700/60 dark:hover:bg-zinc-800/50">
                <td className="px-3 py-1.5 font-medium text-zinc-500">{esAdmin ? '—' : r.idtipo_usuario}</td>
                <td className="px-3 py-1.5 font-medium">
                  <span>{r.descripcion}</span>
                  {(r.master ?? 0) === 1 && (
                    <span
                      className="ml-2 inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700"
                      title="Replica a BD MASTER (Contabilidad / RRHH)"
                    >
                      <Database className="h-3 w-3" /> Master
                    </span>
                  )}
                  {(r.edicion_rol ?? 0) === 1 && (
                    <span
                      className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700"
                      title="Permisos gestionados solo a través del rol"
                    >
                      <Lock className="h-3 w-3" /> Solo por rol
                    </span>
                  )}
                  {(r.menu_count ?? 1) === 0 && (
                    <span
                      className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700"
                      title="Sin configuración de Menú Gestión"
                    >
                      <AlertTriangle className="h-3 w-3" /> Sin menú
                    </span>
                  )}
                </td>
                <td className="px-3 py-1.5 font-mono text-xs text-zinc-500">{r.iduser}</td>
                <td className="px-3 py-1.5">{r.tipo === 1 ? 'PDV' : 'Admin'}</td>
                <td className="px-3 py-1.5">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    r.estado === 1 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                  }`}>
                    {r.estado === 1 ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-3 py-1.5">
                  <div className="flex justify-end gap-1">
                    {r.iduser && (
                      <Link
                        to={`/roles/${r.idtipo_usuario}/accesos`}
                        className="btn-ghost"
                        title="Editar permisos"
                      >
                        <ShieldCheck className="h-4 w-4 text-brand-600" />
                      </Link>
                    )}
                    <button
                      className={`btn-ghost ${esAdmin ? 'invisible' : ''}`}
                      title="Editar rol"
                      onClick={() => abrirEditar(r)}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      className={`btn-ghost ${esAdmin ? 'invisible' : ''}`}
                      title="Desactivar rol"
                      onClick={() => onEliminar(r)}
                      disabled={r.estado === 0}
                    >
                      <Trash2 className="h-4 w-4 text-rose-500" />
                    </button>
                  </div>
                </td>
              </tr>
              );
            })}
            {!rolesQ.isLoading && (rolesQ.data?.length ?? 0) === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-zinc-400">Sin roles</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
              <h3 className="text-base font-semibold text-zinc-800">
                {modal === 'crear' ? 'Nuevo rol' : `Editar: ${editando?.descripcion}`}
              </h3>
              <button onClick={cerrar} className="btn-ghost"><X className="h-4 w-4" /></button>
            </div>
            <div className="max-h-[88vh] space-y-3 overflow-y-auto px-6 py-4">
              {modal === 'editar' && (
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="label">ID</label>
                    <input className="input mt-1 bg-zinc-50 font-mono" value={editando?.idtipo_usuario ?? ''} readOnly />
                  </div>
                  <div className="flex-1">
                    <label className="label">Usuario plantilla</label>
                    <input className="input mt-1 bg-zinc-50 font-mono" value={editando?.iduser ?? ''} readOnly />
                  </div>
                </div>
              )}
              <div>
                <label className="label">Descripción</label>
                <input
                  className="input mt-1"
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                  placeholder="Ej: Cajero, Supervisor…"
                  maxLength={60}
                />
              </div>
              {modal === 'crear' && (
                <div>
                  <label className="label">Usuario plantilla (iduser)</label>
                  <input
                    className="input mt-1 font-mono"
                    value={form.iduser}
                    onChange={(e) => setForm({ ...form, iduser: e.target.value })}
                    placeholder="Ej: CAJERO"
                    maxLength={20}
                  />
                  <p className="mt-1 text-xs text-zinc-400">Se creará automáticamente en la tabla usuario.</p>
                </div>
              )}
              <div>
                <label className="label">Tipo</label>
                <select
                  className="input mt-1"
                  value={form.tipo}
                  onChange={(e) => setForm({ ...form, tipo: Number(e.target.value) })}
                >
                  {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-zinc-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded accent-brand-600"
                  checked={form.master === 1}
                  onChange={(e) => setForm({ ...form, master: e.target.checked ? 1 : 0 })}
                />
                <Database className="h-3.5 w-3.5 text-violet-600" />
                Replica a BD <strong>Master</strong> (Contabilidad / RRHH)
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-zinc-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded accent-brand-600"
                  checked={form.edicion_rol === 1}
                  onChange={(e) => setForm({ ...form, edicion_rol: e.target.checked ? 1 : 0 })}
                />
                <Lock className="h-3.5 w-3.5 text-amber-500" />
                Permisos solo editables <strong>a través del rol</strong> (bloquea edición directa por usuario)
              </label>
              {modal === 'editar' && (
                <div>
                  <label className="label">Estado</label>
                  <select
                    className="input mt-1"
                    value={editando?.estado ?? 1}
                    onChange={(e) => setEditando((prev) => prev ? { ...prev, estado: Number(e.target.value) } : prev)}
                  >
                    <option value={1}>Activo</option>
                    <option value={0}>Inactivo</option>
                  </select>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-zinc-200 px-6 py-4">
              <button className="btn-outline" onClick={cerrar} disabled={busy}>Cancelar</button>
              <button className="btn-primary" onClick={onGuardar} disabled={busy}>
                {busy ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
