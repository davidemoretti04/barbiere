import { useMemo, useState } from 'react';
import { useFeedback } from '../../components/feedback-context';
import { IconCalendarPlus, IconChat, IconPeople, IconPlus, IconSearch } from '../../components/Icons';
import { SwipeRow } from '../../components/SwipeRow';
import { EmptyState, Page, Row, Section, Segmented } from '../../components/ui';
import { deleteClient } from '../../db/actions';
import { useAllAppointments, useClients, useSettings } from '../../db/hooks';
import type { Client } from '../../db/types';
import { clientName, fmt, initials } from '../../lib/format';
import { formatPhone, whatsappLink } from '../../lib/phone';
import { matchClient } from '../../lib/search';
import { inactiveClients } from '../../lib/stats';
import { recurringClients, repeatLabel } from '../../lib/recurrence';
import { navigate } from '../../router';
import { useNow } from '../../hooks/useNow';
import { ClientForm } from './ClientForm';
import { useAppointmentUI } from '../appointments/context';

type Tab = 'tutti' | 'ricontattare' | 'ricorrenti';
let lastTab: Tab = 'tutti';

export function ClientsPage() {
  const clients = useClients();
  const appts = useAllAppointments();
  const settings = useSettings();
  const { confirm, toast } = useFeedback();
  const [tab, setTabState] = useState<Tab>(() => {
    const q = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('tab');
    return q === 'tutti' || q === 'ricontattare' || q === 'ricorrenti' ? q : lastTab;
  });
  const setTab = (t: Tab) => {
    lastTab = t;
    setTabState(t);
  };
  const [query, setQuery] = useState('');
  const ui = useAppointmentUI();
  const now = useNow();
  const [creating, setCreating] = useState<false | 'normale' | 'ricorrente'>(false);

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
  const recurring = useMemo(() => (clients && appts ? recurringClients(clients, appts, now) : []), [clients, appts, now]);

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
        <button type="button" className="nav-btn" onClick={() => setCreating('normale')} aria-label="Nuovo cliente">
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
          { value: 'ricorrenti', label: `Ricorrenti${recurring.length ? ` (${recurring.length})` : ''}` },
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
                <button type="button" className="btn" onClick={() => setCreating('normale')}>
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

      {tab === 'ricorrenti' && (
        <>
          {recurring.length === 0 ? (
            <EmptyState
              icon={<IconCalendarPlus />}
              title="Nessun cliente ricorrente"
              text="Qui compaiono i clienti abituali con appuntamenti fissi (es. ogni 3 settimane). Creane uno nuovo oppure usa «Ripeti» quando prenoti."
              action={
                <button type="button" className="btn" onClick={() => setCreating('ricorrente')}>
                  <IconPlus /> Nuovo cliente abituale
                </button>
              }
            />
          ) : (
            <Section
              footer="Tocca un cliente per modificare la ricorrenza (intervallo, giorno, ora, servizi) o terminarla."
              headerRight={
                <button type="button" className="nav-btn" style={{ minHeight: 0, fontSize: 15, textTransform: 'none' }} onClick={() => setCreating('ricorrente')}>
                  + Nuovo
                </button>
              }
              header={`${recurring.length} ${recurring.length === 1 ? 'cliente' : 'clienti'}`}
            >
              {recurring.map((r) => {
                const ending = !r.openEnded && r.remaining <= 2;
                return (
                  <Row
                    key={r.client.id}
                    onClick={() => ui.openSeries(r.next.seriesId!)}
                    title={clientName(r.client)}
                    sub={`↻ ${repeatLabel(r.repeatWeeks)} · prossimo ${fmt(r.next.start, "EEE d MMM 'alle' HH:mm")}`}
                    detail={
                      <span style={{ textAlign: 'right', display: 'block' }}>
                        <span style={{ display: 'block', color: ending ? 'var(--orange)' : undefined, fontWeight: ending ? 600 : 400 }}>
                          {r.openEnded ? '∞ Sempre' : ending ? (r.remaining === 1 ? 'Ultimo' : 'Ultimi 2') : `${r.remaining} in programma`}
                        </span>
                        {!r.openEnded && <span className="small">fino al {fmt(r.last.start, 'd MMM')}</span>}
                      </span>
                    }
                    chevron
                  />
                );
              })}
            </Section>
          )}
        </>
      )}

      {creating && (
        <ClientForm
          defaultRecurring={creating === 'ricorrente'}
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
