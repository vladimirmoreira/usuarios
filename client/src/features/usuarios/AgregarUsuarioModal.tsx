import { useState, useRef, useCallback, ChangeEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, User, Upload, CheckCircle2, XCircle, Loader2, Wand2, ChevronDown, ChevronUp } from 'lucide-react';
import toast from '../../lib/notify';
import { z } from 'zod';
import { CatalogosAPI, RolesAPI, Rol, UsuariosAPI, ConfiguracionAPI } from '../../api/endpoints';

/* ── Esquema ───────────────────────────────────────────────────────── */
const schema = z.object({
  nombre:    z.string().min(1, 'Requerido').max(25, 'Máx. 25 caracteres'),
  apellido:  z.string().min(1, 'Requerido').max(25, 'Máx. 25 caracteres'),
  iduser:    z.string().min(1, 'Requerido').max(10, 'Máx. 10 caracteres')
               .regex(/^[A-Za-z0-9_]+$/, 'Solo letras, números y guión bajo'),
  documento: z.string().min(1, 'Requerido').max(20, 'Máx. 20 caracteres')
               .regex(/^[0-9]+$/, 'Solo dígitos numéricos'),
  idperfil:  z.number({ invalid_type_error: 'Seleccione un perfil' }).int().positive('Seleccione un perfil'),
  idsucursal:z.number({ invalid_type_error: 'Seleccione una sucursal' }).int().positive('Seleccione una sucursal'),
});

/* ── Tipos ─────────────────────────────────────────────────────────── */
type FormState = {
  nombre: string; apellido: string; iduser: string;
  documento: string; idperfil: number | ''; idsucursal: number | ''; hasta_vigencia: string;
};
type FormErrors = Partial<Record<keyof FormState, string>>;
type AvailStatus = 'idle' | 'checking' | 'ok' | 'taken';

const INITIAL: FormState = { nombre: '', apellido: '', iduser: '', documento: '', idperfil: '', idsucursal: '', hasta_vigencia: '' };
const MAX_FOTO = 2 * 1024 * 1024; // 2 MB

