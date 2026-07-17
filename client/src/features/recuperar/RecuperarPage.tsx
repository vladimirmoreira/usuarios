import { useEffect, useState } from 'react';
import { KeyRound, Copy, Loader2, CheckCircle2, ArrowRight, ArrowLeft, ShieldCheck } from 'lucide-react';
import { PublicoAPI } from '../../api/endpoints';

/** Segundos que la nueva clave permanece visible antes de auto-reiniciar el portal. */
const HOLD_SECONDS = 10;

type Paso = 'iduser' | 'clave' | 'listo';

/**
 * Portal público de auto-reset de clave (sin login). Solo responde desde la red local.
 * Flujo en dos pasos:
 *   1) iduser  → el sistema confirma que hay un reseteo pendiente para ese usuario.
 *   2) verificador (clave que dio RR.HH.) → 2 intentos. Al acertar, genera y muestra
 *      la nueva clave de 7 dígitos por 15 s; luego el portal se reinicia solo.
 */
export default function RecuperarPage() {
  const [paso, setPaso] = useState<Paso>('iduser');
  const [iduser, setIduser] = useState('');
  const [verificador, setVerificador] = useState('');
  const [nombre, setNombre] = useState<string | null>(null);
  const [nuevaClave, setNuevaClave] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [secs, setSecs] = useState(HOLD_SECONDS);

  // Cuenta regresiva tras el reset: al llegar a 0 recarga el portal (limpia todo).
  useEffect(() => {
    if (paso !== 'listo') return;
    setSecs(HOLD_SECONDS);
    const id = setInterval(() => {
      setSecs((s) => {
        if (s <= 1) { clearInterval(id); window.location.reload(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [paso]);

  const volverAInicio = () => {
    setPaso('iduser');
    setVerificador('');
    setNombre(null);
    setError('');
  };

  // Paso 1: iduser → ¿hay solicitud pendiente?
  const verificarUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!iduser.trim()) { setError('Ingresá tu usuario.'); return; }
    setBusy(true);
    try {
      const r = await PublicoAPI.existe(iduser.trim());
      setNombre(r.nombre);
      setError('');
      setPaso('clave');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'No se pudo verificar el usuario.');
    } finally { setBusy(false); }
  };

  // Paso 2: verificador → aplica el reset (2 intentos, controlados en el backend).
  const aplicar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!verificador.trim()) { setError('Ingresá el código verificador.'); return; }
    setBusy(true);
    try {
      const r = await PublicoAPI.aplicar(iduser.trim(), verificador.trim());
      setNuevaClave(r.nuevaClave);
      setPaso('listo');
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'No se pudo resetear la clave.';
      const status = err?.response?.status;
      setError(msg);
      setVerificador('');
      // Si se bloqueó/venció/desapareció la solicitud, volver al paso 1.
      if (status === 429 || status === 404 || /bloquead|venci/i.test(msg)) {
        setPaso('iduser');
        setNombre(null);
      }
    } finally { setBusy(false); }
  };

  const copiar = () => { navigator.clipboard?.writeText(nuevaClave); };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-100 p-4 dark:bg-zinc-950">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        <div className="mb-5 flex items-center gap-2">
          <div className="rounded-lg bg-brand-100 p-2 dark:bg-brand-900/40">
            <KeyRound className="h-5 w-5 text-brand-600 dark:text-brand-300" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">Recuperar contraseña</h1>
            <p className="text-xs text-zinc-500">Portal interno de restablecimiento</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-900/20 dark:text-rose-300">
            {error}
          </div>
        )}

        {paso === 'iduser' && (
          <form onSubmit={verificarUsuario} className="space-y-3">
            <div>
              <label className="label">Usuario</label>
              <input value={iduser} onChange={(e) => setIduser(e.target.value)} maxLength={10} autoFocus
                     className="input mt-1" placeholder="Tu iduser" autoComplete="off" />
              <p className="mt-1 text-[11px] text-zinc-400">Debe tener un reseteo pendiente generado por RR.HH.</p>
            </div>
            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {busy ? 'Verificando…' : 'Continuar'}
            </button>
          </form>
        )}

        {paso === 'clave' && (
          <form onSubmit={aplicar} className="space-y-3">
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-700 dark:bg-zinc-800/40">
              <p className="text-zinc-600 dark:text-zinc-300">Restablecer contraseña de:</p>
              <p className="mt-0.5 font-semibold text-zinc-800 dark:text-zinc-100">
                {nombre || iduser} <span className="font-mono text-xs text-zinc-500">({iduser})</span>
              </p>
            </div>
            <div>
              <label className="label">Código verificador</label>
              <input value={verificador} onChange={(e) => setVerificador(e.target.value)} maxLength={20} autoFocus
                     className="input mt-1 font-mono" placeholder="El código que te pasó RR.HH." autoComplete="off" />
              <p className="mt-1 text-[11px] text-zinc-400">15 caracteres · 2 intentos.</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={volverAInicio} className="btn-outline flex-1" disabled={busy}>
                <ArrowLeft className="h-4 w-4" /> Volver
              </button>
              <button type="submit" className="btn-primary flex-1" disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                {busy ? 'Aplicando…' : 'Resetear contraseña'}
              </button>
            </div>
          </form>
        )}

        {paso === 'listo' && (
          <div className="space-y-4 text-center">
            <div className="flex flex-col items-center gap-1">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">¡Clave restablecida!</p>
            </div>
            <div className="rounded-lg border border-brand-200 bg-brand-50 p-4 dark:border-brand-900 dark:bg-brand-900/20">
              <p className="text-xs text-zinc-500">Tu nueva contraseña</p>
              <div className="mt-1 flex items-center justify-center gap-2">
                <span className="select-all font-mono text-3xl font-bold tracking-[0.3em] text-brand-700 dark:text-brand-300">{nuevaClave}</span>
                <button type="button" title="Copiar" onClick={copiar} className="btn-ghost p-1"><Copy className="h-4 w-4" /></button>
              </div>
            </div>
            <p className="text-xs text-zinc-500">
              Anotala ahora: se ocultará en <span className="font-semibold text-zinc-700 dark:text-zinc-200">{secs}s</span> y el portal se reiniciará.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
