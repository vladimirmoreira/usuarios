import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { _registerErrorModal } from '../lib/notify';

/** Host global del modal de error (estilo ventana). Montar una vez en main.tsx. */
export default function ErrorModalHost() {
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => { _registerErrorModal((m) => setMsg(m)); }, []);

  useEffect(() => {
    if (!msg) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' || e.key === 'Enter') setMsg(null); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [msg]);

  if (!msg) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="alertdialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMsg(null)} />
      <div className="relative w-full max-w-md rounded-xl bg-white shadow-xl dark:bg-zinc-900 ring-1 ring-zinc-200 dark:ring-zinc-700">
        <div className="flex items-start gap-4 px-6 pt-6 pb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Error</h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-line">{msg}</p>
          </div>
          <button onClick={() => setMsg(null)}
                  className="ml-2 shrink-0 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex justify-end gap-2 border-t border-zinc-200 dark:border-zinc-700 px-6 py-4">
          <button onClick={() => setMsg(null)} className="btn-primary">Entendido</button>
        </div>
      </div>
    </div>
  );
}
