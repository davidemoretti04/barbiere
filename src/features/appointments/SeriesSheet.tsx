import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { useFeedback } from '../../components/feedback-context';
import { IconCalendarPlus, IconCheck } from '../../components/Icons';
import { Sheet } from '../../components/Sheet';
import { Field, Row, Section } from '../../components/ui';
import { applySeriesUpdate, endSeriesFrom } from '../../db/actions';
import { db } from '../../db/db';
import { useClient, useServices } from '../../db/hooks';
import type { Appointment, AppointmentService } from '../../db/types';
import { useNow } from '../../hooks/useNow';
import { capitalize, clientName, durationLabel, fmt } from '../../lib/format';
import { newId } from '../../lib/id';
import { centsToInput, formatEuro, parseEuro } from '../../lib/money';
import { planSeriesUpdate, repeatLabel, REPEAT_COUNT_OPTIONS, REPEAT_WEEKS_OPTIONS } from '../../lib/recurrence';
import { atMinutes, fromDateKey, parseHM, toDateKey } from '../../lib/schedule';
import { navigate } from '../../router';
import { addToCalendar } from './calendar';

/** «Modifica ricorrenza»: cambia le impostazioni di tutti i prossimi appuntamenti di una serie. */
export function SeriesSheet({ seriesId, onClose, onOpenDetail }: { seriesId: string; onClose: () => void; onOpenDetail: (id: string) => void }) {
  const all = useLiveQuery(() => db.appointments.where('seriesId').equals(seriesId).sortBy('start'), [seriesId]);
  const now = useNow();
  if (!all) return null;
  const future = all.filter((a) => a.status === 'programmato' && a.end > now);
  const ref = future[0] ?? all[all.length - 1];
  if (!ref) {
    return (
      <Sheet title="Ricorrenza" onClose={onClose}>
        <p className="center muted">Questa serie non esiste più.</p>
      </Sheet>
    );
  }
  // la chiave fa ripartire il modulo se la serie viene modificata altrove
  return <SeriesEditor key={ref.id} all={all} future={future} next={ref} seriesId={seriesId} now={now} onClose={onClose} onOpenDetail={onOpenDetail} />;
}

