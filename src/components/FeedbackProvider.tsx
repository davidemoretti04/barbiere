import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { FeedbackContext, type ChooseOptions, type ToastOptions } from './feedback-context';
import { useDimStatusBar } from '../hooks/useDimStatusBar';

interface PendingChoice extends ChooseOptions {
  resolve: (v: number | null) => void;
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<(ToastOptions & { key: number }) | null>(null);
  const [pending, setPending] = useState<PendingChoice | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useDimStatusBar(pending !== null);

  const showToast = useCallback((o: ToastOptions | string) => {
    const opts = typeof o === 'string' ? { message: o } : o;
    window.clearTimeout(timer.current);
    setToast({ ...opts, key: Date.now() });
    timer.current = window.setTimeout(() => setToast(null), opts.duration ?? (opts.actionLabel ? 6000 : 3000));
  }, []);

  const choose = useCallback(
    (o: ChooseOptions) =>
      new Promise<number | null>((resolve) => {
        setPending({ ...o, resolve });
      }),
    [],
  );
  const confirm = useCallback(
    async (o: { title?: string; message?: string; confirmLabel: string; cancelLabel?: string; destructive?: boolean }) =>
      (await choose({ title: o.title, message: o.message, cancelLabel: o.cancelLabel, options: [{ label: o.confirmLabel, destructive: o.destructive }] })) === 0,
    [choose],
  );

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const value = useMemo(() => ({ toast: showToast, confirm, choose }), [showToast, confirm, choose]);

  const answer = (v: number | null) => {
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
            onClick={(e) => e.target === e.currentTarget && answer(null)}
            onKeyDown={(e) => e.key === 'Escape' && answer(null)}
          >
            <div className="action-sheet" role="alertdialog" aria-modal="true" aria-label={pending.title ?? pending.options[0]?.label}>
              <div className="group">
                {(pending.title || pending.message) && (
                  <div className="msg">
                    {pending.title && <strong>{pending.title}</strong>}
                    {pending.message}
                  </div>
                )}
                {pending.options.map((o, i) => (
                  <button
                    key={o.label}
                    type="button"
                    autoFocus={i === 0}
                    className={o.destructive ? 'destructive' : ''}
                    onClick={() => answer(i)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              <button type="button" className="cancel" onClick={() => answer(null)}>
                {pending.cancelLabel ?? 'Annulla'}
              </button>
            </div>
          </div>,
          document.body,
        )}
    </FeedbackContext.Provider>
  );
}
