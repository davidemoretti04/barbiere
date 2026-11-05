import { useState } from 'react';
import { useFeedback } from '../../components/feedback-context';
import { IconPlus, IconScissors } from '../../components/Icons';
import { SwipeRow } from '../../components/SwipeRow';
import { BackButton, EmptyState, Page, Row, Section } from '../../components/ui';
import { saveService } from '../../db/actions';
import { useServices } from '../../db/hooks';
import type { Service } from '../../db/types';
import { durationLabel } from '../../lib/format';
import { formatEuro } from '../../lib/money';
import { ServiceForm } from './ServiceForm';

export function ServicesPage() {
  const services = useServices();
  const { toast } = useFeedback();
  const [editing, setEditing] = useState<Service | 'new' | null>(null);
  const sorted = [...(services ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'it'));
  const active = sorted.filter((s) => s.active);
  const archived = sorted.filter((s) => !s.active);

  async function toggleArchive(s: Service) {
    await saveService({ ...s, active: !s.active });
    toast({
      message: s.active ? `«${s.name}» archiviato` : `«${s.name}» ripristinato`,
      actionLabel: 'Annulla',
      onAction: () => void saveService(s),
    });
  }

  const row = (s: Service) => (
    <SwipeRow key={s.id} actions={[{ label: s.active ? 'Archivia' : 'Ripristina', color: s.active ? 'orange' : 'blue', onClick: () => void toggleArchive(s) }]}>
      <Row title={s.name} sub={durationLabel(s.durationMinutes)} detail={formatEuro(s.priceCents)} chevron onClick={() => setEditing(s)} />
    </SwipeRow>
  );

  return (
    <Page
      title="Listino servizi"
      left={<BackButton label="Altro" fallback="/altro" />}
      right={
        <button type="button" className="nav-btn" onClick={() => setEditing('new')} aria-label="Nuovo servizio">
          <IconPlus />
        </button>
      }
    >
      {services && services.length === 0 && (
        <EmptyState
          icon={<IconScissors />}
          title="Listino vuoto"
          text="Aggiungi i servizi che offri con prezzo e durata: li sceglierai con un tocco quando crei un appuntamento."
          action={
            <button type="button" className="btn" onClick={() => setEditing('new')}>
              <IconPlus /> Nuovo servizio
            </button>
          }
        />
      )}
      {active.length > 0 && (
        <Section header="Attivi" footer="Scorri una riga verso sinistra per archiviarla. I servizi archiviati restano nello storico.">
          {active.map(row)}
        </Section>
      )}
      {archived.length > 0 && <Section header="Archiviati">{archived.map(row)}</Section>}
      {archived.length > 0 && (
        <p className="center muted small" style={{ padding: '0 24px' }}>
          Per ripristinare un servizio archiviato, scorri la riga verso sinistra.
        </p>
      )}
      {editing && (
        <ServiceForm
          service={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            toast('Listino aggiornato');
          }}
        />
      )}
    </Page>
  );
}
