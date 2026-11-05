import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { FeedbackContext, type ConfirmOptions, type ToastOptions } from './feedback-context';

interface PendingConfirm extends ConfirmOptions {
  resolve: (v: boolean) => void;
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<(ToastOptions & { key: number }) | null>(null);
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const showToast = useCallback((o: ToastOptions | string) => {
    const opts = typeof o === 'string' ? { message: o } : o;
    window.clearTimeout(timer.current);
    setToast({ ...opts, key: Date.now() });
    timer.current = window.setTimeout(() => setToast(null), opts.duration ?? (opts.actionLabel ? 6000 : 3000));
  }, []);

  const confirm = useCallback(
    (o: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setPending({ ...o, resolve });
      }),
    [],
  );

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const value = useMemo(() => ({ toast: showToast, confirm }), [showToast, confirm]);

  const answer = (v: boolean) => {
    pending?.resolve(v);
    setPending(null);
  };

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      {toast &&
        createPortal(
          <div className="toast" role="status" aria-live="polite" key={toast.key}>
            <span>{toast.message}</span>
            {toast.actionLabel && (
              <button
                type="button"
                onClick={() => {
                  toast.onAction?.();
                  setToast(null);
                }}
              >
                {toast.actionLabel}
              </button>
            )}
          </div>,
          document.body,
        )}
      {pending &&
        createPortal(
          <div
            className="sheet-backdrop"
            style={{ zIndex: 90 }}
            onClick={(e) => e.target === e.currentTarget && answer(false)}
            onKeyDown={(e) => e.key === 'Escape' && answer(false)}
          >
            <div className="action-sheet" role="alertdialog" aria-modal="true" aria-label={pending.title ?? pending.confirmLabel}>
              <div className="group">
                {(pending.title || pending.message) && (
                  <div className="msg">
                    {pending.title && <strong>{pending.title}</strong>}
                    {pending.message}
                  </div>
                )}
                <button
                  type="button"
                  autoFocus
                  className={pending.destructive ? 'destructive' : ''}
                  onClick={() => answer(true)}
                >
                  {pending.confirmLabel}
                </button>
              </div>
              <button type="button" className="cancel" onClick={() => answer(false)}>
                {pending.cancelLabel ?? 'Annulla'}
              </button>
            </div>
          </div>,
          document.body,
        )}
    </FeedbackContext.Provider>
  );
}
