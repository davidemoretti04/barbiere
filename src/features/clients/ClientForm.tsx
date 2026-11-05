import { useState } from 'react';
import { createClient, saveClient } from '../../db/actions';
import type { Client } from '../../db/types';
import { Sheet } from '../../components/Sheet';
import { Field, Section } from '../../components/ui';
import { normalizePhone } from '../../lib/phone';

export function ClientForm({ client, onClose, onSaved }: { client?: Client; onClose: () => void; onSaved: (c: Client) => void }) {
  const [first, setFirst] = useState(client?.firstName ?? '');
  const [last, setLast] = useState(client?.lastName ?? '');
  const [phone, setPhone] = useState(client?.phone ?? '');
  const [birthday, setBirthday] = useState(client?.birthday ?? '');
  const [notes, setNotes] = useState(client?.notes ?? '');
  const [error, setError] = useState('');

  async function save() {
    if (!first.trim()) return setError('Scrivi almeno il nome.');
    if (phone.trim() && !normalizePhone(phone)) return setError('Il numero di telefono non sembra valido.');
    const data = { firstName: first.trim(), lastName: last.trim(), phone: phone.trim(), notes: notes.trim(), birthday: birthday || undefined };
    if (client) {
      const c = { ...client, ...data };
      await saveClient(c);
      onSaved(c);
    } else {
      onSaved(await createClient(data));
    }
  }

  return (
    <Sheet
      title={client ? 'Modifica cliente' : 'Nuovo cliente'}
      onClose={onClose}
      dismissable={false}
      left={
        <button type="button" className="nav-btn" onClick={onClose}>
          Annulla
        </button>
      }
      right={
        <button type="button" className="nav-btn bold" onClick={save} disabled={!first.trim()}>
          {client ? 'Salva' : 'Aggiungi'}
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
      <Section footer="Facoltativo: serve per l’elenco dei prossimi compleanni.">
        <Field label="Compleanno">
          <input type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
        </Field>
      </Section>
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
