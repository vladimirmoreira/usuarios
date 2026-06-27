import { useEffect, useState } from 'react';
import { X, KeyRound, ShieldCheck, Copy, Loader2 } from 'lucide-react';
import toast from '../../lib/notify';
import { UsuariosAPI } from '../../api/endpoints';

type Info = { simulado: boolean; mail_habilitado: boolean; codigo: string; expira_min: number };

/** Reset de clave con código de verificación (simulado: el código se muestra al operador). */
export default function ResetClaveModal({ iduser, onClose }: { iduser: string; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [info, setInfo]       = useState<Info | null>(null);
  const [codigo, setCodigo]   = useState('');
  const [nuevaClave, setNuevaClave] = useState('');
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    let active = true;
    UsuariosAPI.resetClaveIniciar(iduser)
      .then((r) => { if (active) setInfo(r); })
      .catch((e: any) => { if (active) toast.error(e?.response?.data?.error || 'No se pudo generar el código'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [iduser]);

  const confirmar = async () => {
    if (codigo.trim().length < 4) { toast.error('Ingresá el código de verificación'); return; }
    setSaving(true);
    try {
      const r: any = await UsuariosAPI.resetClaveConfirmar(iduser, codigo.trim(), nuevaClave.trim() || undefined);
      if (r?.ok === false) { toast.error(r.mensaje || 'No se pudo reiniciar'); return; }
      toast.success('Clave reiniciada correctamente');
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Código inválido o vencido');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-700">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-brand-600" />
            <h2 className="text-base font-semibold text-zinc-800 dark:text-zinc-100">Reiniciar clave — {iduser}</h2>
          </div>
          <button onClick={onClose} className="btn-ghost p-1" title="Cerrar"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-3 px-6 py-4">
          {loading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Generando código de verificación…
            </div>
          ) : info ? (
            <>
              <div className="rounded-lg border border-brand-200 bg-brand-50 p-3 text-center dark:border-brand-900 dark:bg-brand-900/20">
                <p className="text-xs text-zinc-500">
                  Código de verificación {info.mail_habilitado ? '(correo no configurado — simulado)' : '(simulado)'}
                </p>
                <div className="mt-1 flex items-center justify-center gap-2">
                  <span className="font-mono text-2xl font-bold tracking-[0.3em] text-brand-700 dark:text-brand-300">{info.codigo}</span>
                  <button type="button" title="Copiar"
                          onClick={() => { navigator.clipboard?.writeText(info.codigo); toast.success('Código copiado'); }}
                          className="btn-ghost p-1"><Copy className="h-4 w-4" /></button>
                </div>
                <p className="mt-1 text-[11px] text-zinc-400">Válido por {info.expira_min} min. Comunicáselo al usuario.</p>
              </div>

              <div>
                <label className="label">Ingresá el código</label>
                <input value={codigo} onChange={(e) => setCodigo(e.target.value)} maxLength={8} inputMode="numeric"
                       className="input mt-1 text-center font-mono tracking-[0.3em]" placeholder="------" />
              </div>
              <div>
                <label className="label">Nueva clave (opcional)</label>
                <input value={nuevaClave} onChange={(e) => setNuevaClave(e.target.value)} maxLength={20}
                       className="input mt-1" placeholder="Vacío = clave por defecto / documento de legajo" />
              </div>
            </>
          ) : (
            <p className="py-4 text-sm text-rose-600">No se pudo generar el código.</p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-zinc-200 px-6 py-4 dark:border-zinc-700">
          <button onClick={onClose} className="btn-outline" disabled={saving}>Cancelar</button>
          <button onClick={confirmar} className="btn-primary" disabled={saving || loading || !info}>
            <ShieldCheck className="h-4 w-4" /> {saving ? 'Aplicando…' : 'Verificar y reiniciar'}
          </button>
        </div>
      </div>
    </div>
  );
}
