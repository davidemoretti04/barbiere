import { addDays } from 'date-fns';
import { useMemo, useState } from 'react';
import { createClient, saveAppointment } from '../../db/actions';
import { useAppointmentsBetween, useClients, useServices, useSettings } from '../../db/hooks';
import type { Appointment, AppointmentService } from '../../db/types';
import { IconCheck, IconPlus, IconSearch, IconWarning } from '../../components/Icons';
import { Sheet } from '../../components/Sheet';
import { Field, Section } from '../../components/ui';
import { clientName, durationLabel, fmt, initials } from '../../lib/format';
import { newId } from '../../lib/id';
import { centsToInput, formatEuro, parseEuro } from '../../lib/money';
import { findOverlaps } from '../../lib/overlap';
import { formatPhone, normalizePhone } from '../../lib/phone';
import { atMinutes, closureFor, fromDateKey, isWithinWorkingHours, parseHM, roundUpToSlot, toDateKey } from '../../lib/schedule';
import { matchClient } from '../../lib/search';
import type { NewAppointmentPrefill } from './context';

interface Props {
  editing?: Appointment;
  prefill?: NewAppointmentPrefill;
  onClose: () => void;
  onSaved: (id: string) => void;
}

const sumDur = (s: AppointmentService[]) => s.reduce((t, x) => t + x.durationMinutes, 0);
const sumPrice = (s: AppointmentService[]) => s.reduce((t, x) => t + x.priceCents, 0);

