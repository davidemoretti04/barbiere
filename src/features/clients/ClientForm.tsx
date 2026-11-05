import { useState } from 'react';
import { createClient, saveClient } from '../../db/actions';
import type { Client } from '../../db/types';
import { Sheet } from '../../components/Sheet';
import { Field, Section, Switch } from '../../components/ui';
import { normalizePhone } from '../../lib/phone';
import { REPEAT_WEEKS_OPTIONS, repeatLabel } from '../../lib/recurrence';
import { useAppointmentUI } from '../appointments/context';

export function ClientForm({
  client,
  onClose,
  onSaved,
  defaultRecurring = false,
}: {
  client?: Client;
  onClose: () => void;
  onSaved: (c: Client) => void;
  /** Apre il modulo con «Appuntamenti ricorrenti» già attivo. */
  defaultRecurring?: boolean;
}) {
  const [first, setFirst] = useState(client?.firstName ?? '');
  const [last, setLast] = useState(client?.lastName ?? '');
  const [phone, setPhone] = useState(client?.phone ?? '');
  const [notes, setNotes] = useState(client?.notes ?? '');
  const [error, setError] = useState('');
  const [recurring, setRecurring] = useState(defaultRecurring);
  const [weeks, setWeeks] = useState(3);
  const ui = useAppointmentUI();

  async function save() {
    if (!first.trim()) return setError('Scrivi almeno il nome.');
    if (phone.trim() && !normalizePhone(phone)) return setError('Il numero di telefono non sembra valido.');
    const data = { firstName: first.trim(), lastName: last.trim(), phone: phone.trim(), notes: notes.trim() };
    if (client) {
      const c = { ...client, ...data };
      await saveClient(c);
      onSaved(c);
    } else {
      const c = await createClient(data);
      onSaved(c);
      // subito dopo: modulo appuntamento con «Ripeti» già impostato
      if (recurring) ui.openNew({ clientId: c.id, repeatWeeks: weeks });
    }
  }

  return (
    <Sheet
      title={client ? 'Modifica cliente' : 'Nuovo cliente'}
      onClose={onClose}
      tall
      dismissable={false}
      left={
        <button type="button" className="nav-btn" onClick={onClose}>
          Annulla
        </button>
      }
      right={
        <button type="button" className="nav-btn bold" onClick={save} disabled={!first.trim()}>
          {client ? 'Salva' : recurring ? 'Avanti' : 'Aggiungi'}
        </button>
      }
    >
      <Section>
        <Field label="Nome">
          <input value={first} onChange={(e) => setFirst(e.target.value)} placeholder="Obbligatorio" autoCapitalize="words" autoComplete="off" autoFocus={!client} />
        </Field>
        <Field label="Cognome">
          <input value={last} onChange={(e) => setLast(e.target.value)} placeholder="Facoltativo" autoCapitalize="words" autoComplete="off" />
        </Field>
        <Field label="Telefono">
          <input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="333 123 4567" autoComplete="off" />
        </Field>
      </Section>
      {!client && (
        <Section
          header="Cliente abituale"
          footer={
            recurring
              ? `Dopo il salvataggio si apre il primo appuntamento con «Ripeti» già su ${repeatLabel(weeks).toLowerCase()}: scegli giorno, ora e servizio.`
              : 'Attiva per fissare subito i suoi appuntamenti ricorrenti.'
          }
        >
          <div className="field" style={{ minHeight: 50 }}>
            <span style={{ flex: 1 }}>Appuntamenti ricorrenti</span>
            <Switch checked={recurring} onChange={setRecurring} label="Imposta appuntamenti ricorrenti" />
          </div>
          {recurring && (
            <div className="field" style={{ minHeight: 52, paddingTop: 8, paddingBottom: 8 }}>
              <div className="chips" role="group" aria-label="Ogni quante settimane">
                {REPEAT_WEEKS_OPTIONS.map((w) => (
                  <button key={w} type="button" className="chip" aria-pressed={weeks === w} onClick={() => setWeeks(w)}>
                    {w === 1 ? 'Ogni sett.' : `${w} sett.`}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Section>
      )}
      <Section header="Note">
        <label className="field stack">
          <span className="sr-only">Note</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Preferenze, allergie, tipo di taglio…" rows={4} />
        </label>
      </Section>
      {error && (
        <div className="field-error" role="alert">
          {error}
        </div>
      )}
    </Sheet>
  );
}
