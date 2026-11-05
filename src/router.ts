import { useSyncExternalStore } from 'react';

/**
 * Router minimo basato sull'hash (#/agenda, #/clienti/123…): funziona su GitHub Pages
 * senza configurazioni lato server e anche offline.
 */
function getPath(): string {
  const h = window.location.hash.replace(/^#/, '');
  return h.startsWith('/') ? h : '/agenda';
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

export function usePath(): string {
  return useSyncExternalStore(subscribe, getPath, () => '/agenda');
}

export function navigate(path: string, opts: { replace?: boolean } = {}) {
  if (getPath() === path) return;
  const url = '#' + path;
  if (opts.replace) window.history.replaceState(window.history.state, '', url);
  else window.history.pushState({ inApp: true }, '', url);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

/** Torna indietro se si è arrivati da una pagina dell'app, altrimenti va a `fallback`. */
export function goBack(fallback: string) {
  const state = window.history.state as { inApp?: boolean } | null;
  if (state?.inApp) window.history.back();
  else navigate(fallback, { replace: true });
}

/** Confronta un percorso con un modello tipo "/clienti/:id". */
export function matchPath(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split('/').filter(Boolean);
  const a = path.split('?')[0].split('/').filter(Boolean);
  if (p.length !== a.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(a[i]);
    else if (p[i] !== a[i]) return null;
  }
  return params;
}
