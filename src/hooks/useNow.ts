import { useSyncExternalStore } from 'react';

/** Orologio condiviso aggiornato ogni 30 secondi (e al ritorno in primo piano). */
let now = Date.now();
const listeners = new Set<() => void>();
let timer: number | undefined;

const tick = () => {
  now = Date.now();
  listeners.forEach((l) => l());
};

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (timer === undefined) {
    now = Date.now();
    timer = window.setInterval(tick, 30_000);
    document.addEventListener('visibilitychange', tick);
  }
  return () => {
    listeners.delete(cb);
    if (!listeners.size && timer !== undefined) {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
      timer = undefined;
    }
  };
}

export const useNow = (): number => useSyncExternalStore(subscribe, () => now, () => now);