function SeriesEditor({
  all,
  future,
  next,
  seriesId,
  now,
  onClose,
  onOpenDetail,
}: {
  all: Appointment[];
  future: Appointment[];
  next: Appointment;
  seriesId: string;
  now: number;
  onClose: () => void;
  onOpenDetail: (id: string) => void;
}) {
  const client = useClient(next.clientId) ?? undefined;
  const services = useServices();
  const { toast, confirm } = useFeedback();

  const wasForever = future.some((a) => a.openEnded);
  const [date, setDate] = useState(toDateKey(new Date(next.start)));
  const [time, setTime] = useState(fmt(next.start, 'HH:mm'));
  const [weeks, setWeeks] = useState(next.repeatWeeks ?? 1);
  const [count, setCount] = useState<number | 'sempre'>(wasForever ? 'sempre' : Math.max(1, future.length));
  const [selected, setSelected] = useState<AppointmentService[]>(next.services);
  const [duration, setDuration] = useState(String(Math.round((next.end - next.start) / 60000)));
  const [price, setPrice] = useState(centsToInput(next.amountCents));
  const [notes, setNotes] = useState(next.notes);
  const [error, setError] = useState('');

  const countOptions = useMemo(() => {
    const opts = [...REPEAT_COUNT_OPTIONS];
    if (!wasForever && !opts.includes(future.length) && future.length > 0) opts.push(future.length);
    return opts.sort((a, b) => a - b);
  }, [wasForever, future.length]);

  const active = (services ?? []).filter((s) => s.active).sort((a, b) => a.name.localeCompare(b.name, 'it'));
  const toggle = (s: { id: string; name: string; priceCents: number; durationMinutes: number }) => {
    const has = selected.some((x) => x.serviceId === s.id);
    const nextSel = has ? selected.filter((x) => x.serviceId !== s.id) : [...selected, { serviceId: s.id, name: s.name, priceCents: s.priceCents, durationMinutes: s.durationMinutes }];
    setSelected(nextSel);
    if (nextSel.length) {
      setDuration(String(nextSel.reduce((t, x) => t + x.durationMinutes, 0)));
      setPrice(centsToInput(nextSel.reduce((t, x) => t + x.priceCents, 0)));
    }
  };

  const startMs = date && time ? atMinutes(fromDateKey(date), parseHM(time)).getTime() : NaN;
  const dur = parseInt(duration, 10);
  const cents = parseEuro(price);
  const valid = Number.isFinite(startMs) && dur > 0 && dur <= 720 && cents !== null && cents >= 0;
  const preview = valid
    ? planSeriesUpdate(all, seriesId, now, { start: startMs, durationMinutes: dur, everyWeeks: weeks, count, services: selected, amountCents: cents ?? 0, notes: notes.trim() }, () => 'anteprima').add
    : [];

  async function save() {
    if (!valid) return setError('Controlla data, ora, durata e importo.');
    if (startMs < now) return setError('La nuova data del prossimo appuntamento è già passata.');
    const plan = planSeriesUpdate(all, seriesId, now, { start: startMs, durationMinutes: dur, everyWeeks: weeks, count, services: selected, amountCents: cents ?? 0, notes: notes.trim() }, newId);
    const undo = await applySeriesUpdate(seriesId, plan);
    toast({ message: 'Ricorrenza aggiornata', actionLabel: 'Annulla', onAction: () => void undo() });
    onClose();
  }

  async function stop() {
    const ok = await confirm({
      title: 'Terminare la ricorrenza?',
      message: `Verranno eliminati i ${future.length} appuntamenti futuri della serie. Quelli passati restano nello storico.`,
      confirmLabel: 'Termina la ricorrenza',
      destructive: true,
    });
    if (!ok) return;
    const undo = await endSeriesFrom(seriesId, next.start, 'delete');
    toast({ message: 'Ricorrenza terminata', actionLabel: 'Annulla', onAction: () => void undo() });
    onClose();
  }

  return (
    <Sheet
      title="Modifica ricorrenza"
      onClose={onClose}
      tall
      dismissable={false}
      left={
        <button type="button" className="nav-btn" onClick={onClose}>
          Annulla
        </button>
      }
      right={
        <button type="button" className="nav-btn bold" onClick={() => void save()} disabled={!valid}>
          Salva
        </button>
      }
    >
      <div className="hero">
        <button
          type="button"
          style={{ fontSize: 22, fontWeight: 700, color: 'var(--label)', minHeight: 44 }}
          onClick={() => {
            if (!client) return;
            onClose();
            navigate(`/clienti/${client.id}`);
          }}
        >
          {clientName(client)}
        </button>
        <p>
          ↻ {repeatLabel(next.repeatWeeks ?? 1)}
          {wasForever ? ' · senza fine' : ` · ${future.length} in programma`}
        </p>
      </div>

      <p className="section-footer" style={{ margin: '-4px 16px 16px', textAlign: 'center' }}>
        Le modifiche valgono per <b>tutti i prossimi appuntamenti</b> della serie. Quelli passati restano come sono.
      </p>

      <Section header="Prossimo appuntamento">
        <Field label="Data">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Ora">
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
      </Section>

      <Section header="Ogni quante settimane">
        <div className="field" style={{ minHeight: 52, paddingTop: 8, paddingBottom: 8 }}>
          <div className="chips" role="group" aria-label="Ogni quante settimane">
            {REPEAT_WEEKS_OPTIONS.map((w) => (
              <button key={w} type="button" className="chip" aria-pressed={weeks === w} onClick={() => setWeeks(w)}>
                {w === 1 ? 'Ogni sett.' : `${w} sett.`}
              </button>
            ))}
          </div>
        </div>
      </Section>

      <Section header="Quante volte, da qui in poi">
        <div className="field" style={{ minHeight: 52, paddingTop: 8, paddingBottom: 8 }}>
          <div className="chips" role="group" aria-label="Numero di appuntamenti">
            {countOptions.map((c) => (
              <button key={c} type="button" className="chip" aria-pressed={count === c} onClick={() => setCount(c)}>
                {c}
              </button>
            ))}
            <button type="button" className="chip" aria-pressed={count === 'sempre'} onClick={() => setCount('sempre')}>
              ∞ Sempre
            </button>
          </div>
        </div>
      </Section>

      <Section header="Servizi">
        {active.map((s) => {
          const on = selected.some((x) => x.serviceId === s.id);
          return (
            <button key={s.id} type="button" className="row" aria-pressed={on} onClick={() => toggle(s)}>
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
        <Field label="Durata">
          <input type="text" inputMode="numeric" pattern="[0-9]*" value={duration} onChange={(e) => setDuration(e.target.value.replace(/\D/g, ''))} />
          <span className="suffix">min</span>
        </Field>
        <Field label="Importo">
          <input type="text" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
          <span className="suffix">€</span>
        </Field>
      </Section>

      <Section header="Note">
        <label className="field stack">
          <span className="sr-only">Note</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Valgono per tutti i prossimi appuntamenti" />
        </label>
      </Section>

      {preview.length > 0 && (
        <Section header="Nuove date" footer={count === 'sempre' ? 'Si ripete senza fine: l’app aggiunge da sola le date future.' : undefined}>
          {preview.slice(0, 4).map((a, i) => (
            <Row key={i} title={capitalize(fmt(a.start, 'EEEE d MMMM yyyy'))} detail={fmt(a.start, 'HH:mm')} />
          ))}
          {preview.length > 4 && <Row title={<span className="muted">{count === 'sempre' ? 'e così via…' : `e altre ${preview.length - 4}`}</span>} />}
        </Section>
      )}

      {error && (
        <div className="field-error" role="alert" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}

      <div className="sheet-pad" style={{ display: 'grid', gap: 10, marginBottom: 24 }}>
        <button type="button" className="btn" onClick={() => void save()} disabled={!valid}>
          Salva modifiche
        </button>
        <button type="button" className="btn tinted" onClick={() => addToCalendar(future, client)} disabled={!future.length}>
          <IconCalendarPlus /> Aggiungi la serie al Calendario
        </button>
      </div>

      {future.length > 0 && (
        <Section header="In programma ora" footer="Tocca un appuntamento per modificarlo o spostarlo singolarmente.">
          {future.slice(0, 5).map((a) => (
            <Row key={a.id} title={capitalize(fmt(a.start, 'EEEE d MMMM'))} detail={fmt(a.start, 'HH:mm')} chevron onClick={() => onOpenDetail(a.id)} />
          ))}
        </Section>
      )}

      <Section>
        <button type="button" className="row destructive" onClick={() => void stop()}>
          Termina la ricorrenza
        </button>
      </Section>
    </Sheet>
  );
}
