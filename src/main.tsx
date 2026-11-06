import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { FeedbackProvider } from './components/FeedbackProvider';
import { UpdatePrompt } from './components/UpdatePrompt';
import { db, requestPersistentStorage } from './db/db';
import { loadSampleOnFirstRun, refreshSampleData } from './lib/firstRun';
import { topUpOpenSeries } from './db/actions';
import './styles/global.css';

// Chiede al sistema di non cancellare i dati locali (IndexedDB) quando manca spazio.
void requestPersistentStorage();

function render() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <FeedbackProvider>
        <App />
        <UpdatePrompt />
      </FeedbackProvider>
    </StrictMode>,
  );
}

// Primo avvio: l'app parte già con i dati di esempio (segnalati da un banner).
// Serie «Sempre»: a ogni apertura si aggiungono le date future mancanti (sempre 6 mesi pronti).
loadSampleOnFirstRun(db, localStorage)
  .catch(() => false)
  // esempi ancora presenti ma di una versione vecchia: si aggiornano da soli
  .then(() => refreshSampleData(db, localStorage).catch(() => false))
  .then(() => topUpOpenSeries().catch(() => 0))
  .finally(render);
