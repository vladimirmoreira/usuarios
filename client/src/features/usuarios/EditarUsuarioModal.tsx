import { useState, ChangeEvent, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Pencil, CheckCircle2, XCircle, Loader2, ChevronDown, ChevronUp, MapPin, Copy, Radio } from 'lucide-react';
import toast from '../../lib/notify';
import { z } from 'zod';
import { RolesAPI, Rol, UsuariosAPI, Usuario, Complemento, ConfiguracionAPI, ReplicacionAPI } from '../../api/endpoints';
import { useAuth } from '../../auth/AuthContext';

/* ── Esquema ───────────────────────────────────────────────────────── */
const schema = z.object({
  nombre:    z.string().min(1, 'Requerido').max(25, 'Máx. 25 caracteres'),
  apellido:  z.string().min(1, 'Requerido').max(25, 'Máx. 25 caracteres'),
  documento: z.string().min(1, 'Requerido').max(20, 'Máx. 20 caracteres')
               .regex(/^[0-9]+$/, 'Solo dígitos numéricos'),
  // Permite 0 ("Sin Rol") y -1 ("Sin Asignación", valor actual de usuarios legados).
  idperfil:  z.number({ invalid_type_error: 'Seleccione un perfil' }).int(),
});

/* ── Tipos ─────────────────────────────────────────────────────────── */
type FormState = {
  nombre: string;
  apellido: string;
  documento: string;
  idperfil: number | '';
  hasta_vigencia: string;
};
type FormErrors = Partial<Record<keyof FormState, string>>;
type DocStatus = 'idle' | 'checking' | 'ok' | 'taken';

