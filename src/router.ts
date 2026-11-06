import { useSyncExternalStore } from 'react';

/**
 * Router minimo basato sull'hash (#/agenda, #/clienti/123…): funziona su GitHub Pages
 * senza configurazioni lato server e anche offline.
 *
 * La navigazione «indietro» è gestita da una pila interna all'app e non dalla cronologia del browser:
 * così il gesto di iOS (scorrere dal bordo) non entra in conflitto con l'app, il tasto in alto a sinistra
 * mostra da dove si arriva («‹ Appuntamento», «‹ Statistiche»…) e al ritorno si può riaprire
 * la finestra da cui si era partiti.
 */
function getPath(): string {
  const h = window.location.hash.replace(/^#/, '');
  return h.startsWith('/') ? h : '/home';
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

export function usePath(): string {
  return useSyncExternalStore(subscribe, getPath, () => '/home');
}

interface BackEntry {
  path: string;
  label: string;
  /** Eseguito dopo essere tornati (es. riaprire l'appuntamento da cui si era partiti). */
  onReturn?: () => void;
}

const stack: BackEntry[] = [];
let returning = false;

/** Nome breve di una pagina, per il tasto «indietro». */
export function labelForPath(path: string): string {
  const p = path.split('?')[0];
  if (p.startsWith('/clienti/')) return 'Cliente';
  if (p.startsWith('/clienti')) return 'Clienti';
  if (p.startsWith('/agenda')) return 'Agenda';
  if (p.startsWith('/statistiche')) return 'Statistiche';
  if (p.startsWith('/spese')) return 'Spese';
  if (p === '/altro/listino') return 'Listino';
  if (p === '/altro/impostazioni') return 'Impostazioni';
  if (p === '/altro/backup') return 'Backup';
  if (p.startsWith('/altro')) return 'Altro';
  return 'Home';
}

function go(path: string) {
  window.history.replaceState(null, '', '#' + path);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

export interface NavigateOptions {
  /** Cambio di sezione (barra in basso) o reindirizzamento: azzera la pila «indietro». */
  replace?: boolean;
  /** Etichetta del tasto indietro nella pagina di arrivo (default: nome della pagina di partenza). */
  backLabel?: string;
  /** Da eseguire quando si torna indietro (es. riaprire una finestra). */
  onReturn?: () => void;
}

const ROOTS = ['/home', '/agenda', '/clienti', '/statistiche', '/spese', '/altro'];
/** Pagine principali (una per scheda della barra in basso): non hanno tasto indietro. */
export const isRootPath = (path: string) => ROOTS.includes(path.split('?')[0]);

export function navigate(path: string, opts: NavigateOptions = {}) {
  const from = getPath();
  if (from === path) return;
  returning = false;
  if (opts.replace || isRootPath(path)) stack.length = 0;
  else {
    stack.push({ path: from, label: opts.backLabel ?? labelForPath(from), onReturn: opts.onReturn });
    if (stack.length > 30) stack.shift();
  }
  go(path);
}

/** Torna alla pagina precedente dell'app (riaprendo ciò che serve), altrimenti va a `fallback`. */
export function goBack(fallback: string) {
  const entry = stack.pop();
  returning = true;
  go(entry?.path ?? fallback);
  if (entry?.onReturn) window.setTimeout(entry.onReturn, 0);
}

/** Etichetta del tasto indietro per la pagina attuale, se si è arrivati da un'altra pagina dell'app. */
export function backLabel(): string | undefined {
  return stack[stack.length - 1]?.label;
}

/** true se la pagina attuale è stata raggiunta tornando indietro (per ripristinare finestre aperte). */
export function isReturning(): boolean {
  return returning;
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
