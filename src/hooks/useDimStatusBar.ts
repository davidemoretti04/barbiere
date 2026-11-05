import { useEffect } from 'react';

/**
 * Barra di stato di iPhone (ora, batteria) mentre è aperto un foglio o una conferma.
 *
 * Safari su iOS colora l'area della barra di stato in base al colore in cima alla pagina e,
 * dopo la chiusura di uno sfondo scuro a tutto schermo, a volte resta grigia.
 * Qui: mentre un foglio è aperto il colore viene impostato esplicitamente (scurito, come lo sfondo);
 * alla chiusura dell'ultimo foglio si ripristinano i colori originali e si forza iOS a ricalcolarli.
 */
let openCount = 0;
const originals = new Map<HTMLMetaElement, string>();

const DIMMED_LIGHT = '#aaaaad'; // #f2f2f7 sotto un velo nero al 30%
const DIMMED_DARK = '#000000';

function themeMetas(): HTMLMetaElement[] {
  return [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')];
}

/** Fa ricalcolare a iOS il colore della barra di stato toccando la striscia fissa in cima. */
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

function opened() {
  if (openCount++ > 0) return;
  for (const m of themeMetas()) {
    originals.set(m, m.content);
    m.content = m.media.includes('dark') ? DIMMED_DARK : DIMMED_LIGHT;
  }
}

function closed() {
  openCount = Math.max(0, openCount - 1);
  if (openCount > 0) return;
  originals.forEach((content, m) => {
    m.content = content;
  });
  originals.clear();
  nudgeStatusBar();
  // secondo passaggio, quando l'animazione di chiusura è finita
  window.setTimeout(nudgeStatusBar, 350);
}

/** Da chiamare nei componenti che mostrano uno sfondo scuro a tutto schermo. */
export function useDimStatusBar(active = true) {
  useEffect(() => {
    if (!active) return;
    opened();
    return closed;
  }, [active]);
}
