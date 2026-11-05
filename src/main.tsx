import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { FeedbackProvider } from './components/FeedbackProvider';
import { UpdatePrompt } from './components/UpdatePrompt';
import { requestPersistentStorage } from './db/db';
import './styles/global.css';

// Chiede al sistema di non cancellare i dati locali (IndexedDB) quando manca spazio.
void requestPersistentStorage();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FeedbackProvider>
      <App />
      <UpdatePrompt />
    </FeedbackProvider>
  </StrictMode>,
);
