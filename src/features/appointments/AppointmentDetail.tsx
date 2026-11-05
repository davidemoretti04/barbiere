import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { setAppointmentStatus } from '../../db/actions';
import { useAppointmentActions } from './useAppointmentActions';
import { useAppointmentUI } from './context';
import { repeatLabel, seriesFrom } from '../../lib/recurrence';
import { useAppointment, useClient, useSettings } from '../../db/hooks';
import { useFeedback } from '../../components/feedback-context';
import { IconCalendarPlus, IconChat, IconCheck, IconPencil, IconPhone, IconSms } from '../../components/Icons';
import { Sheet } from '../../components/Sheet';
import { Row, Section } from '../../components/ui';
import { capitalize, clientName, durationLabel, fmt, PAYMENT_LABEL, reminderText, STATUS_LABEL } from '../../lib/format';
import { formatEuro } from '../../lib/money';
import { smsLink, telLink, whatsappLink } from '../../lib/phone';
import { DEFAULT_SETTINGS } from '../../db/types';
import { navigate } from '../../router';
import { addToCalendar } from './calendar';

export function AppointmentDetail({
  id,
  onClose,
  onEdit,
  onCheckout,
}: {
  id: string;
  onClose: () => void;
  onEdit: () => void;
  onCheckout: () => void;
}) {
  const a = useAppointment(id);
  const client = useClient(a?.clientId) ?? undefined;
  const settings = useSettings();
  const { toast } = useFeedback();
  const actions = useAppointmentActions();
  const ui = useAppointmentUI();
  const seriesId = a?.seriesId;
  const seriesAll = useLiveQuery(() => (seriesId ? db.appointments.where('seriesId').equals(seriesId).toArray() : []), [seriesId]);

  if (!a) {
    return (
      <Sheet title="Appuntamento" onClose={onClose}>
        <p className="center muted">Caricamento…</p>
      </Sheet>
    );
  }

  const template = settings?.reminderTemplate ?? DEFAULT_SETTINGS.reminderTemplate;
  const text = reminderText(template, client, a);
  const wa = client?.phone ? whatsappLink(client.phone, text) : null;
  const sms = client?.phone ? smsLink(client.phone, text) : null;
  const tel = client?.phone ? telLink(client.phone) : null;
  const minutes = Math.round((a.end - a.start) / 60000);

  const following = a.seriesId && seriesAll ? seriesFrom(seriesAll, a) : [a];
  const futureCount = following.length - 1;

  async function backToScheduled() {
    const undo = await setAppointmentStatus(id, 'programmato');
    toast({ message: 'Riportato a programmato', actionLabel: 'Annulla', onAction: () => void undo() });
  }

  const noPhone = () => toast('Questo cliente non ha un numero di telefono valido.');

  return (
    <Sheet title="Appuntamento" onClose={onClose}>
      <div className="hero">
        <button
          type="button"
          onClick={() => {
            if (!client) return;
            onClose();
            navigate(`/clienti/${client.id}`);
          }}
          style={{ fontSize: 24, fontWeight: 700, color: 'var(--label)', minHeight: 44 }}
        >
          {clientName(client)}
        </button>
        <p>
          {capitalize(fmt(a.start, 'EEEE d MMMM'))} · {fmt(a.start, 'HH:mm')}–{fmt(a.end, 'HH:mm')}
        </p>
        <p style={{ marginTop: 8, display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
          <span className={`badge ${a.status}`}>{STATUS_LABEL[a.status]}</span>
          {a.seriesId && (
            <span className="badge programmato" style={{ background: 'var(--fill-2)', color: 'var(--label-2)' }}>
              ↻ {repeatLabel(a.repeatWeeks ?? 1)}
              {a.openEnded ? ' · senza fine' : futureCount > 0 ? ` · altri ${futureCount}` : ''}
            </span>
          )}
        </p>
      </div>

      <div className="sheet-pad" style={{ marginBottom: 16, display: 'grid', gap: 10 }}>
        {a.status === 'programmato' && (
          <button type="button" className="btn green" onClick={onCheckout}>
            <IconCheck /> Segna come completato
          </button>
        )}
        <button type="button" className="btn tinted" onClick={() => addToCalendar(a, client)}>
          <IconCalendarPlus /> Aggiungi al Calendario
        </button>
      </div>

      <div className="actions-grid">
        {wa ? (
          <a className="action-tile" href={wa} target="_blank" rel="noopener noreferrer">
            <IconChat /> Promemoria
          </a>
        ) : (
          <button type="button" className="action-tile" onClick={noPhone}>
            <IconChat /> Promemoria
          </button>
        )}
        {sms ? (
          <a className="action-tile" href={sms}>
            <IconSms /> SMS
          </a>
        ) : (
          <button type="button" className="action-tile" onClick={noPhone}>
            <IconSms /> SMS
          </button>
        )}
        {tel ? (
          <a className="action-tile" href={tel}>
            <IconPhone /> Chiama
          </a>
        ) : (
          <button type="button" className="action-tile" onClick={noPhone}>
            <IconPhone /> Chiama
          </button>
        )}
      </div>

      <Section header="Servizi" footer={`Durata ${durationLabel(minutes)}`}>
        {a.services.length === 0 && <Row title="Nessun servizio indicato" />}
        {a.services.map((s, i) => (
          <Row key={i} title={s.name} detail={formatEuro(s.priceCents)} />
        ))}
        <Row title={<strong>{a.status === 'completato' ? 'Incassato' : 'Previsto'}</strong>} detail={<strong style={{ color: 'var(--label)' }}>{formatEuro(a.amountCents)}</strong>} />
        {a.status === 'completato' && a.tipCents > 0 && <Row title="Mancia" detail={formatEuro(a.tipCents)} />}
        {a.status === 'completato' && a.paymentMethod && <Row title="Pagamento" detail={PAYMENT_LABEL[a.paymentMethod]} />}
      </Section>

      {a.notes && (
        <Section header="Note">
          <div className="row" style={{ whiteSpace: 'pre-wrap', padding: '11px 16px' }}>
            {a.notes}
          </div>
        </Section>
      )}

      <Section>
        {a.seriesId && (
          <button type="button" className="row action" onClick={() => ui.openSeries(a.seriesId!)}>
            <span aria-hidden="true" style={{ width: 20, textAlign: 'center', fontSize: 18 }}>↻</span>
            <span className="row-main">
              <span style={{ display: 'block' }}>Modifica ricorrenza</span>
              <span className="row-sub" style={{ display: 'block' }}>Intervallo, giorno, ora e servizi di tutti i prossimi</span>
            </span>
          </button>
        )}
        <button type="button" className="row action" onClick={onEdit}>
          <IconPencil width={20} height={20} />
          <span className="row-main">{a.seriesId ? 'Modifica o sposta solo questo' : 'Modifica o sposta'}</span>
        </button>
        {a.status === 'completato' && (
          <button type="button" className="row action" onClick={onCheckout}>
            <span className="row-main">Modifica incasso</span>
          </button>
        )}
        {a.status !== 'programmato' && (
          <button type="button" className="row action" onClick={() => void backToScheduled()}>
            <span className="row-main">Riporta a programmato</span>
          </button>
        )}
      </Section>
      <Section footer={a.status === 'programmato' ? 'Usa «Annulla» anche se il cliente non si è presentato.' : undefined}>
        {a.status === 'programmato' && (
          <button type="button" className="row destructive" onClick={() => void actions.cancel(a)}>
            Annulla appuntamento
          </button>
        )}
        <button type="button" className="row destructive" onClick={async () => (await actions.remove(a)) && onClose()}>
          Elimina appuntamento
        </button>
      </Section>
    </Sheet>
  );
}
