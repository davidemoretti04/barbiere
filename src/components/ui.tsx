import { useEffect, useRef, useState, type ReactNode } from 'react';
import { goBack } from '../router';
import { IconChevronLeft, RowChevron } from './Icons';

export function Page({
  title,
  left,
  right,
  children,
  largeTitle = true,
}: {
  title: string;
  left?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  largeTitle?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);
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

export function BackButton({ label, fallback }: { label: string; fallback: string }) {
  return (
    <button className="nav-btn" onClick={() => goBack(fallback)} aria-label={`Indietro: ${label}`}>
      <IconChevronLeft />
      {label}
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
