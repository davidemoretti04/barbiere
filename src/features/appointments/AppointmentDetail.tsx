import { deleteAppointment, setAppointmentStatus } from '../../db/actions';
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
  const { confirm, toast } = useFeedback();

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

  async function changeStatus(status: 'annullato' | 'non_presentato' | 'programmato', label: string) {
    if (status === 'annullato') {
      const ok = await confirm({ title: 'Annullare l’appuntamento?', message: 'Resterà nello storico come annullato.', confirmLabel: 'Annulla appuntamento', destructive: true, cancelLabel: 'Indietro' });
      if (!ok) return;
    }
    const undo = await setAppointmentStatus(id, status);
    toast({ message: label, actionLabel: 'Annulla', onAction: () => void undo() });
  }

  async function remove() {
    const ok = await confirm({
      title: 'Eliminare l’appuntamento?',
      message: 'Verrà rimosso anche dalle statistiche.',
      confirmLabel: 'Elimina',
      destructive: true,
    });
    if (!ok) return;
    const undo = await deleteAppointment(id);
    onClose();
    toast({ message: 'Appuntamento eliminato', actionLabel: 'Annulla', onAction: () => void undo() });
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
        <p style={{ marginTop: 8 }}>
          <span className={`badge ${a.status}`}>{STATUS_LABEL[a.status]}</span>
        </p>
      </div>

      {a.status === 'programmato' && (
        <div className="sheet-pad" style={{ marginBottom: 16 }}>
          <button type="button" className="btn green" onClick={onCheckout}>
            <IconCheck /> Segna come completato
          </button>
        </div>
      )}

      <div className="actions-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
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
        <button type="button" className="action-tile" onClick={() => addToCalendar(a, client)}>
          <IconCalendarPlus /> Calendario
        </button>
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
        <button type="button" className="row action" onClick={onEdit}>
          <IconPencil width={20} height={20} />
          <span className="row-main">Modifica o sposta</span>
        </button>
        {a.status === 'completato' && (
          <button type="button" className="row action" onClick={onCheckout}>
            <span className="row-main">Modifica incasso</span>
          </button>
        )}
        {a.status === 'programmato' && (
          <button type="button" className="row action" onClick={() => changeStatus('non_presentato', 'Segnato come non presentato')}>
            <span className="row-main">Non si è presentato</span>
          </button>
        )}
        {a.status !== 'programmato' && (
          <button type="button" className="row action" onClick={() => changeStatus('programmato', 'Riportato a programmato')}>
            <span className="row-main">Riporta a programmato</span>
          </button>
        )}
      </Section>
      <Section>
        {a.status === 'programmato' && (
          <button type="button" className="row destructive" onClick={() => changeStatus('annullato', 'Appuntamento annullato')}>
            Annulla appuntamento
          </button>
        )}
        <button type="button" className="row destructive" onClick={remove}>
          Elimina appuntamento
        </button>
      </Section>
    </Sheet>
  );
}
