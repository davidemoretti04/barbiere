import { useEffect } from 'react';

/**
 * Barra di stato di iPhone (ora, batteria) e fogli/conferme.
 *
 * iOS colora l'area della barra di stato in base agli elementi fissi in cima alla pagina e,
 * dopo la chiusura di un velo scuro, a volte la lasciava grigia. Ora il velo è un'ombra del foglio
 * (vedi global.css) e in cima resta sempre la striscia #statusbar-bg col colore della pagina.
 * Alla chiusura dell'ultimo foglio la striscia viene "toccata" per far ricalcolare il colore a iOS.
 */
let openCount = 0;

function nudgeStatusBar() {
  const cover = document.getElementById('statusbar-bg');
  if (!cover) return;
  cover.style.opacity = '0.99';
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      cover.style.opacity = '';
    }),
  );
}

/** Da chiamare nei componenti che mostrano un velo scuro (fogli e conferme). */
export function useDimStatusBar(active = true) {
  useEffect(() => {
    if (!active) return;
    openCount++;
    document.documentElement.classList.add('sheet-open');
    return () => {
      openCount = Math.max(0, openCount - 1);
      if (openCount > 0) return;
      document.documentElement.classList.remove('sheet-open');
      nudgeStatusBar();
      window.setTimeout(nudgeStatusBar, 350);
    };
  }, [active]);
}
