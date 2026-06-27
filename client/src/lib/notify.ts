// Wrapper drop-in de `toast`: los errores se muestran como MODAL (estilo ventana),
// el resto (success/loading/info) sigue como toast de react-hot-toast.
// Uso: reemplazar `import toast from 'react-hot-toast'` por `import toast from '.../lib/notify'`.
import { toast as rht } from 'react-hot-toast';

type Listener = (msg: string) => void;
let listener: Listener | null = null;

/** Lo registra <ErrorModalHost/> al montarse. */
export function _registerErrorModal(fn: Listener) { listener = fn; }

function toText(msg: unknown): string {
  if (typeof msg === 'string') return msg;
  if (msg && typeof msg === 'object' && 'message' in msg) return String((msg as any).message);
  return String(msg ?? 'Ocurrió un error');
}

function showError(msg: unknown): string {
  const text = toText(msg);
  if (listener) listener(text);
  else rht.error(text);           // fallback si el host aún no montó
  return '';
}

const toast = Object.assign(
  (msg: any, opts?: any) => rht(msg, opts),
  {
    success: (msg: any, opts?: any) => rht.success(msg, opts),
    error:   (msg: any) => showError(msg),
    loading: (msg: any, opts?: any) => rht.loading(msg, opts),
    dismiss: (id?: string) => rht.dismiss(id),
    custom:  (...a: any[]) => (rht.custom as any)(...a),
    promise: (...a: any[]) => (rht.promise as any)(...a),
  },
);

export default toast;
