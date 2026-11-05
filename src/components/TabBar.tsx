import type { ReactNode } from 'react';
import { navigate } from '../router';
import { IconCalendar, IconChart, IconMore, IconPeople } from './Icons';

const TABS: { root: string; label: string; icon: ReactNode }[] = [
  { root: '/agenda', label: 'Agenda', icon: <IconCalendar /> },
  { root: '/clienti', label: 'Clienti', icon: <IconPeople /> },
  { root: '/statistiche', label: 'Statistiche', icon: <IconChart /> },
  { root: '/altro', label: 'Altro', icon: <IconMore /> },
];

export function TabBar({ path }: { path: string }) {
  return (
    <nav className="tabbar" aria-label="Sezioni">
      {TABS.map((t) => {
        const active = path === t.root || path.startsWith(t.root + '/');
        return (
          <a
            key={t.root}
            href={`#${t.root}`}
            aria-current={active ? 'page' : undefined}
            onClick={(e) => {
              e.preventDefault();
              navigate(t.root, { replace: true });
            }}
          >
            {t.icon}
            {t.label}
          </a>
        );
      })}
    </nav>
  );
}
