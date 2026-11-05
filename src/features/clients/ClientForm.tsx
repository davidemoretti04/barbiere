import { useState } from 'react';
import { createClient, DuplicateClientError, saveClient } from '../../db/actions';
import { useClients } from '../../db/hooks';
import { clientKey, findDuplicateClient } from '../../lib/search';
import { clientName } from '../../lib/format';
import { formatPhone } from '../../lib/phone';
import { navigate } from '../../router';
import { IconWarning } from '../../components/Icons';
import type { Client } from '../../db/types';
import { Sheet } from '../../components/Sheet';
import { Field, Section, SwitchRow } from '../../components/ui';
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
  const dirty =
    first !== (client?.firstName ?? '') ||
    last !== (client?.lastName ?? '') ||
    phone !== (client?.phone ?? '') ||
    notes !== (client?.notes ?? '');
  const [recurring, setRecurring] = useState(defaultRecurring);
  const [weeks, setWeeks] = useState(3);
  const ui = useAppointmentUI();
  const clients = useClients();
  const [saving, setSaving] = useState(false);
  const identityChanged = !client || clientKey(client) !== clientKey({ firstName: first, lastName: last, phone });
  const duplicate = clients && identityChanged ? findDuplicateClient(clients, { firstName: first, lastName: last, phone }, client?.id) : undefined;

  async function save() {
    if (saving) return; // niente doppi salvataggi con il doppio tocco
    if (!first.trim()) return setError('Scrivi almeno il nome.');
    if (phone.trim() && !normalizePhone(phone)) return setError('Il numero di telefono non sembra valido.');
    if (duplicate) return setError('Questo cliente esiste già: aprilo invece di crearne un altro.');
    setSaving(true);
    try {
      await doSave();
    } catch (e) {
      setSaving(false);
      if (e instanceof DuplicateClientError) setError(`Esiste già «${clientName(e.existing)}» con questi dati.`);
      else setError('Non è stato possibile salvare. Riprova.');
    }
  }

  async function doSave() {
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
      dismissable={!dirty}
      left={
        <button type="button" className="nav-btn" onClick={onClose}>
          {dirty ? 'Annulla' : 'Chiudi'}
        </button>
      }
      right={
        client && !dirty ? undefined : (
          <button type="button" className="nav-btn bold" onClick={save} disabled={!first.trim() || !!duplicate || saving}>
            {client ? 'Salva' : recurring ? 'Avanti' : 'Aggiungi'}
          </button>
        )
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
      {duplicate && (
        <div className="warn" role="alert">
          <IconWarning />
          <div style={{ flex: 1 }}>
            <b>Cliente già presente.</b> Esiste già «{clientName(duplicate)}»{duplicate.phone ? ` (${formatPhone(duplicate.phone)})` : ' senza telefono'}.
            <div style={{ marginTop: 8 }}>
              <button
                type="button"
                className="btn small tinted"
                onClick={() => {
                  onClose();
                  navigate(`/clienti/${duplicate.id}`);
                }}
              >
                Apri il cliente esistente
              </button>
            </div>
          </div>
        </div>
      )}
      {!client && (
        <Section
          header="Cliente abituale"
          footer={
            recurring
              ? `Dopo il salvataggio si apre il primo appuntamento con «Ripeti» già su ${repeatLabel(weeks).toLowerCase()}: scegli giorno, ora e servizio.`
              : 'Attiva per fissare subito i suoi appuntamenti ricorrenti.'
          }
        >
          <SwitchRow title="Appuntamenti ricorrenti" checked={recurring} onChange={setRecurring} ariaLabel="Imposta appuntamenti ricorrenti" />
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
