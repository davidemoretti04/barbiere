import { useState } from 'react';
import { useFeedback } from '../../components/feedback-context';
import { IconCalendarPlus, IconChat, IconPhone } from '../../components/Icons';
import { BackButton, EmptyState, Page, Row, Section } from '../../components/ui';
import { deleteClient, restoreClient } from '../../db/actions';
import { IconWarning } from '../../components/Icons';
import { useClient, useClientAppointments } from '../../db/hooks';
import { clientName, fmt, initials, servicesLabel, STATUS_LABEL } from '../../lib/format';
import { formatEuro } from '../../lib/money';
import { formatPhone, telLink, whatsappLink } from '../../lib/phone';
import { clientStats } from '../../lib/stats';
import { repeatLabel, suggestedRepeatWeeks } from '../../lib/recurrence';
import { useNow } from '../../hooks/useNow';
import { navigate } from '../../router';
import { useAppointmentUI } from '../appointments/context';
import { ClientForm } from './ClientForm';
import { AppointmentSwipeRow } from '../appointments/AppointmentSwipeRow';

export function ClientDetailPage({ id }: { id: string }) {
  const client = useClient(id);
  const appts = useClientAppointments(id);
  const ui = useAppointmentUI();
  const { confirm, toast } = useFeedback();
  const [editing, setEditing] = useState(false);
  const now = useNow();
  const back = <BackButton label="Clienti" fallback="/clienti" />;

  if (client === null) {
    return (
      <Page title="Cliente" left={back} swipeBackFallback="/clienti" largeTitle={false}>
        <EmptyState title="Cliente non trovato" text="Potrebbe essere stato eliminato." />
      </Page>
    );
  }
  if (!client) return <Page title="" left={back} swipeBackFallback="/clienti" largeTitle={false}>{null}</Page>;

  const s = clientStats(appts ?? [], id, now);
  const nextSeries = (appts ?? [])
    .filter((a) => a.seriesId && a.status === 'programmato' && a.start >= now)
    .sort((a, b) => a.start - b.start);
  const suggested = suggestedRepeatWeeks(s.averageGapDays);
  const wa = client.phone ? whatsappLink(client.phone, `Ciao ${client.firstName}! `) : null;
  const tel = client.phone ? telLink(client.phone) : null;

  async function remove() {
    const ok = await confirm({
      title: `Eliminare ${clientName(client ?? undefined)}?`,
      message: 'Sparisce dall’elenco clienti e i suoi appuntamenti futuri vengono eliminati. Quelli già fatti restano nello storico e nelle statistiche.',
      confirmLabel: 'Elimina cliente',
      destructive: true,
    });
    if (!ok) return;
    const undo = await deleteClient(id);
    navigate('/clienti', { replace: true });
    toast({ message: 'Cliente eliminato', actionLabel: 'Annulla', onAction: () => void undo() });
  }

  return (
    <Page
      title={clientName(client)}
      left={back} swipeBackFallback="/clienti"
      largeTitle={false}
      right={
        client.deletedAt ? undefined : (
          <button type="button" className="nav-btn" onClick={() => setEditing(true)}>
            Modifica
          </button>
        )
      }
    >
      {client.deletedAt && (
        <div className="banner" role="status" style={{ marginTop: 8 }}>
          <IconWarning />
          <span className="grow">Cliente eliminato il {fmt(client.deletedAt, 'd MMMM yyyy')}. Lo storico resta visibile.</span>
          <button
            type="button"
            onClick={async () => {
              await restoreClient(id);
              toast('Cliente ripristinato');
            }}
          >
            Ripristina
          </button>
        </div>
      )}
      <div className="hero" style={{ paddingTop: 8 }}>
        <div className="avatar lg" aria-hidden="true">
          {initials(client)}
        </div>
        <h1>{clientName(client)}</h1>
        {client.phone && <p>{formatPhone(client.phone)}</p>}
      </div>

      <div className="actions-grid">
        {tel ? (
          <a className="action-tile" href={tel}>
            <IconPhone /> Chiama
          </a>
        ) : (
          <button type="button" className="action-tile" disabled>
            <IconPhone /> Chiama
          </button>
        )}
        {wa ? (
          <a className="action-tile" href={wa} target="_blank" rel="noopener noreferrer">
            <IconChat /> WhatsApp
          </a>
        ) : (
          <button type="button" className="action-tile" disabled>
            <IconChat /> WhatsApp
          </button>
        )}
        <button type="button" className="action-tile" onClick={() => ui.openNew({ clientId: id })}>
          <IconCalendarPlus /> Prenota
        </button>
      </div>

      <Section
        header="Cliente abituale"
        footer={
          nextSeries.length
            ? undefined
            : suggested
              ? `Di solito viene ${repeatLabel(suggested).toLowerCase()}. Prenota e scegli «Ripeti» per fissare in un colpo i prossimi appuntamenti.`
              : 'Prenota e scegli «Ripeti» per fissare in un colpo i prossimi appuntamenti.'
        }
      >
        {nextSeries.length ? (
          <Row
            title={`↻ ${repeatLabel(nextSeries[0].repeatWeeks ?? 1)}${nextSeries[0].openEnded ? ' · senza fine' : ''}`}
            sub={`Prossimo ${fmt(nextSeries[0].start, "EEE d MMM 'alle' HH:mm")} · tocca per modificare`}
            chevron
            onClick={() => ui.openSeries(nextSeries[0].seriesId!)}
          />
        ) : (
          <Row title="Imposta appuntamenti ricorrenti" className="action" onClick={() => ui.openNew({ clientId: id })} />
        )}
      </Section>

      <div className="kpis">
        <div className="kpi">
          <div className="k-label">Totale speso</div>
          <div className="k-value">{formatEuro(s.totalSpentCents)}</div>
        </div>
        <div className="kpi">
          <div className="k-label">Visite</div>
          <div className="k-value">{s.visits}</div>
        </div>
        <div className="kpi">
          <div className="k-label">Spesa media</div>
          <div className="k-value">{formatEuro(s.averageCents)}</div>
        </div>
        <div className="kpi">
          <div className="k-label">Ogni quanto viene</div>
          <div className="k-value">{s.averageGapDays !== null ? `${Math.round(s.averageGapDays)} gg` : '—'}</div>
        </div>
        <div className="kpi wide">
          <div className="k-label">Ultima visita</div>
          <div className="k-value" style={{ fontSize: 19 }}>
            {s.lastVisit ? fmt(s.lastVisit, 'EEEE d MMMM yyyy') : 'Nessuna visita'}
          </div>
          {s.nextAppointment && <div className="small muted">Prossimo: {fmt(s.nextAppointment, "EEE d MMM 'alle' HH:mm")}</div>}
        </div>
      </div>

      {client.notes && (
        <Section header="Note">
          {client.notes && (
            <div className="row" style={{ whiteSpace: 'pre-wrap', padding: '11px 16px' }}>
              {client.notes}
            </div>
          )}
        </Section>
      )}

      <Section header="Storico appuntamenti">
        {appts && appts.length === 0 && <Row title={<span className="muted">Nessun appuntamento</span>} />}
        {(appts ?? []).map((a) => (
          <AppointmentSwipeRow key={a.id} appointment={a}>
          <Row
            onClick={() => ui.openDetail(a.id)}
            title={fmt(a.start, "d MMM yyyy '·' HH:mm")}
            sub={servicesLabel(a)}
            detail={
              <span style={{ textAlign: 'right', display: 'block' }}>
                <span style={{ display: 'block' }}>{a.status === 'completato' ? formatEuro(a.amountCents + a.tipCents) : formatEuro(a.amountCents)}</span>
                {a.status !== 'completato' && <span className={`badge ${a.status}`}>{STATUS_LABEL[a.status]}</span>}
              </span>
            }
            chevron
          />
          </AppointmentSwipeRow>
        ))}
      </Section>

      {!client.deletedAt && (
        <Section footer="I suoi appuntamenti già fatti restano nello storico e nelle statistiche.">
          <button type="button" className="row destructive" onClick={remove}>
            Elimina cliente
          </button>
        </Section>
      )}

      {editing && (
        <ClientForm
          client={client}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            toast('Modifiche salvate');
          }}
        />
      )}
    </Page>
  );
}