/* ── Componente ────────────────────────────────────────────────────── */
export default function EditarUsuarioModal({
  usuario,
  onClose,
}: {
  usuario: Usuario;
  onClose: () => void;
}) {
  const qc = useQueryClient();

  const [form, setForm] = useState<FormState>({
    nombre:    usuario.nombre,
    apellido:  usuario.apellido,
    documento: usuario.documento,
    idperfil:  usuario.idtipo_usuario,
    hasta_vigencia: usuario.hasta_vigencia ? String(usuario.hasta_vigencia).slice(0, 10) : '',
  });
  const [errors, setErrors]   = useState<FormErrors>({});
  const [docStatus, setDocStatus] = useState<DocStatus>('idle');
  const [showComplemento, setShowComplemento] = useState(false);
  const [complemento, setComplemento]         = useState<Complemento | null>(null);
  const [compLoading, setCompLoading]         = useState(false);
  const [compDirty, setCompDirty]             = useState(false);

  // Sucursal principal (lazy)
  const sucursalQ = useQuery({
    queryKey: ['sucursal-principal', usuario.iduser],
    queryFn: () => UsuariosAPI.sucursalPrincipal(usuario.iduser),
    staleTime: 60_000,
  });

  const perfilesQ = useQuery({ queryKey: ['perfiles-all'], queryFn: () => RolesAPI.listar() });
  const flagsQ    = useQuery({ queryKey: ['cfg-flags'], queryFn: ConfiguracionAPI.flags });

  // Clonar accesos a otra empresa. Destinos = accesibles, ≠ 1 (base) y ≠ la actual.
  const { user } = useAuth();
  const empresasQ = useQuery({ queryKey: ['empresas'], queryFn: ConfiguracionAPI.empresas, staleTime: 60_000 });
  const [destino, setDestino] = useState('');
  const destinos = (empresasQ.data?.system ?? []).filter(
    (e) => e.accesible === 1 && e.idempresa !== '1' && e.idempresa !== user?.idempresa,
  );
  // Replicar usuario a las sucursales destino (encola + dispara el drenado).
  const replicarM = useMutation({
    mutationFn: () => ReplicacionAPI.replicarUsuario(usuario.iduser),
    onSuccess: (r) => toast.success(
      r.encolados > 0 ? `Replicación encolada a ${r.encolados} destino/s` : 'No hay destinos activos'),
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Error al replicar'),
  });

  const clonarM = useMutation({
    mutationFn: () => UsuariosAPI.clonarAEmpresa(usuario.iduser, destino),
    onSuccess: (r) => {
      if (r.clonado) toast.success(`Accesos clonados a la empresa ${r.empresa}`);
      else toast(typeof r.detalle === 'string' ? r.detalle : 'Sin cambios', { icon: 'ℹ️' });
      setDestino('');
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Error al clonar'),
  });

  // "pendiente": el usuario aún no tiene un rol real (Sin Rol=0, Sin Asignación=-1 o NULL).
  // Solo en ese estado se puede asignar "Sin Rol"; con rol real no se permite el downgrade.
  const pendiente = usuario.idtipo_usuario === 0 || usuario.idtipo_usuario === -1 || usuario.idtipo_usuario == null;

  const mutation = useMutation({
    mutationFn: async (data: { nombre: string; apellido: string; documento: string; idperfil: number; hasta_vigencia: string }) => {
      const ops: Promise<any>[] = [];
      // Actualizar datos básicos siempre (el backend ignora campos sin cambios)
      ops.push(UsuariosAPI.actualizar(usuario.iduser, {
        nombre:    data.nombre.trim(),
        apellido:  data.apellido.trim(),
        documento: data.documento.trim(),
        hasta_vigencia: data.hasta_vigencia || null,
      }));
      // Cambiar perfil solo si se modificó
      if (data.idperfil !== usuario.idtipo_usuario) {
        ops.push(UsuariosAPI.cambiarPerfil(usuario.iduser, data.idperfil));
      }
      // Guardar complemento si fue cargado y modificado
      if (complemento !== null && compDirty) {
        ops.push(UsuariosAPI.updateComplemento(usuario.iduser, complemento));
      }
      return Promise.all(ops);
    },
    onSuccess: (results: any[]) => {
      const fallidos = results.filter((r) => r && r.ok === false);
      if (fallidos.length) {
        toast.error(fallidos.map((r) => r.mensaje || 'Error parcial').join(' · '));
      } else {
        const detalles = results
          .map((r) => r?.detalle)
          .filter((d): d is string => !!d);
        toast.success(
          detalles.length ? `Usuario actualizado · ${detalles.join(' · ')}` : 'Usuario actualizado',
        );
      }
      qc.invalidateQueries({ queryKey: ['usuarios'] });
      onClose();
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.error || 'Error al actualizar el usuario');
    },
  });

  /* ── Handlers ────────────────────────────────────────────────────── */
  const setField = (field: keyof FormState) =>
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
      if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
      if (field === 'documento') setDocStatus('idle');
    };

  const onDocumentoBlur = async () => {
    const doc = form.documento.trim();
    // Si no cambió, no verificar
    if (!doc || !/^[0-9]+$/.test(doc) || doc === usuario.documento.trim()) {
      setDocStatus('idle');
      return;
    }
    setDocStatus('checking');
    try {
      const { disponible } = await UsuariosAPI.checkDocumento(doc, usuario.iduser);
      setDocStatus(disponible ? 'ok' : 'taken');
      if (!disponible) setErrors((prev) => ({ ...prev, documento: 'Documento ya registrado' }));
      else             setErrors((prev) => ({ ...prev, documento: undefined }));
    } catch (_) { setDocStatus('idle'); }
  };

  /* ── Validación ──────────────────────────────────────────────────── */
  const validate = (): boolean => {
    const result = schema.safeParse({
      ...form,
      idperfil: form.idperfil === '' ? undefined : Number(form.idperfil),
    });
    if (result.success) { setErrors({}); return true; }
    const errs: FormErrors = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0] as keyof FormState;
      if (!errs[key]) errs[key] = issue.message;
    }
    setErrors(errs);
    return false;
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (docStatus === 'taken') { toast.error('El documento ya está registrado'); return; }
    mutation.mutate({
      nombre:    form.nombre,
      apellido:  form.apellido,
      documento: form.documento,
      idperfil:  Number(form.idperfil),
      hasta_vigencia: form.hasta_vigencia,
    });
  };

  const errCls = (f: keyof FormState) =>
    errors[f] ? 'border-rose-400 focus:border-rose-400 focus:ring-rose-100' : '';

  const toggleComplemento = async () => {
    if (!showComplemento && complemento === null) {
      setCompLoading(true);
      try {
        const data = await UsuariosAPI.getComplemento(usuario.iduser);
        setComplemento(data);
      } catch {
        toast.error('Error al cargar complemento');
      } finally {
        setCompLoading(false);
      }
    }
    setShowComplemento((v) => !v);
  };

  const setComp = (field: keyof Complemento) =>
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const raw = e.target.value;
      const val = raw === '' ? null : Number(raw);
      setComplemento((prev) => prev ? { ...prev, [field]: val } : prev);
      setCompDirty(true);
    };

  /* ── JSX ─────────────────────────────────────────────────────────── */
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
        {/* Cabecera */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-zinc-500" />
            <h2 className="text-base font-semibold text-zinc-800">Modificar Usuario</h2>
          </div>
          <button type="button" onClick={onClose} className="btn-ghost p-1" title="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} noValidate>
          <div className="max-h-[82vh] space-y-2 overflow-y-auto px-6 py-3">

            {/* Usuario — solo lectura */}
            <div>
              <label className="label">Usuario</label>
              <div className="mt-1 flex h-8 items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm font-semibold tracking-wide text-zinc-700">
                {usuario.iduser}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2">

              {/* Nombre */}
              <div>
                <label className="label">Nombre <span className="text-rose-500">*</span></label>
                <input
                  value={form.nombre} onChange={setField('nombre')}
                  maxLength={25} autoComplete="off"
                  className={`input mt-1 ${errCls('nombre')}`}
                />
                {errors.nombre && <p className="mt-0.5 text-xs text-rose-600">{errors.nombre}</p>}
              </div>

              {/* Apellido */}
              <div>
                <label className="label">Apellido <span className="text-rose-500">*</span></label>
                <input
                  value={form.apellido} onChange={setField('apellido')}
                  maxLength={25} autoComplete="off"
                  className={`input mt-1 ${errCls('apellido')}`}
                />
                {errors.apellido && <p className="mt-0.5 text-xs text-rose-600">{errors.apellido}</p>}
              </div>

              {/* Documento */}
              <div>
                <label className="label">Documento <span className="text-rose-500">*</span></label>
                <div className="relative mt-1">
                  <input
                    value={form.documento} onChange={setField('documento')} onBlur={onDocumentoBlur}
                    maxLength={20} autoComplete="off" inputMode="numeric"
                    className={`input pr-8 ${errCls('documento')}`}
                  />
                  <span className="pointer-events-none absolute right-2.5 top-2.5">
                    {docStatus === 'checking' && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
                    {docStatus === 'taken'    && <XCircle className="h-4 w-4 text-rose-500" />}
                    {docStatus === 'ok'       && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                  </span>
                </div>
                {errors.documento
                  ? <p className="mt-0.5 text-xs text-rose-600">{errors.documento}</p>
                  : docStatus === 'ok' && <p className="mt-0.5 text-xs text-emerald-600">Documento disponible</p>
                }
              </div>

              {/* Perfil */}
              <div>
                <label className="label">Perfil <span className="text-rose-500">*</span></label>
                <select
                  value={form.idperfil} onChange={setField('idperfil')}
                  className={`input mt-1 ${errCls('idperfil')}`}
                >
                  <option value="">Seleccionar…</option>
                  {(perfilesQ.data || [])
                    .filter((p: Rol) => {
                      // "Sin Asignación" (-1): solo visible si es el perfil actual del usuario.
                      if (p.idtipo_usuario === -1) return usuario.idtipo_usuario === -1;
                      // "Sin Rol" (0): visible si la config lo habilita o el usuario aún no tiene rol real.
                      if (p.idtipo_usuario === 0)  return flagsQ.data?.crear_sin_rol || pendiente;
                      return true;
                    })
                    .map((p: Rol) => {
                    const esSinRol    = p.idtipo_usuario === 0;
                    const esSinAsig   = p.idtipo_usuario === -1;
                    const inactivo    = p.estado !== 1;
                    // Un rol solo es asignable si tiene al menos un permiso de menú activo.
                    const sinPermisos = (p.permisos_activos ?? 1) === 0;
                    const esActual = p.idtipo_usuario === usuario.idtipo_usuario;
                    let disabled: boolean;
                    let label: string;
                    if (esSinAsig) {
                      disabled = true;                 // no se asigna un usuario A "Sin Asignación"
                      label = 'Sin Asignación';
                    } else if (esSinRol) {
                      disabled = !pendiente;           // "Sin Rol" solo para usuarios sin rol real (0/-1)
                      label = 'Sin Rol';
                    } else {
                      disabled = !esActual && (inactivo || sinPermisos);
                      label = p.descripcion + (inactivo ? ' (Inactivo)' : sinPermisos ? ' (Sin permisos)' : '');
                    }
                    return (
                      <option key={p.idtipo_usuario} value={p.idtipo_usuario} disabled={disabled}>
                        {label}
                      </option>
                    );
                  })}
                </select>
                {errors.idperfil && <p className="mt-0.5 text-xs text-rose-600">{errors.idperfil}</p>}
              </div>

              {/* Vigencia hasta (opcional) */}
              <div>
                <label className="label">Vigencia hasta</label>
                <input type="date" value={form.hasta_vigencia} onChange={setField('hasta_vigencia')} className="input mt-1" />
                <p className="mt-0.5 text-xs text-slate-400">Vacío = sin caducidad</p>
              </div>

              {/* Clonar accesos a otra empresa (celda libre al lado de Vigencia) */}
              {/* Solo visible si Configuración tiene el flag CLONAR activo. */}
              {flagsQ.data?.clonar && (
              <div>
                <label className="label">Clonar accesos a empresa</label>
                <div className="mt-1 flex gap-2">
                  <select
                    className="input"
                    value={destino}
                    onChange={(e) => setDestino(e.target.value)}
                    disabled={empresasQ.isLoading || clonarM.isPending}
                  >
                    <option value="">— empresa destino —</option>
                    {destinos.map((e) => (
                      <option key={e.idempresa} value={e.idempresa}>{e.nombre} (#{e.idempresa})</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn-outline shrink-0"
                    disabled={!destino || clonarM.isPending}
                    onClick={() => clonarM.mutate()}
                    title="Copia permisos y menú a la empresa destino (no sucursal ni depósitos)"
                  >
                    {clonarM.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                    Clonar
                  </button>
                </div>
                <p className="mt-0.5 text-xs text-slate-400">Copia permisos/menú (no sucursal/depósitos). No sobrescribe si ya existe.</p>
              </div>
              )}

              {/* Replicar a sucursales destino (motor de replicación) */}
              {flagsQ.data?.replicar && (
              <div>
                <label className="label">Replicar a sucursales</label>
                <div className="mt-1">
                  <button
                    type="button"
                    className="btn-outline"
                    disabled={replicarM.isPending}
                    onClick={() => replicarM.mutate()}
                    title="Encola la replicación de este usuario a todas las sucursales destino activas"
                  >
                    {replicarM.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radio className="h-4 w-4" />}
                    Replicar
                  </button>
                </div>
                <p className="mt-0.5 text-xs text-slate-400">Encola a todos los destinos activos. El estado se ve en el menú Replicación.</p>
              </div>
              )}

              {/* Sucursal actual (read-only) */}
              <div className="col-span-2">
                <label className="label">Sucursal actual</label>
                <div className="mt-1 flex h-9 items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700">
                  {sucursalQ.isLoading
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />
                    : sucursalQ.data
                      ? <><MapPin className="h-3.5 w-3.5 text-brand-500 shrink-0" />{sucursalQ.data.nombre}</>
                      : <span className="text-zinc-400 italic">Sin sucursal asignada</span>
                  }
                </div>
                <p className="mt-0.5 text-xs text-zinc-400">Para cambiarla usá el botón Sucursal en la grilla</p>
              </div>

            </div>
          </div>

          {/* ── Complementario (abanico) ────────────────────────── */}
          <div className="border-t border-slate-200">
            <button
              type="button"
              onClick={toggleComplemento}
              className="flex w-full items-center justify-between px-6 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <span>Complementario</span>
              {compLoading
                ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                : showComplemento
                  ? <ChevronUp className="h-4 w-4 text-slate-400" />
                  : <ChevronDown className="h-4 w-4 text-slate-400" />
              }
            </button>

            {showComplemento && complemento !== null && (
              <div className="grid grid-cols-3 gap-x-4 gap-y-3 px-6 pb-4">
                {/* Impresión */}
                <div>
                  <label className="label">Impresión</label>
                  <select
                    value={complemento.modo_print ?? ''}
                    onChange={setComp('modo_print')}
                    className="input mt-1"
                  >
                    <option value="">—</option>
                    <option value={0}>Directa</option>
                    <option value={1}>Cola de impresión</option>
                    <option value={2}>Dual</option>
                  </select>
                </div>

                {/* Talonario */}
                <div>
                  <label className="label">Talonario</label>
                  <input
                    type="number" min={0}
                    value={complemento.talonario ?? ''}
                    onChange={setComp('talonario')}
                    className="input mt-1"
                  />
                </div>

                {/* Descuento */}
                <div>
                  <label className="label">Descuento</label>
                  <input
                    type="number" min={0} step="0.01"
                    value={complemento.descuento ?? ''}
                    onChange={setComp('descuento')}
                    className="input mt-1"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Pie */}
          <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-3">
            <button type="button" onClick={onClose} className="btn-outline" disabled={mutation.isPending}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={mutation.isPending}>
              {mutation.isPending ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
