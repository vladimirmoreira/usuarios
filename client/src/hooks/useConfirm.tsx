import { useState, useCallback, useRef } from 'react';
import ConfirmModal, { type ConfirmVariant } from '../components/ConfirmModal';

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
};

/**
 * Hook que devuelve una función `confirm` asíncrona y el componente <ConfirmDialog />
 * que debe renderizarse en el árbol JSX del componente que lo usa.
 *
 * Uso:
 *   const { confirm, ConfirmDialog } = useConfirm();
 *   // en el JSX: <ConfirmDialog />
 *   // al necesitar confirmar:
 *   if (!await confirm({ message: '¿Seguro?' })) return;
 */
export function useConfirm() {
  const [state, setState] = useState<(ConfirmOptions & { open: boolean }) | null>(null);
  const resolveRef = useRef<(val: boolean) => void>(() => {});

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setState({ ...opts, open: true });
    });
  }, []);

  const handleConfirm = () => {
    setState(null);
    resolveRef.current(true);
  };

  const handleCancel = () => {
    setState(null);
    resolveRef.current(false);
  };

  const ConfirmDialog = () =>
    state ? (
      <ConfirmModal
        open={state.open}
        title={state.title}
        message={state.message}
        confirmLabel={state.confirmLabel}
        cancelLabel={state.cancelLabel}
        variant={state.variant}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    ) : null;

  return { confirm, ConfirmDialog };
}
