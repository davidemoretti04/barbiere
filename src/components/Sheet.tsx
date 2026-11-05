import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Bottom sheet in stile iOS. Il genitore lo monta/smonta; tocco sullo sfondo o Esc per chiudere.
 */
export function Sheet({
  title,
  onClose,
  left,
  right,
  children,
  tall,
  dismissable = true,
}: {
  title: string;
  onClose: () => void;
  left?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  tall?: boolean;
  dismissable?: boolean;
}) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissable) {
        e.stopPropagation();
        closeRef.current();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus?.({ preventScroll: true });
    };
  }, [dismissable]);

  return createPortal(
    <div
      className="sheet-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && dismissable) onClose();
      }}
    >
      <div
        ref={ref}
        className={`sheet ${tall ? 'tall' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        tabIndex={-1}
        style={{ outline: 'none' }}
      >
        <div className="sheet-grabber" aria-hidden="true" />
        <div className="sheet-header">
          <div>
            {left ?? (
              <button type="button" className="nav-btn" onClick={onClose}>
                Chiudi
              </button>
            )}
          </div>
          <div className="title" id={id}>
            {title}
          </div>
          <div>{right}</div>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
