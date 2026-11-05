import { useRegisterSW } from 'virtual:pwa-register/react';

/** Avviso quando è disponibile una nuova versione dell'app (service worker in attesa). */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // controlla aggiornamenti ogni ora quando l'app resta aperta
      if (registration) setInterval(() => void registration.update(), 60 * 60 * 1000);
    },
  });
  if (!needRefresh) return null;
  return (
    <div className="update-banner" role="alert">
      <span>Nuova versione disponibile</span>
      <button type="button" className="nav-btn" onClick={() => setNeedRefresh(false)}>
        Dopo
      </button>
      <button type="button" className="btn small" onClick={() => void updateServiceWorker(true)}>
        Aggiorna
      </button>
    </div>
  );
}
