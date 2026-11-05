import { useState } from 'react';
import { db } from '../db/db';
import { removeSampleData } from '../lib/firstRun';
import { navigate } from '../router';
import { useFeedback } from './feedback-context';
import { IconX } from './Icons';

const HIDE_KEY = 'barbiere-banner-esempi-nascosto';

/**
 * Avviso: l'app contiene dati di esempio. Guida a cancellarli (solo quelli finti) e,
 * se non resta nulla, porta alla configurazione guidata. La ✕ lo nasconde fino alla prossima apertura.
 */
export function SampleBanner() {
  const { confirm, toast } = useFeedback();
  const [hidden, setHidden] = useState(() => sessionStorage.getItem(HIDE_KEY) === '1');
  if (hidden) return null;

  async function clear() {
    const ok = await confirm({
      title: 'Cancellare i dati di esempio?',
      message:
        'Clienti, appuntamenti, listino e spese inventati verranno eliminati. I dati che hai inserito tu restano. Poi potrai impostare orari e listino veri.',
      confirmLabel: 'Cancella dati di esempio',
      cancelLabel: 'Non ora',
      destructive: true,
    });
    if (!ok) return;
    const toSetup = await removeSampleData(db);
    if (!toSetup) {
      navigate('/home', { replace: true });
      toast('Dati di esempio cancellati');
    }
  }

  return (
    <div className="banner sample-banner" role="status">
      <span className="sample-emoji" aria-hidden="true">
        🧪
      </span>
      <span className="grow">
        <b>Stai usando dati di esempio.</b> Clienti e appuntamenti sono inventati, per provare l’app.
      </span>
      <button type="button" onClick={() => void clear()}>
        Cancella
      </button>
      <button
        type="button"
        className="banner-close"
        aria-label="Nascondi l’avviso dei dati di esempio"
        onClick={() => {
          sessionStorage.setItem(HIDE_KEY, '1');
          setHidden(true);
        }}
      >
        <IconX />
      </button>
    </div>
  );
}

