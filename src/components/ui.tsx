import { useEffect, useRef, useState, type ReactNode } from 'react';
import { backLabel, goBack } from '../router';
import { IconChevronLeft, RowChevron } from './Icons';

export function Page({
  title,
  left,
  right,
  children,
  largeTitle = true,
  swipeBackFallback,
}: {
  title: string;
  left?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  largeTitle?: boolean;
  /** Pagine con tasto indietro: scorrendo dal bordo sinistro verso destra si torna indietro. */
  swipeBackFallback?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);

  // gesto «indietro» in stile iOS: la pagina segue il dito partendo dal bordo sinistro
  useEffect(() => {
    const el = ref.current;
    if (!el || !swipeBackFallback) return;
    const EDGE = 28;
    let startX = 0;
    let startY = 0;
    let startT = 0;
    let mode: 'idle' | 'pending' | 'drag' = 'idle';
    const set = (dx: number, animate: boolean) => {
      el.style.transition = animate ? 'transform 0.22s cubic-bezier(0.2, 0.9, 0.3, 1)' : 'none';
      el.style.transform = dx > 0 ? `translateX(${dx}px)` : '';
      el.style.boxShadow = dx > 0 ? '-8px 0 24px rgba(0,0,0,0.12)' : '';
    };
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (e.touches.length !== 1 || t.clientX > EDGE || document.documentElement.classList.contains('sheet-open')) {
        mode = 'idle';
        return;
      }
      startX = t.clientX;
      startY = t.clientY;
      startT = performance.now();
      mode = 'pending';
    };
    const onMove = (e: TouchEvent) => {
      if (mode === 'idle') return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (mode === 'pending') {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        if (dx > 0 && dx > Math.abs(dy)) mode = 'drag';
        else {
          mode = 'idle';
          return;
        }
      }
      if (e.cancelable) e.preventDefault();
      set(Math.max(0, dx), false);
    };
    const onEnd = (e: TouchEvent) => {
      if (mode !== 'drag') {
        mode = 'idle';
        return;
      }
      mode = 'idle';
      const dx = (e.changedTouches[0]?.clientX ?? startX) - startX;
      const fast = dx / Math.max(1, performance.now() - startT) > 0.5;
      if (dx > el.offsetWidth * 0.33 || (fast && dx > 40)) {
        set(el.offsetWidth, true);
        window.setTimeout(() => goBack(swipeBackFallback), 200);
      } else set(0, true);
    };
    const onCancel = () => {
      if (mode === 'drag') set(0, true);
      mode = 'idle';
    };
    el.addEventListener('touchstart', onStart, { passive: true, capture: true });
    el.addEventListener('touchmove', onMove, { passive: false, capture: true });
    el.addEventListener('touchend', onEnd, { capture: true });
    el.addEventListener('touchcancel', onCancel, { capture: true });
    return () => {
      el.removeEventListener('touchstart', onStart, { capture: true });
      el.removeEventListener('touchmove', onMove, { capture: true });
      el.removeEventListener('touchend', onEnd, { capture: true });
      el.removeEventListener('touchcancel', onCancel, { capture: true });
    };
  }, [swipeBackFallback]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => setCollapsed(el.scrollTop > 34);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <div className="page" ref={ref}>
      <header className={`navbar ${collapsed ? 'collapsed' : ''} ${largeTitle ? '' : 'solid'}`}>
        <div className="navbar-inner">
          <div className="navbar-left">{left}</div>
          <div className="navbar-title" aria-hidden={largeTitle && !collapsed}>
            {title}
          </div>
          <div className="navbar-right">{right}</div>
        </div>
      </header>
      {largeTitle && <h1 className="large-title">{title}</h1>}
      {!largeTitle && <h1 className="sr-only">{title}</h1>}
      {children}
    </div>
  );
}

/** Tasto «indietro»: mostra da dove si è arrivati (es. «Appuntamento»), altrimenti `label`. */
export function BackButton({ label, fallback }: { label: string; fallback: string }) {
  const text = backLabel() ?? label;
  return (
    <button className="nav-btn" onClick={() => goBack(fallback)} aria-label={`Indietro: ${text}`}>
      <IconChevronLeft />
      {text}
    </button>
  );
}

export function Section({
  header,
  footer,
  children,
  plain,
  group = true,
  headerRight,
}: {
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  plain?: boolean;
  group?: boolean;
  headerRight?: ReactNode;
}) {
  return (
    <section className="section">
      {(header || headerRight) && (
        <h2 className={`section-header ${plain ? 'plain' : ''}`} style={{ margin: 0, fontWeight: plain ? 700 : 400 }}>
          <span>{header}</span>
          {headerRight}
        </h2>
      )}
      {group ? <div className="group">{children}</div> : children}
      {footer && <div className="section-footer">{footer}</div>}
    </section>
  );
}

interface RowProps {
  title: ReactNode;
  sub?: ReactNode;
  detail?: ReactNode;
  chevron?: boolean;
  onClick?: () => void;
  href?: string;
  icon?: ReactNode;
  iconBg?: string;
  leading?: ReactNode;
  className?: string;
  ariaLabel?: string;
}

export function Row({ title, sub, detail, chevron, onClick, href, icon, iconBg, leading, className = '', ariaLabel }: RowProps) {
  const inner = (
    <>
      {icon && (
        <span className="row-icon" style={{ background: iconBg ?? 'var(--accent)' }}>
          {icon}
        </span>
      )}
      {leading}
      <span className="row-main">
        <span className="row-title" style={{ display: 'block' }}>
          {title}
        </span>
        {sub && (
          <span className="row-sub" style={{ display: 'block' }}>
            {sub}
          </span>
        )}
      </span>
      {detail !== undefined && <span className="row-detail">{detail}</span>}
      {chevron && <RowChevron />}
    </>
  );
  const cls = `row ${icon ? 'with-icon' : ''} ${className}`;
  if (href)
    return (
      <a className={cls} href={href} aria-label={ariaLabel} style={{ color: 'inherit' }}>
        {inner}
      </a>
    );
  if (onClick)
    return (
      <button type="button" className={cls} onClick={onClick} aria-label={ariaLabel}>
        {inner}
      </button>
    );
  return <div className={cls}>{inner}</div>;
}

export function Field({ label, children, stack }: { label: string; children: ReactNode; stack?: boolean }) {
  return (
    <label className={`field ${stack ? 'stack' : ''}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className = '',
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  className?: string;
  label: string;
}) {
  return (
    <div className={`segmented ${className}`} role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <span className="switch">
      <input type="checkbox" role="switch" checked={checked} aria-label={label} onChange={(e) => onChange(e.target.checked)} />
      <span />
    </span>
  );
}

/**
 * Riga con interruttore in stile Impostazioni di iPhone: si tocca tutta la riga (scritta compresa),
 * non solo il piccolo interruttore.
 */
export function SwitchRow({
  title,
  detail,
  icon,
  checked,
  onChange,
  ariaLabel,
}: {
  title: ReactNode;
  detail?: ReactNode;
  icon?: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  ariaLabel?: string;
}) {
  return (
    <label className="field switch-row">
      {icon}
      <span className="switch-row-title">{title}</span>
      {detail !== undefined && <span className="muted small">{detail}</span>}
      <span className="switch">
        <input type="checkbox" role="switch" checked={checked} aria-label={ariaLabel} onChange={(e) => onChange(e.target.checked)} />
        <span />
      </span>
    </label>
  );
}

export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon?: ReactNode;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      {icon}
      <h2>{title}</h2>
      <p>{text}</p>
      {action}
    </div>
  );
}
