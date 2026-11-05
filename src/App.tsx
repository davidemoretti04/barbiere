import { lazy, Suspense } from 'react';
import { TabBar } from './components/TabBar';
import { useSettings } from './db/hooks';
import { AgendaPage } from './features/agenda/AgendaPage';
import { HomePage } from './features/home/HomePage';
import { AppointmentProvider } from './features/appointments/AppointmentProvider';
import { ClientDetailPage } from './features/clients/ClientDetailPage';
import { ClientsPage } from './features/clients/ClientsPage';
import { BackupPage } from './features/more/BackupPage';
import { ExpensesPage } from './features/more/ExpensesPage';
import { MorePage } from './features/more/MorePage';
import { ServicesPage } from './features/more/ServicesPage';
import { SettingsPage } from './features/more/SettingsPage';
import { Onboarding } from './features/onboarding/Onboarding';
import { matchPath, usePath } from './router';

// Le statistiche (con i grafici) si caricano a parte: l'avvio dell'agenda resta rapido.
// Se dopo un aggiornamento il file non esiste più (versione vecchia ancora aperta), ricarica una volta la pagina.
const StatsPage = lazy(() =>
  import('./features/stats/StatsPage')
    .then((m) => {
      sessionStorage.removeItem('chunk-reload');
      return { default: m.StatsPage };
    })
    .catch((err: unknown) => {
      if (!sessionStorage.getItem('chunk-reload')) {
        sessionStorage.setItem('chunk-reload', '1');
        window.location.reload();
        return new Promise<never>(() => {});
      }
      throw err;
    }),
);

function Routes({ path }: { path: string }) {
  const client = matchPath('/clienti/:id', path);
  if (client) return <ClientDetailPage key={client.id} id={client.id} />;
  switch (path.split('?')[0]) {
    case '/agenda':
      return <AgendaPage />;
    case '/clienti':
      return <ClientsPage />;
    case '/statistiche':
      return (
        <Suspense fallback={null}>
          <StatsPage />
        </Suspense>
      );
    case '/altro':
      return <MorePage />;
    case '/altro/listino':
      return <ServicesPage />;
    case '/spese':
    case '/altro/spese':
      return <ExpensesPage />;
    case '/altro/impostazioni':
      return <SettingsPage />;
    case '/altro/backup':
      return <BackupPage />;
    default:
      return <HomePage />;
  }
}

export function App() {
  const settings = useSettings();
  const path = usePath();
  if (!settings) return null;
  if (!settings.onboarded) return <div className="app"><Onboarding /></div>;
  return (
    <AppointmentProvider>
      <div className="app">
        <main>
          <Routes key={path} path={path} />
        </main>
        <TabBar path={path} />
      </div>
    </AppointmentProvider>
  );
}
