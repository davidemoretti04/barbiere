import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { FeedbackProvider } from './components/FeedbackProvider';
import { UpdatePrompt } from './components/UpdatePrompt';
import { db, requestPersistentStorage } from './db/db';
import { loadSampleOnFirstRun } from './lib/firstRun';
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
loadSampleOnFirstRun(db, localStorage)
  .catch(() => false)
  .finally(render);
