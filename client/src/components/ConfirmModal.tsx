import { useEffect, useRef } from 'react';
import { AlertTriangle, HelpCircle, Trash2, X } from 'lucide-react';

export type ConfirmVariant = 'danger' | 'warning' | 'info';

export type ConfirmModalProps = {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  onConfirm: () => void;
  onCancel: () => void;
};

const VARIANT_STYLES: Record<ConfirmVariant, { icon: React.ReactNode; btn: string; iconBg: string }> = {
  danger: {
    icon: <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />,
    btn: 'bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white',
    iconBg: 'bg-red-100 dark:bg-red-900/30',
  },
  warning: {
    icon: <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />,
    btn: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500 text-white',
    iconBg: 'bg-amber-100 dark:bg-amber-900/30',
  },
  info: {
    icon: <HelpCircle className="h-5 w-5 text-brand-600 dark:text-brand-400" />,
    btn: 'btn-primary',
    iconBg: 'bg-brand-100 dark:bg-brand-900/30',
  },
};

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Aceptar',
  cancelLabel = 'Cancelar',
  variant = 'info',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const { icon, btn, iconBg } = VARIANT_STYLES[variant];

  // Foco inicial en Cancelar (más seguro por defecto)
  useEffect(() => {
    if (open) setTimeout(() => cancelRef.current?.focus(), 50);
  }, [open]);

  // Cerrar con Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Panel */}
      <div className="relative w-full max-w-md rounded-xl bg-white shadow-xl dark:bg-zinc-900 ring-1 ring-zinc-200 dark:ring-zinc-700">
        {/* Header */}
        <div className="flex items-start gap-4 px-6 pt-6 pb-4">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconBg}`}>
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            {title && (
              <h3
                id="confirm-title"
                className="text-base font-semibold text-zinc-900 dark:text-zinc-100"
              >
                {title}
              </h3>
            )}
            <p className={`text-sm text-zinc-600 dark:text-zinc-400 ${title ? 'mt-1' : ''}`}>
              {message}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="ml-2 shrink-0 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-zinc-200 dark:border-zinc-700 px-6 py-4">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="btn-ghost"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-offset-2 ${btn}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