/* ── Componente ────────────────────────────────────────────────────── */
export default function AgregarUsuarioModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();

  const [form, setForm]               = useState<FormState>(INITIAL);
  const [errors, setErrors]           = useState<FormErrors>({});
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [fotoBase64, setFotoBase64]   = useState<string | null>(null);
  const [fotoError, setFotoError]     = useState<string | null>(null);
  const [iduserSugerido, setIduserSugerido] = useState(false);
  const [iduserStatus, setIduserStatus]     = useState<AvailStatus>('idle');
  const [docStatus, setDocStatus]           = useState<AvailStatus>('idle');
  const fileRef = useRef<HTMLInputElement>(null);

  const perfilesQ   = useQuery({ queryKey: ['perfiles-all'],   queryFn: () => RolesAPI.listar() });
  const sucursalesQ = useQuery({ queryKey: ['sucursales'], queryFn: CatalogosAPI.sucursales });
  const flagsQ      = useQuery({ queryKey: ['cfg-flags'], queryFn: ConfiguracionAPI.flags });

  // Sección Complementario (solo si la flag de configuración está activa)
  const [showComp, setShowComp] = useState(false);
  const [comp, setComp] = useState({ modo_print: '', talonario: '', descuento: '' });
  const setCompField = (f: 'modo_print' | 'talonario' | 'descuento') =>
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setComp((prev) => ({ ...prev, [f]: e.target.value }));

  const mutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res: any = await UsuariosAPI.crear(payload);
      if (res?.ok === false) return res; // error del SP de alta
      // Guardar complemento si la flag está activa y se cargó algún valor
      if (flagsQ.data?.complementario &&
          (comp.modo_print !== '' || comp.talonario !== '' || comp.descuento !== '')) {
        try {
          await UsuariosAPI.updateComplemento(String(payload.iduser), {
            modo_print: comp.modo_print === '' ? null : Number(comp.modo_print),
            talonario:  comp.talonario  === '' ? null : Number(comp.talonario),
            descuento:  comp.descuento  === '' ? null : Number(comp.descuento),
          });
        } catch (_) { /* el usuario ya se creó; el complemento puede ajustarse luego en Editar */ }
      }
      return res;
    },
    onSuccess: (res: any) => {
      if (res?.ok === false) { toast.error(res.mensaje || 'Error al crear el usuario'); return; }
      toast.success(res?.detalle ? `Usuario creado · ${res.detalle}` : 'Usuario creado correctamente');
      qc.invalidateQueries({ queryKey: ['usuarios'] });
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Error al crear el usuario'),
  });

  /* ── Setters ─────────────────────────────────────────────────────── */
  const setField = (field: keyof FormState) =>
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
      if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
      if (field === 'nombre' || field === 'apellido') {
        setIduserSugerido(false);
        setIduserStatus('idle');
      }
      if (field === 'iduser')    { setIduserSugerido(false); setIduserStatus('idle'); }
      if (field === 'documento') setDocStatus('idle');
    };

  /* ── Auto-sugerir usuario ────────────────────────────────────────── */
  const sugerirUsuario = useCallback(async (nombre: string, apellido: string) => {
    if (!nombre.trim() || !apellido.trim()) return;
    setIduserStatus('checking');
    try {
      const { sugerido } = await UsuariosAPI.sugerirIduser(nombre.trim(), apellido.trim());
      if (sugerido) {
        setForm((prev) => ({ ...prev, iduser: sugerido }));
        setIduserSugerido(true);
        setIduserStatus('ok');
        setErrors((prev) => ({ ...prev, iduser: undefined }));
      } else {
        setIduserStatus('idle');
        toast('No se pudo generar un usuario disponible. Ingréselo manualmente.', { icon: '⚠️' });
      }
    } catch (_) { setIduserStatus('idle'); }
  }, []);

  const onNombreBlur  = () => { if (form.nombre.trim() && form.apellido.trim()) sugerirUsuario(form.nombre, form.apellido); };
  const onApellidoBlur = () => { if (form.nombre.trim() && form.apellido.trim()) sugerirUsuario(form.nombre, form.apellido); };

  /* ── Verificar disponibilidad manual del usuario ─────────────────── */
  const onIduserBlur = async () => {
    const iduser = form.iduser.trim().toUpperCase();
    if (!iduser) return;
    setIduserStatus('checking');
    try {
      await UsuariosAPI.obtener(iduser);
      setIduserStatus('taken');
      setErrors((prev) => ({ ...prev, iduser: 'Ese usuario ya existe' }));
    } catch (e: any) {
      if (e?.response?.status === 404) {
        setIduserStatus('ok');
        setErrors((prev) => ({ ...prev, iduser: undefined }));
      } else { setIduserStatus('idle'); }
    }
  };

  /* ── Verificar unicidad de documento ─────────────────────────────── */
  const onDocumentoBlur = async () => {
    const doc = form.documento.trim();
    if (!doc || !/^[0-9]+$/.test(doc)) return;
    setDocStatus('checking');
    try {
      const { disponible } = await UsuariosAPI.checkDocumento(doc);
      setDocStatus(disponible ? 'ok' : 'taken');
      if (!disponible) setErrors((prev) => ({ ...prev, documento: 'Documento ya registrado' }));
      else             setErrors((prev) => ({ ...prev, documento: undefined }));
    } catch (_) { setDocStatus('idle'); }
  };

  /* ── Foto ────────────────────────────────────────────────────────── */
  const onFotoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setFotoError('El archivo debe ser una imagen'); return; }
    if (file.size > MAX_FOTO)            { setFotoError('La imagen no debe superar 2 MB'); return; }
    setFotoError(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setFotoPreview(dataUrl);
      setFotoBase64(dataUrl.split(',')[1]);
    };
    reader.readAsDataURL(file);
  };

  const quitarFoto = () => {
    setFotoPreview(null); setFotoBase64(null); setFotoError(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  /* ── Validación y submit ─────────────────────────────────────────── */
  const validate = (): boolean => {
    const result = schema.safeParse({
      ...form,
      idperfil:   form.idperfil   === '' ? undefined : Number(form.idperfil),
      idsucursal: form.idsucursal === '' ? undefined : Number(form.idsucursal),
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
    if (iduserStatus === 'taken') { toast.error('El usuario ya existe, elige otro'); return; }
    if (docStatus     === 'taken') { toast.error('El documento ya está registrado');  return; }

    const payload: Record<string, unknown> = {
      iduser:     form.iduser.trim().toUpperCase(),
      nombre:     form.nombre.trim(),
      apellido:   form.apellido.trim(),
      documento:  form.documento.trim(),
      idperfil:   Number(form.idperfil),
      idsucursal: Number(form.idsucursal),
    };
    if (fotoBase64) payload.foto = fotoBase64;
    if (form.hasta_vigencia) payload.hasta_vigencia = form.hasta_vigencia;
    mutation.mutate(payload);
  };

  /* ── Helpers de render ───────────────────────────────────────────── */
  const errCls = (f: keyof FormState) =>
    errors[f] ? 'border-rose-400 focus:border-rose-400 focus:ring-rose-100' : '';

  const StatusIcon = ({ status }: { status: AvailStatus }) => {
    if (status === 'checking') return <Loader2 className="h-4 w-4 animate-spin text-slate-400" />;
    if (status === 'ok')       return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    if (status === 'taken')    return <XCircle className="h-4 w-4 text-rose-500" />;
    return null;
  };

  /* ── JSX ─────────────────────────────────────────────────────────── */
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="w-full max-w-3xl rounded-xl bg-white shadow-xl">
        {/* Cabecera */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-800">Agregar Usuario</h2>
          <button type="button" onClick={onClose} className="btn-ghost p-1" title="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} noValidate>
          <div className="max-h-[88vh] space-y-3 overflow-y-auto px-6 py-4">

            {/* ── Foto + datos principales ───────────────────────── */}
            <div className="flex gap-4">
            <div className="flex shrink-0 flex-col items-center gap-1">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="relative flex h-20 w-20 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-slate-300 bg-slate-50 transition hover:border-brand-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                title="Haga clic para seleccionar foto"
              >
                {fotoPreview
                  ? <img src={fotoPreview} alt="Foto" className="h-full w-full object-cover" />
                  : <div className="flex flex-col items-center text-slate-400"><User className="h-8 w-8" /><Upload className="mt-1 h-4 w-4" /></div>
                }
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFotoChange} />
              <span className="text-center text-[10px] leading-tight text-slate-500">Foto<br />(máx. 2&nbsp;MB)</span>
              {fotoError && <p className="text-[10px] text-rose-600">{fotoError}</p>}
              {fotoPreview && (
                <button type="button" onClick={quitarFoto} className="text-[10px] text-slate-400 underline hover:text-rose-600">
                  Quitar
                </button>
              )}
            </div>

            {/* ── Nombre / Apellido / Usuario ─────────────────────── */}
            <div className="grid flex-1 grid-cols-2 gap-x-3 gap-y-2">

              {/* Nombre */}
              <div>
                <label className="label">Nombre <span className="text-rose-500">*</span></label>
                <input
                  value={form.nombre} onChange={setField('nombre')} onBlur={onNombreBlur}
                  maxLength={25} autoComplete="off" placeholder="Nombre"
                  className={`input mt-1 ${errCls('nombre')}`}
                />
                {errors.nombre && <p className="mt-0.5 text-xs text-rose-600">{errors.nombre}</p>}
              </div>

              {/* Apellido */}
              <div>
                <label className="label">Apellido(s) <span className="text-rose-500">*</span></label>
                <input
                  value={form.apellido} onChange={setField('apellido')} onBlur={onApellidoBlur}
                  maxLength={25} autoComplete="off" placeholder="Ej: Gomez Gonzalez"
                  className={`input mt-1 ${errCls('apellido')}`}
                />
                {errors.apellido
                  ? <p className="mt-0.5 text-xs text-rose-600">{errors.apellido}</p>
                  : <p className="mt-0.5 text-xs text-slate-400">Separe dos apellidos con un espacio</p>
                }
              </div>

              {/* Usuario (auto-sugerido) */}
              <div className="col-span-2">
                <div className="flex items-center justify-between">
                  <label className="label">Usuario <span className="text-rose-500">*</span></label>
                  {iduserSugerido && (
                    <span className="flex items-center gap-1 text-xs font-medium text-brand-600">
                      <Wand2 className="h-3 w-3" /> Sugerido automáticamente
                    </span>
                  )}
                </div>
                <div className="relative mt-1">
                  <input
                    value={form.iduser} onChange={setField('iduser')} onBlur={onIduserBlur}
                    maxLength={10} autoComplete="off" placeholder="Se genera al completar nombre y apellido"
                    className={`input uppercase pr-8 ${errCls('iduser')}`}
                  />
                  <span className="pointer-events-none absolute right-2.5 top-2.5">
                    <StatusIcon status={iduserStatus} />
                  </span>
                </div>
                {errors.iduser
                  ? <p className="mt-0.5 text-xs text-rose-600">{errors.iduser}</p>
                  : iduserStatus === 'ok' && !errors.iduser
                    ? <p className="mt-0.5 text-xs text-emerald-600">Disponible</p>
                    : <p className="mt-0.5 text-xs text-slate-400">Inicial del nombre + apellido (máx. 10 chars)</p>
                }
              </div>
            </div>
            </div>

            {/* ── Documento / Perfil / Sucursal ───────────────────── */}
            <div className="grid grid-cols-3 gap-x-3 gap-y-2">

              {/* Documento */}
              <div>
                <label className="label">Documento <span className="text-rose-500">*</span></label>
                <div className="relative mt-1">
                  <input
                    value={form.documento} onChange={setField('documento')} onBlur={onDocumentoBlur}
                    maxLength={20} autoComplete="off" inputMode="numeric" placeholder="Nro. de documento"
                    className={`input pr-8 ${errCls('documento')}`}
                  />
                  <span className="pointer-events-none absolute right-2.5 top-2.5">
                    <StatusIcon status={docStatus} />
                  </span>
                </div>
                {errors.documento
                  ? <p className="mt-0.5 text-xs text-rose-600">{errors.documento}</p>
                  : docStatus === 'ok'
                    ? <p className="mt-0.5 text-xs text-emerald-600">Documento disponible</p>
                    : null
                }
              </div>

              {/* Perfil */}
              <div>
                <label className={`label ${docStatus === 'taken' ? 'opacity-40' : ''}`}>Perfil <span className="text-rose-500">*</span></label>
                <select
                  value={form.idperfil}
                  onChange={setField('idperfil')}
                  disabled={docStatus === 'taken'}
                  className={`input mt-1 ${errCls('idperfil')} ${docStatus === 'taken' ? 'cursor-not-allowed opacity-40' : ''}`}
                >
                  <option value="">Seleccionar…</option>
                  {(perfilesQ.data || []).map((p: Rol) => {
                    const inactivo = p.estado !== 1;
                    const sinMenu  = (p.menu_count ?? 1) === 0;
                    const disabled = inactivo || sinMenu;
                    const label    = p.descripcion
                      + (inactivo ? ' (Inactivo)' : sinMenu ? ' (Sin menú)' : '');
                    return (
                      <option key={p.idtipo_usuario} value={p.idtipo_usuario} disabled={disabled}>
                        {label}
                      </option>
                    );
                  })}
                </select>
                {errors.idperfil && <p className="mt-0.5 text-xs text-rose-600">{errors.idperfil}</p>}
              </div>

              {/* Sucursal */}
              <div>
                <label className={`label ${docStatus === 'taken' ? 'opacity-40' : ''}`}>Sucursal <span className="text-rose-500">*</span></label>
                <select
                  value={form.idsucursal}
                  onChange={setField('idsucursal')}
                  disabled={docStatus === 'taken'}
                  className={`input mt-1 ${errCls('idsucursal')} ${docStatus === 'taken' ? 'cursor-not-allowed opacity-40' : ''}`}
                >
                  <option value="">Seleccionar…</option>
                  {(sucursalesQ.data || []).map((s: any) => (
                    <option key={s.idsucursal} value={s.idsucursal}>{s.nombre}</option>
                  ))}
                </select>
                {errors.idsucursal && <p className="mt-0.5 text-xs text-rose-600">{errors.idsucursal}</p>}
              </div>

              {/* Vigencia hasta (opcional) */}
              <div>
                <label className="label">Vigencia hasta</label>
                <input type="date" value={form.hasta_vigencia} onChange={setField('hasta_vigencia')} className="input mt-1" />
                <p className="mt-0.5 text-xs text-slate-400">Opcional — caduca el acceso</p>
              </div>

            </div>

            {/* ── Complementario (acordeón, solo si la flag de config está activa) ── */}
            {flagsQ.data?.complementario && (
              <div className="-mx-6 border-t border-slate-200 px-6">
                <button
                  type="button"
                  onClick={() => setShowComp((v) => !v)}
                  className="flex w-full items-center justify-between py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  <span>Complementario</span>
                  {showComp ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                </button>
                {showComp && (
                  <div className="grid grid-cols-3 gap-x-3 gap-y-2 pb-3">
                    <div>
                      <label className="label">Impresión</label>
                      <select value={comp.modo_print} onChange={setCompField('modo_print')} className="input mt-1">
                        <option value="">—</option>
                        <option value={0}>Directa</option>
                        <option value={1}>Cola de impresión</option>
                        <option value={2}>Dual</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Talonario</label>
                      <input type="number" min={0} value={comp.talonario} onChange={setCompField('talonario')} className="input mt-1" />
                    </div>
                    <div>
                      <label className="label">Descuento</label>
                      <input type="number" min={0} step="0.01" value={comp.descuento} onChange={setCompField('descuento')} className="input mt-1" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Pie */}
          <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
            <button type="button" onClick={onClose} className="btn-outline" disabled={mutation.isPending}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={mutation.isPending}>
              {mutation.isPending ? 'Guardando…' : 'Crear Usuario'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