export function AppointmentForm({ editing, prefill, onClose, onSaved }: Props) {
  const settings = useSettings();
  const clients = useClients();
  const services = useServices();

  const initialStart = editing?.start ?? prefill?.start ?? roundUpToSlot(new Date(), 15).getTime();
  const [clientId, setClientId] = useState<string | null>(editing?.clientId ?? prefill?.clientId ?? null);
  const [query, setQuery] = useState('');
  const [newClient, setNewClient] = useState<{ first: string; last: string; phone: string } | null>(null);
  const [selected, setSelected] = useState<AppointmentService[]>(editing?.services ?? []);
  const [date, setDate] = useState(toDateKey(new Date(initialStart)));
  const [time, setTime] = useState(fmt(initialStart, 'HH:mm'));
  const editingDur = editing ? Math.round((editing.end - editing.start) / 60000) : 0;
  const [durOverride, setDurOverride] = useState<string | null>(
    editing && editingDur !== sumDur(editing.services) ? String(editingDur) : null,
  );
  const [priceOverride, setPriceOverride] = useState<string | null>(
    editing && editing.amountCents !== sumPrice(editing.services) ? centsToInput(editing.amountCents) : null,
  );
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const defaultDur = settings?.defaultDurationMinutes ?? 30;
  const computedDur = selected.length ? sumDur(selected) : defaultDur;
  const duration = durOverride !== null ? parseInt(durOverride, 10) : computedDur;
  const computedPrice = sumPrice(selected);
  const price = priceOverride !== null ? parseEuro(priceOverride) : computedPrice;

  const day = fromDateKey(date || toDateKey(new Date()));
  const startMs = time ? atMinutes(day, parseHM(time)).getTime() : NaN;
  const endMs = startMs + (Number.isFinite(duration) ? duration : 0) * 60000;
  const dayAppts = useAppointmentsBetween(day.getTime(), addDays(day, 1).getTime());

  const client = clients?.find((c) => c.id === clientId);
  const activeServices = useMemo(
    () => (services ?? []).filter((s) => s.active).sort((a, b) => a.name.localeCompare(b.name, 'it')),
    [services],
  );
  // servizi archiviati già presenti nell'appuntamento in modifica
  const extraSelected = selected.filter((s) => !activeServices.some((a) => a.id === s.serviceId));

  const results = useMemo(() => {
    if (!clients) return [];
    const list = query.trim()
      ? clients.filter((c) => matchClient(c, query)).sort((a, b) => clientName(a).localeCompare(clientName(b), 'it'))
      : [...clients].sort((a, b) => b.createdAt - a.createdAt);
    return list.slice(0, 6);
  }, [clients, query]);

  const overlaps = Number.isFinite(startMs) ? findOverlaps({ start: startMs, end: endMs }, dayAppts ?? [], editing?.id) : [];
  const closure = settings ? closureFor(day, settings) : undefined;
  const outside = settings && Number.isFinite(startMs) && duration > 0 && !isWithinWorkingHours(startMs, endMs, settings);
  const nameOf = (id: string) => clientName(clients?.find((c) => c.id === id));

  function toggleService(s: { id: string; name: string; priceCents: number; durationMinutes: number }) {
    setSelected((cur) =>
      cur.some((x) => x.serviceId === s.id)
        ? cur.filter((x) => x.serviceId !== s.id)
        : [...cur, { serviceId: s.id, name: s.name, priceCents: s.priceCents, durationMinutes: s.durationMinutes }],
    );
  }

  function startNewClient() {
    const q = query.trim();
    if (/^[\d\s+()-]+$/.test(q) && q.replace(/\D/g, '').length >= 3) setNewClient({ first: '', last: '', phone: q });
    else {
      const [first = '', ...rest] = q.split(/\s+/);
      setNewClient({ first: first ? first[0].toUpperCase() + first.slice(1) : '', last: rest.join(' '), phone: '' });
    }
  }

  async function save() {
    setError('');
    if (!clientId && !newClient) return setError('Scegli un cliente oppure creane uno nuovo.');
    if (newClient && !newClient.first.trim()) return setError('Scrivi almeno il nome del nuovo cliente.');
    if (newClient && newClient.phone.trim() && !normalizePhone(newClient.phone))
      return setError('Il numero di telefono non sembra valido. Controllalo o lascialo vuoto.');
    if (!date || !time || !Number.isFinite(startMs)) return setError('Indica data e ora.');
    if (!Number.isFinite(duration) || duration <= 0 || duration > 12 * 60) return setError('Indica una durata valida in minuti.');
    if (price === null || price < 0) return setError('L’importo non è valido. Usa ad esempio 18 oppure 18,50.');
    setSaving(true);
    try {
      let cid = clientId;
      if (newClient) {
        const c = await createClient({
          firstName: newClient.first.trim(),
          lastName: newClient.last.trim(),
          phone: newClient.phone.trim(),
          notes: '',
        });
        cid = c.id;
      }
      const appt: Appointment = {
        id: editing?.id ?? newId(),
        clientId: cid!,
        start: startMs,
        end: endMs,
        services: selected,
        status: editing?.status ?? 'programmato',
        amountCents: price,
        tipCents: editing?.tipCents ?? 0,
        paymentMethod: editing?.paymentMethod,
        notes: notes.trim(),
      };
      await saveAppointment(appt);
      onSaved(appt.id);
    } catch {
      setError('Non è stato possibile salvare. Riprova.');
      setSaving(false);
    }
  }

  return (
    <Sheet
      title={editing ? 'Modifica appuntamento' : 'Nuovo appuntamento'}
      onClose={onClose}
      tall
      dismissable={false}
      left={
        <button type="button" className="nav-btn" onClick={onClose}>
          Annulla
        </button>
      }
      right={
        <button type="button" className="nav-btn bold" onClick={save} disabled={saving}>
          {editing ? 'Salva' : 'Aggiungi'}
        </button>
      }
    >
      {/* ----- Cliente ----- */}
      {client && !newClient ? (
        <Section header="Cliente">
          <div className="row">
            <span className="avatar" aria-hidden="true">
              {initials(client)}
            </span>
            <span className="row-main">
              <span className="row-title" style={{ display: 'block' }}>
                {clientName(client)}
              </span>
              {client.phone && (
                <span className="row-sub" style={{ display: 'block' }}>
                  {formatPhone(client.phone)}
                </span>
              )}
            </span>
            <button type="button" className="nav-btn" onClick={() => setClientId(null)}>
              Cambia
            </button>
          </div>
        </Section>
      ) : newClient ? (
        <Section
          header="Nuovo cliente"
          headerRight={
            <button type="button" className="nav-btn" style={{ minHeight: 0, fontSize: 15, textTransform: 'none' }} onClick={() => setNewClient(null)}>
              Cerca esistente
            </button>
          }
        >
          <Field label="Nome">
            <input
              autoFocus={!newClient.first}
              value={newClient.first}
              onChange={(e) => setNewClient({ ...newClient, first: e.target.value })}
              placeholder="Obbligatorio"
              autoCapitalize="words"
              autoComplete="off"
            />
          </Field>
          <Field label="Cognome">
            <input
              value={newClient.last}
              onChange={(e) => setNewClient({ ...newClient, last: e.target.value })}
              placeholder="Facoltativo"
              autoCapitalize="words"
              autoComplete="off"
            />
          </Field>
          <Field label="Telefono">
            <input
              autoFocus={!!newClient.first}
              type="tel"
              inputMode="tel"
              value={newClient.phone}
              onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
              placeholder="333 123 4567"
              autoComplete="off"
            />
          </Field>
        </Section>
      ) : (
        <Section header="Cliente">
          <div className="field">
            <IconSearch width={18} height={18} style={{ color: 'var(--label-2)', flex: 'none' }} />
            <input
              className="input-left"
              style={{ textAlign: 'left' }}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca nome o telefono"
              aria-label="Cerca cliente"
              autoComplete="off"
              enterKeyHint="search"
            />
          </div>
          {results.map((c) => (
            <button key={c.id} type="button" className="row" onClick={() => setClientId(c.id)}>
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
            </button>
          ))}
          <button type="button" className="row action" onClick={startNewClient}>
            <IconPlus width={20} height={20} />
            <span className="row-main">{query.trim() ? `Nuovo cliente «${query.trim()}»` : 'Nuovo cliente'}</span>
          </button>
        </Section>
      )}

      {/* ----- Servizi ----- */}
      <Section
        header="Servizi"
        footer={activeServices.length === 0 ? 'Il listino è vuoto: aggiungi i servizi da Altro → Listino servizi.' : undefined}
      >
        {[...activeServices, ...extraSelected.map((s) => ({ id: s.serviceId, name: s.name, priceCents: s.priceCents, durationMinutes: s.durationMinutes, active: false }))].map((s) => {
          const on = selected.some((x) => x.serviceId === s.id);
          return (
            <button key={s.id} type="button" className="row" onClick={() => toggleService(s)} aria-pressed={on}>
              <span className={`check ${on ? 'on' : ''}`} aria-hidden="true">
                {on && <IconCheck />}
              </span>
              <span className="row-main">
                <span className="row-title" style={{ display: 'block' }}>
                  {s.name}
                </span>
                <span className="row-sub" style={{ display: 'block' }}>
                  {durationLabel(s.durationMinutes)}
                </span>
              </span>
              <span className="row-detail">{formatEuro(s.priceCents)}</span>
            </button>
          );
        })}
      </Section>

      {/* ----- Quando ----- */}
      <Section header="Quando">
        <Field label="Data">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <Field label="Ora">
          <input type="time" value={time} step={(settings?.slotMinutes ?? 15) * 60} onChange={(e) => setTime(e.target.value)} required />
        </Field>
        <Field label="Durata">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={durOverride ?? String(computedDur)}
            onChange={(e) => setDurOverride(e.target.value.replace(/\D/g, ''))}
            aria-describedby="dur-suffix"
          />
          <span className="suffix" id="dur-suffix">
            min
          </span>
        </Field>
        {Number.isFinite(startMs) && duration > 0 && (
          <div className="row">
            <span className="row-main muted small">Fine prevista</span>
            <span className="row-detail">{fmt(endMs, 'HH:mm')}</span>
          </div>
        )}
      </Section>

      {(overlaps.length > 0 || outside) && (
        <div className="warn" role="status">
          <IconWarning />
          <div>
            {overlaps.length > 0 && (
              <div>
                Si sovrappone con {overlaps.map((o) => `${nameOf(o.clientId)} (${fmt(o.start, 'HH:mm')})`).join(', ')}.
              </div>
            )}
            {outside && <div>{closure ? `Giorno di chiusura: ${closure.label || 'chiuso'}.` : 'È fuori dall’orario di lavoro.'}</div>}
            <div className="muted small">Puoi salvare comunque.</div>
          </div>
        </div>
      )}

      {/* ----- Importo e note ----- */}
      <Section header="Importo previsto" footer="Calcolato dal listino. Potrai modificarlo al momento dell’incasso.">
        <Field label="Importo">
          <input
            type="text"
            inputMode="decimal"
            value={priceOverride ?? centsToInput(computedPrice)}
            onChange={(e) => setPriceOverride(e.target.value)}
          />
          <span className="suffix">€</span>
        </Field>
      </Section>
      <Section header="Note">
        <label className="field stack">
          <span className="sr-only">Note</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Es. sfumatura bassa, porta il figlio…" rows={3} />
        </label>
      </Section>

      {error && (
        <div className="warn" role="alert" style={{ background: 'color-mix(in srgb, var(--red) 14%, transparent)' }}>
          <IconWarning style={{ color: 'var(--red)' }} />
          <div>{error}</div>
        </div>
      )}
      <div className="sheet-pad">
        <button type="button" className="btn" onClick={save} disabled={saving}>
          {editing ? 'Salva modifiche' : 'Aggiungi appuntamento'}
        </button>
      </div>
    </Sheet>
  );
}
