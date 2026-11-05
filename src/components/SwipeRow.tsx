import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

export interface SwipeAction {
  label: string;
  color: 'red' | 'orange' | 'gray' | 'blue';
  onClick: () => void;
}

const ACTION_W = 84;
const OPEN_EVENT = 'swiperow-open';

/**
 * Riga con azioni rivelate dallo scorrimento verso sinistra (come in Mail/Messaggi).
 * Le stesse azioni sono sempre disponibili anche nelle schermate di dettaglio.
 */
export function SwipeRow({ actions, children }: { actions: SwipeAction[]; children: ReactNode }) {
  const id = useId();
  const width = actions.length * ACTION_W;
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const g = useRef({ x: 0, y: 0, base: 0, mode: 'idle' as 'idle' | 'pending' | 'h' | 'v', moved: false, pointer: -1 });
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onOpen = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== id) setOffset(0);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, [id]);

  const open = offset !== 0;

  return (
    <div className="swipe-row" style={{ overflow: 'hidden' }}>
      <div className="swipe-actions" aria-hidden={!open}>
        {actions.map((a) => (
          <button
            key={a.label}
            type="button"
            className={a.color}
            tabIndex={open ? 0 : -1}
            onClick={() => {
              setOffset(0);
              a.onClick();
            }}
          >
            {a.label}
          </button>
        ))}
      </div>
      <div
        ref={contentRef}
        className={`swipe-content ${dragging ? 'dragging' : ''}`}
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={(e) => {
          if (e.pointerType === 'mouse' && e.button !== 0) return;
          g.current = { x: e.clientX, y: e.clientY, base: offset, mode: 'pending', moved: false, pointer: e.pointerId };
        }}
        onPointerMove={(e) => {
          const s = g.current;
          if (s.mode === 'idle' || s.mode === 'v' || e.pointerId !== s.pointer) return;
          const dx = e.clientX - s.x;
          const dy = e.clientY - s.y;
          if (s.mode === 'pending') {
            if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.2) {
              s.mode = 'h';
              s.moved = true;
              setDragging(true);
              try {
                contentRef.current?.setPointerCapture(e.pointerId);
              } catch {
                // puntatore già rilasciato: si continua senza cattura
              }
            } else if (Math.abs(dy) > 8) {
              s.mode = 'v';
              return;
            } else return;
          }
          const next = Math.min(0, Math.max(-width - 30, s.base + dx));
          setOffset(next);
        }}
        onPointerUp={() => {
          const s = g.current;
          if (s.mode === 'h') {
            setDragging(false);
            setOffset((o) => {
              const shouldOpen = o < -width / 2.5;
              if (shouldOpen) window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: id }));
              return shouldOpen ? -width : 0;
            });
          }
          s.mode = 'idle';
        }}
        onPointerCancel={() => {
          if (g.current.mode === 'h') {
            setDragging(false);
            setOffset(g.current.base);
          }
          g.current.mode = 'idle';
        }}
        onClickCapture={(e) => {
          // dopo uno scorrimento, o se la riga è aperta, il tocco richiude senza aprire il dettaglio
          if (g.current.moved || open) {
            e.preventDefault();
            e.stopPropagation();
            g.current.moved = false;
            if (open) setOffset(0);
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}
