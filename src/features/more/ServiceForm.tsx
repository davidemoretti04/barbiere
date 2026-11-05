import { useState } from 'react';
import { saveService } from '../../db/actions';
import type { Service } from '../../db/types';
import { Sheet } from '../../components/Sheet';
import { Field, Section } from '../../components/ui';
import { newId } from '../../lib/id';
import { centsToInput, parseEuro } from '../../lib/money';

const DURATION_PRESETS = [15, 20, 30, 45, 60];

export function ServiceForm({ service, onClose, onSaved }: { service?: Service; onClose: () => void; onSaved: (s: Service) => void }) {
  const [name, setName] = useState(service?.name ?? '');
  const [price, setPrice] = useState(service ? centsToInput(service.priceCents) : '');
  const [duration, setDuration] = useState(String(service?.durationMinutes ?? 30));
  const [error, setError] = useState('');
  const dirty =
    name !== (service?.name ?? '') ||
    price !== (service ? centsToInput(service.priceCents) : '') ||
    duration !== String(service?.durationMinutes ?? 30);

  async function save() {
    const cents = parseEuro(price);
    const dur = parseInt(duration, 10);
    if (!name.trim()) return setError('Scrivi il nome del servizio.');
    if (cents === null || cents < 0) return setError('Il prezzo non è valido. Scrivi ad esempio 18 oppure 18,50.');
    if (!Number.isFinite(dur) || dur <= 0 || dur > 600) return setError('La durata deve essere un numero di minuti (es. 30).');
    const s: Service = { id: service?.id ?? newId(), name: name.trim(), priceCents: cents, durationMinutes: dur, active: service?.active ?? true };
    await saveService(s);
    onSaved(s);
  }

  return (
    <Sheet
      title={service ? 'Modifica servizio' : 'Nuovo servizio'}
      onClose={onClose}
      dismissable={!dirty}
      left={
        <button type="button" className="nav-btn" onClick={onClose}>
          {dirty ? 'Annulla' : 'Chiudi'}
        </button>
      }
      right={
        service && !dirty ? undefined : (
          <button type="button" className="nav-btn bold" onClick={save}>
            Salva
          </button>
        )
      }
    >
      <Section footer={service ? 'Le modifiche valgono per i nuovi appuntamenti: lo storico mantiene i prezzi di allora.' : undefined}>
        <Field label="Nome">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Es. Taglio" autoFocus={!service} autoCapitalize="sentences" />
        </Field>
        <Field label="Prezzo">
          <input type="text" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" />
          <span className="suffix">€</span>
        </Field>
        <Field label="Durata">
          <input type="text" inputMode="numeric" pattern="[0-9]*" value={duration} onChange={(e) => setDuration(e.target.value.replace(/\D/g, ''))} />
          <span className="suffix">min</span>
        </Field>
      </Section>
      <div className="chips" style={{ margin: '-16px 16px 16px' }} role="group" aria-label="Durate rapide">
        {DURATION_PRESETS.map((d) => (
          <button key={d} type="button" className="chip" aria-pressed={duration === String(d)} onClick={() => setDuration(String(d))}>
            {d} min
          </button>
        ))}
      </div>
      {error && (
        <div className="field-error" role="alert">
          {error}
        </div>
      )}
    </Sheet>
  );
}
