import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useFeedback } from './feedback-context';
import { useDimStatusBar } from '../hooks/useDimStatusBar';

const CLOSE_DISTANCE = 110; // px trascinati oltre i quali il foglio si chiude
const CLOSE_VELOCITY = 0.55; // px/ms: un colpo rapido verso il basso chiude anche se corto

/**
 * Bottom sheet in stile iOS. Il genitore lo monta/smonta.
 * Si chiude con: tasto in alto, tocco sullo sfondo, Esc, oppure trascinandolo verso il basso
 * (dalla maniglia/intestazione, o dal contenuto quando è già in cima).
 * I fogli con dati da salvare (dismissable = false) chiedono conferma prima di chiudersi col gesto.
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
  const bodyRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const { confirm } = useFeedback();
  useDimStatusBar();
  const closeRef = useRef(onClose);
  const confirmRef = useRef(confirm);
  useEffect(() => {
    closeRef.current = onClose;
    confirmRef.current = confirm;
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

  // ----- trascina giù per chiudere -----
  useEffect(() => {
    const sheet = ref.current;
    const body = bodyRef.current;
    const backdrop = backdropRef.current;
    if (!sheet || !body || !backdrop) return;

    let startY = 0;
    let startX = 0;
    let startT = 0;
    let lastY = 0;
    let lastT = 0;
    let mode: 'idle' | 'pending' | 'drag' | 'scroll' = 'idle';
    let fromHeader = false;

    const apply = (dy: number, animate: boolean) => {
      sheet.style.transition = animate ? 'transform 0.25s cubic-bezier(0.2, 0.9, 0.3, 1)' : 'none';
      backdrop.style.transition = animate ? 'background-color 0.25s' : 'none';
      sheet.style.transform = dy > 0 ? `translateY(${dy}px)` : '';
      const fade = Math.max(0, 1 - dy / Math.max(1, sheet.offsetHeight));
      backdrop.style.backgroundColor = dy > 0 ? `rgba(0, 0, 0, ${(0.3 * fade).toFixed(3)})` : '';
    };

    const finish = async (dy: number, velocity: number) => {
      const wantsClose = dy > CLOSE_DISTANCE || (velocity > CLOSE_VELOCITY && dy > 30);
      if (!wantsClose) return apply(0, true);
      if (!dismissable) {
        apply(0, true);
        const ok = await confirmRef.current({
          title: 'Chiudere senza salvare?',
          message: 'Le modifiche fatte in questa schermata andranno perse.',
          confirmLabel: 'Chiudi senza salvare',
          cancelLabel: 'Continua a modificare',
          destructive: true,
        });
        if (ok) closeRef.current();
        return;
      }
      sheet.style.transition = 'transform 0.2s ease-in';
      sheet.style.transform = 'translateY(100%)';
      backdrop.style.transition = 'background-color 0.2s';
      backdrop.style.backgroundColor = 'rgba(0, 0, 0, 0)';
      window.setTimeout(() => closeRef.current(), 190);
    };

    const begin = (x: number, y: number, target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      // non intercettare il trascinamento su campi di testo, cursori o righe a scorrimento
      if (el?.closest('input, textarea, select, .swipe-content, .recharts-wrapper')) {
        mode = 'idle';
        return;
      }
      fromHeader = !!el?.closest('.sheet-header, .sheet-grabber');
      startX = x;
      startY = lastY = y;
      startT = lastT = performance.now();
      mode = 'pending';
    };

    const move = (x: number, y: number): boolean => {
      if (mode === 'idle' || mode === 'scroll') return false;
      const dy = y - startY;
      const dx = x - startX;
      if (mode === 'pending') {
        if (Math.abs(dy) < 6 && Math.abs(dx) < 6) return false;
        const atTop = body.scrollTop <= 0;
        if (dy > 0 && Math.abs(dy) > Math.abs(dx) && (fromHeader || atTop)) mode = 'drag';
        else {
          mode = 'scroll';
          return false;
        }
      }
      lastY = y;
      lastT = performance.now();
      apply(Math.max(0, dy), false);
      return true;
    };

    const end = (y: number) => {
      if (mode === 'drag') {
        const dy = Math.max(0, y - startY);
        const dt = Math.max(1, lastT - startT);
        const recent = performance.now() - lastT < 80;
        void finish(dy, recent ? (lastY - startY) / dt : 0);
      }
      mode = 'idle';
    };

    // Touch (iPhone): listener non passivo per poter bloccare lo scroll mentre si trascina il foglio
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return void (mode = 'idle');
      begin(e.touches[0].clientX, e.touches[0].clientY, e.target);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (move(e.touches[0].clientX, e.touches[0].clientY) && e.cancelable) e.preventDefault();
    };
    const onTouchEnd = (e: TouchEvent) => end(e.changedTouches[0]?.clientY ?? lastY);
    const onTouchCancel = () => {
      if (mode === 'drag') apply(0, true);
      mode = 'idle';
    };

    // Mouse (computer): solo dalla maniglia/intestazione
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0 || !(e.target as HTMLElement).closest('.sheet-header, .sheet-grabber')) return;
      begin(e.clientX, e.clientY, e.target);
      const mm = (ev: MouseEvent) => {
        if (move(ev.clientX, ev.clientY)) ev.preventDefault();
      };
      const mu = (ev: MouseEvent) => {
        window.removeEventListener('mousemove', mm);
        window.removeEventListener('mouseup', mu);
        end(ev.clientY);
      };
      window.addEventListener('mousemove', mm);
      window.addEventListener('mouseup', mu);
    };

    sheet.addEventListener('touchstart', onTouchStart, { passive: true });
    sheet.addEventListener('touchmove', onTouchMove, { passive: false });
    sheet.addEventListener('touchend', onTouchEnd);
    sheet.addEventListener('touchcancel', onTouchCancel);
    sheet.addEventListener('mousedown', onMouseDown);
    return () => {
      sheet.removeEventListener('touchstart', onTouchStart);
      sheet.removeEventListener('touchmove', onTouchMove);
      sheet.removeEventListener('touchend', onTouchEnd);
      sheet.removeEventListener('touchcancel', onTouchCancel);
      sheet.removeEventListener('mousedown', onMouseDown);
    };
  }, [dismissable]);

  return createPortal(
    <div
      ref={backdropRef}
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
        <div className="sheet-body" ref={bodyRef}>
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
