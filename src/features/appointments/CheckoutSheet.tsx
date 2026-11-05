import { useState } from 'react';
import { setAppointmentStatus } from '../../db/actions';
import type { Appointment, PaymentMethod } from '../../db/types';
import { useFeedback } from '../../components/feedback-context';
import { Sheet } from '../../components/Sheet';
import { Field, Section, Segmented } from '../../components/ui';
import { servicesLabel } from '../../lib/format';
import { centsToInput, formatEuro, parseEuro } from '../../lib/money';

const TIP_PRESETS = [0, 100, 200, 500];

/** Incasso: importo precompilato dal listino, mancia e metodo di pagamento facoltativi. */
export function CheckoutSheet({ appointment, onClose, onDone }: { appointment: Appointment; onClose: () => void; onDone: () => void }) {
  const { toast } = useFeedback();
  const listPrice = appointment.services.reduce((s, x) => s + x.priceCents, 0);
  const [amount, setAmount] = useState(centsToInput(appointment.amountCents || listPrice));
  const [tip, setTip] = useState(appointment.tipCents ? centsToInput(appointment.tipCents) : '');
  const [method, setMethod] = useState<PaymentMethod | ''>(appointment.paymentMethod ?? '');
  const [error, setError] = useState('');

  const amountCents = parseEuro(amount);
  const tipCents = tip.trim() ? parseEuro(tip) : 0;
  const total = (amountCents ?? 0) + (tipCents ?? 0);
  const diff = amountCents !== null ? amountCents - listPrice : 0;

  async function confirm() {
    if (amountCents === null || amountCents < 0) return setError('L’importo non è valido. Scrivi ad esempio 18 oppure 18,50.');
    if (tipCents === null || tipCents < 0) return setError('La mancia non è valida.');
    const undo = await setAppointmentStatus(appointment.id, 'completato', {
      amountCents,
      tipCents,
      paymentMethod: method || undefined,
    });
    toast({ message: `Incassato ${formatEuro(amountCents + tipCents)}`, actionLabel: 'Annulla', onAction: () => void undo() });
    onDone();
  }

  return (
    <Sheet
      title="Incasso"
      onClose={onClose}
      left={
        <button type="button" className="nav-btn" onClick={onClose}>
          Annulla
        </button>
      }
    >
      <div className="hero">
        <p>{servicesLabel(appointment)}</p>
        <h1 className="num" style={{ fontSize: 40, marginTop: 4 }}>
          {formatEuro(total)}
        </h1>
        {listPrice > 0 && diff !== 0 && (
          <p className="small">
            Listino {formatEuro(listPrice)} · {diff < 0 ? 'sconto' : 'extra'} {formatEuro(Math.abs(diff))}
          </p>
        )}
      </div>
      <Section>
        <Field label="Importo">
          <input type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Importo in euro" />
          <span className="suffix">€</span>
        </Field>
        <Field label="Mancia">
          <input type="text" inputMode="decimal" value={tip} onChange={(e) => setTip(e.target.value)} placeholder="0" aria-label="Mancia in euro" />
          <span className="suffix">€</span>
        </Field>
      </Section>
      <div className="chips" style={{ margin: '-16px 16px 24px' }} role="group" aria-label="Mancia rapida">
        {TIP_PRESETS.map((t) => (
          <button key={t} type="button" className="chip" aria-pressed={(tipCents ?? -1) === t} onClick={() => setTip(t ? centsToInput(t) : '')}>
            {t ? `+${formatEuro(t)}` : 'Nessuna mancia'}
          </button>
        ))}
      </div>
      <div className="section-header">Metodo di pagamento (facoltativo)</div>
      <Segmented<PaymentMethod | ''>
        label="Metodo di pagamento"
        value={method}
        onChange={setMethod}
        options={[
          { value: '', label: '—' },
          { value: 'contanti', label: 'Contanti' },
          { value: 'carta', label: 'Carta' },
          { value: 'altro', label: 'Altro' },
        ]}
      />
      {error && (
        <div className="field-error" role="alert" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}
      <div className="sheet-pad">
        <button type="button" className="btn green" onClick={confirm}>
          Incassa {formatEuro(total)}
        </button>
      </div>
    </Sheet>
  );
}
