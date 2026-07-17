import { useEffect, useState } from 'react';
import { X, KeyRound, Copy, Loader2, ShieldCheck, Clock } from 'lucide-react';
import toast from '../../lib/notify';
import { UsuariosAPI } from '../../api/endpoints';

/**
 * Reset de clave por PORTAL de auto-servicio.
 * RR.HH. genera un verificador de 15 caracteres (válido 1 h, un solo uso) y se
 * lo pasa al usuario por cualquier medio (WhatsApp/correo). El usuario completa
 * el reset desde el portal público (/recuperar), donde el sistema le asigna una
 * clave nueva de 7 dígitos.
 */
export default function ResetClaveModal({ iduser, onClose }: { iduser: string; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [verificador, setVerificador] = useState('');
  const [expiraMin, setExpiraMin] = useState(60);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    UsuariosAPI.resetClavePortal(iduser)
      .then((r) => { if (active) { setVerificador(r.verificador); setExpiraMin(r.expira_min); } })
      .catch((e: any) => { if (active) setError(e?.response?.data?.error || 'No se pudo generar el verificador'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [iduser]);

  const copiar = () => {
    navigator.clipboard?.writeText(verificador);
    toast.success('Verificador copiado');
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
              <Loader2 className="h-4 w-4 animate-spin" /> Generando verificador…
            </div>
          ) : error ? (
            <p className="py-4 text-sm text-rose-600">{error}</p>
          ) : (
            <>
              <div className="rounded-lg border border-brand-200 bg-brand-50 p-3 text-center dark:border-brand-900 dark:bg-brand-900/20">
                <p className="text-xs text-zinc-500">Código verificador (para el usuario)</p>
                <div className="mt-1 flex items-center justify-center gap-2">
                  <span className="select-all break-all font-mono text-lg font-bold tracking-wider text-brand-700 dark:text-brand-300">{verificador}</span>
                  <button type="button" title="Copiar" onClick={copiar} className="btn-ghost shrink-0 p-1"><Copy className="h-4 w-4" /></button>
                </div>
                <p className="mt-1 flex items-center justify-center gap-1 text-[11px] text-zinc-400">
                  <Clock className="h-3 w-3" /> Válido por {expiraMin} min · un solo uso · 2 intentos
                </p>
              </div>

              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-300">
                <p className="mb-1 flex items-center gap-1 font-semibold text-zinc-700 dark:text-zinc-200">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Pasos para el usuario
                </p>
                <ol className="ml-4 list-decimal space-y-0.5">
                  <li>Pasale este código por WhatsApp o correo.</li>
                  <li>Debe abrir el portal <span className="font-mono">/recuperar</span> (red local).</li>
                  <li>Ingresa su usuario <span className="font-mono font-semibold">{iduser}</span> + el código.</li>
                  <li>Al confirmar, el sistema le muestra su nueva clave de 7 dígitos.</li>
                </ol>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-zinc-200 px-6 py-4 dark:border-zinc-700">
          <button onClick={onClose} className="btn-primary">Listo</button>
        </div>
      </div>
    </div>
  );
}
