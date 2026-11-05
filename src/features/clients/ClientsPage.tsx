import { useMemo, useState } from 'react';
import { useFeedback } from '../../components/feedback-context';
import { IconCake, IconChat, IconPeople, IconPlus, IconSearch } from '../../components/Icons';
import { SwipeRow } from '../../components/SwipeRow';
import { EmptyState, Page, Section, Segmented } from '../../components/ui';
import { deleteClient } from '../../db/actions';
import { useAllAppointments, useClients, useSettings } from '../../db/hooks';
import type { Client } from '../../db/types';
import { clientName, fmt, initials } from '../../lib/format';
import { formatPhone, whatsappLink } from '../../lib/phone';
import { matchClient } from '../../lib/search';
import { inactiveClients, upcomingBirthdays } from '../../lib/stats';
import { navigate } from '../../router';
import { useNow } from '../../hooks/useNow';
import { ClientForm } from './ClientForm';

type Tab = 'tutti' | 'ricontattare' | 'compleanni';
let lastTab: Tab = 'tutti';

export function ClientsPage() {
  const clients = useClients();
  const appts = useAllAppointments();
  const settings = useSettings();
  const { confirm, toast } = useFeedback();
  const [tab, setTabState] = useState<Tab>(lastTab);
  const setTab = (t: Tab) => {
    lastTab = t;
    setTabState(t);
  };
  const [query, setQuery] = useState('');
  const now = useNow();
  const [creating, setCreating] = useState(false);

  const visitCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of appts ?? []) if (a.clientId && a.status !== 'annullato') m.set(a.clientId, (m.get(a.clientId) ?? 0) + 1);
    return m;
  }, [appts]);

  const groups = useMemo(() => {
    const list = (clients ?? [])
      .filter((c) => matchClient(c, query))
      .sort((a, b) => clientName(a).localeCompare(clientName(b), 'it', { sensitivity: 'base' }));
    const g = new Map<string, Client[]>();
    for (const c of list) {
      const letter = (clientName(c)[0] ?? '#').toLocaleUpperCase('it').normalize('NFD').replace(/[̀-ͯ]/g, '');
      const key = /[A-Z]/.test(letter) ? letter : '#';
      g.set(key, [...(g.get(key) ?? []), c]);
    }
    return [...g.entries()];
  }, [clients, query]);

  const inactive = useMemo(
    () => (clients && appts && settings ? inactiveClients(clients, appts, settings.inactiveWeeks, now) : []),
    [clients, appts, settings, now],
  );
  const birthdays = useMemo(() => (clients ? upcomingBirthdays(clients, now, 60) : []), [clients, now]);

  async function remove(c: Client) {
    const n = visitCount.get(c.id) ?? 0;
    const ok = await confirm({
      title: `Eliminare ${clientName(c)}?`,
      message: n ? `Verranno eliminati anche ${n} appuntamenti e le statistiche cambieranno.` : undefined,
      confirmLabel: 'Elimina cliente',
      destructive: true,
    });
    if (!ok) return;
    const undo = await deleteClient(c.id);
    toast({ message: 'Cliente eliminato', actionLabel: 'Annulla', onAction: () => void undo() });
  }

  const recallText = (c: Client) => `Ciao ${c.firstName}! È passato un po’ dall’ultimo taglio: vuoi fissare un appuntamento?`;

  return (
    <Page
      title="Clienti"
      right={
        <button type="button" className="nav-btn" onClick={() => setCreating(true)} aria-label="Nuovo cliente">
          <IconPlus />
        </button>
      }
    >
      <Segmented
        label="Filtro clienti"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'tutti', label: 'Tutti' },
          { value: 'ricontattare', label: `Da ricontattare${inactive.length ? ` (${inactive.length})` : ''}` },
          { value: 'compleanni', label: 'Compleanni' },
        ]}
      />

      {tab === 'tutti' && (
        <>
          <div className="search">
            <IconSearch />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca nome o telefono"
              aria-label="Cerca clienti"
              enterKeyHint="search"
            />
          </div>
          {clients && clients.length === 0 && (
            <EmptyState
              icon={<IconPeople />}
              title="Nessun cliente"
              text="Aggiungi il primo cliente: bastano nome e telefono. Puoi crearli anche direttamente dall’agenda."
              action={
                <button type="button" className="btn" onClick={() => setCreating(true)}>
                  <IconPlus /> Nuovo cliente
                </button>
              }
            />
          )}
          {clients && clients.length > 0 && groups.length === 0 && (
            <EmptyState icon={<IconSearch />} title="Nessun risultato" text={`Nessun cliente corrisponde a «${query}».`} />
          )}
          {groups.map(([letter, list]) => (
            <Section key={letter} header={letter}>
              {list.map((c) => (
                <SwipeRow key={c.id} actions={[{ label: 'Elimina', color: 'red', onClick: () => void remove(c) }]}>
                  <button type="button" className="row" onClick={() => navigate(`/clienti/${c.id}`)}>
                    <span className="avatar" aria-hidden="true" style={{ width: 34, height: 34, fontSize: 14 }}>
                      {initials(c)}
                    </span>
                    <span className="row-main">
                      <span className="row-title" style={{ display: 'block' }}>
                        {clientName(c)}
                      </span>
                      {c.phone && (
                        <span className="row-sub" style={{ display: 'block' }}>
                          {formatPhone(c.phone)}
                        </span>
                      )}
                    </span>
                    <span className="row-detail small">{visitCount.get(c.id) ? `${visitCount.get(c.id)} visite` : 'Nuovo'}</span>
                  </button>
                </SwipeRow>
              ))}
            </Section>
          ))}
        </>
      )}

      {tab === 'ricontattare' && (
        <>
          {inactive.length === 0 ? (
            <EmptyState
              icon={<IconChat />}
              title="Tutti in regola"
              text={`Nessun cliente manca da più di ${settings?.inactiveWeeks ?? 6} settimane. Puoi cambiare la soglia in Altro → Impostazioni.`}
            />
          ) : (
            <Section footer={`Clienti senza visite da più di ${settings?.inactiveWeeks} settimane e senza appuntamenti futuri.`}>
              {inactive.map(({ client: c, lastVisit, weeksAgo }) => {
                const wa = c.phone ? whatsappLink(c.phone, recallText(c)) : null;
                return (
                  <div key={c.id} className="row">
                    <button type="button" className="row-main" style={{ textAlign: 'left' }} onClick={() => navigate(`/clienti/${c.id}`)}>
                      <span className="row-title" style={{ display: 'block' }}>
                        {clientName(c)}
                      </span>
                      <span className="row-sub" style={{ display: 'block' }}>
                        Ultima visita {fmt(lastVisit, 'd MMM yyyy')} · {weeksAgo} sett. fa
                      </span>
                    </button>
                    {wa && (
                      <a className="btn small tinted" href={wa} target="_blank" rel="noopener noreferrer" aria-label={`Scrivi su WhatsApp a ${clientName(c)}`}>
                        <IconChat /> WhatsApp
                      </a>
                    )}
                  </div>
                );
              })}
            </Section>
          )}
        </>
      )}

      {tab === 'compleanni' && (
        <>
          {birthdays.length === 0 ? (
            <EmptyState
              icon={<IconCake />}
              title="Nessun compleanno in arrivo"
              text="Qui compaiono i compleanni dei prossimi 60 giorni. Aggiungi la data nella scheda del cliente."
            />
          ) : (
            <Section header="Prossimi 60 giorni">
              {birthdays.map(({ client: c, date, daysUntil, age }) => {
                const wa = c.phone ? whatsappLink(c.phone, `Tanti auguri ${c.firstName}! 🎉`) : null;
                return (
                  <div key={c.id} className="row">
                    <button type="button" className="row-main" style={{ textAlign: 'left' }} onClick={() => navigate(`/clienti/${c.id}`)}>
                      <span className="row-title" style={{ display: 'block' }}>
                        {clientName(c)}
                      </span>
                      <span className="row-sub" style={{ display: 'block' }}>
                        {fmt(date, 'EEEE d MMMM')}
                        {age ? ` · ${age} anni` : ''}
                      </span>
                    </button>
                    <span className="row-detail small" style={{ color: daysUntil === 0 ? 'var(--red)' : undefined, fontWeight: daysUntil === 0 ? 600 : 400 }}>
                      {daysUntil === 0 ? 'Oggi' : daysUntil === 1 ? 'Domani' : `tra ${daysUntil} gg`}
                    </span>
                    {wa && (
                      <a className="icon-btn" href={wa} target="_blank" rel="noopener noreferrer" aria-label={`Fai gli auguri a ${clientName(c)} su WhatsApp`}>
                        <IconChat />
                      </a>
                    )}
                  </div>
                );
              })}
            </Section>
          )}
        </>
      )}

      {creating && (
        <ClientForm
          onClose={() => setCreating(false)}
          onSaved={(c) => {
            setCreating(false);
            toast(`${clientName(c)} aggiunto`);
          }}
        />
      )}
    </Page>
  );
}
