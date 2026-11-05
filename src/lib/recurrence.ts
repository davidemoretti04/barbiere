/** Appuntamenti ricorrenti per i clienti abituali (es. "ogni 3 settimane"). Funzioni pure, testate. */
import { addWeeks } from 'date-fns';
import type { Appointment, AppointmentService, Client, Settings } from '../db/types';
import { findOverlaps } from './overlap';
import { isWithinWorkingHours } from './schedule';

export const REPEAT_WEEKS_OPTIONS = [1, 2, 3, 4, 5, 6, 8];
export const REPEAT_COUNT_OPTIONS = [4, 6, 8, 12];
/** Serie «Sempre»: quante settimane di appuntamenti futuri tenere sempre pronte. */
export const OPEN_ENDED_HORIZON_WEEKS = 26;

/** Numero di occorrenze iniziali di una serie «Sempre» (circa 6 mesi). */
export const openEndedCount = (everyWeeks: number) => Math.floor(OPEN_ENDED_HORIZON_WEEKS / everyWeeks) + 1;

/**
 * Crea le occorrenze della serie a partire dal primo appuntamento: stessa ora locale ogni N settimane
 * (anche a cavallo del cambio d'ora), stessi servizi e importo previsto.
 */
export function buildSeries(
  first: Appointment,
  everyWeeks: number,
  count: number,
  makeId: () => string,
  seriesId: string,
  openEnded = false,
): Appointment[] {
  const duration = first.end - first.start;
  return Array.from({ length: Math.max(1, count) }, (_, i) => {
    const start = addWeeks(new Date(first.start), i * everyWeeks).getTime();
    return {
      ...first,
      id: i === 0 ? first.id : makeId(),
      start,
      end: start + duration,
      status: 'programmato' as const,
      tipCents: 0,
      seriesId,
      repeatWeeks: everyWeeks,
      ...(openEnded ? { openEnded: true } : {}),
    };
  });
}

export interface OccurrenceIssue {
  appointment: Appointment;
  overlap: boolean;
  outsideHours: boolean;
}

/** Occorrenze che si sovrappongono ad altri appuntamenti o cadono fuori orario / in chiusura. */
export function seriesIssues(
  occurrences: Appointment[],
  existing: Appointment[],
  settings: Pick<Settings, 'closures' | 'workingHours'>,
): OccurrenceIssue[] {
  const res: OccurrenceIssue[] = [];
  for (const o of occurrences) {
    const overlap = findOverlaps(o, existing, o.id).some((x) => x.seriesId !== o.seriesId || !o.seriesId);
    const outsideHours = !isWithinWorkingHours(o.start, o.end, settings);
    if (overlap || outsideHours) res.push({ appointment: o, overlap, outsideHours });
  }
  return res;
}

/** Intervallo suggerito in settimane a partire dalla frequenza media del cliente. */
export function suggestedRepeatWeeks(averageGapDays: number | null): number | null {
  if (averageGapDays === null || averageGapDays <= 0) return null;
  return Math.min(12, Math.max(1, Math.round(averageGapDays / 7)));
}

/** Appuntamenti della stessa serie ancora programmati dalla data indicata in poi (lui compreso). */
export function seriesFrom(all: Appointment[], a: Appointment): Appointment[] {
  if (!a.seriesId) return [a];
  return all
    .filter((x) => x.seriesId === a.seriesId && x.start >= a.start && x.status === 'programmato')
    .sort((x, y) => x.start - y.start);
}

export function repeatLabel(weeks: number): string {
  return weeks === 1 ? 'Ogni settimana' : `Ogni ${weeks} settimane`;
}

export interface RecurringClient {
  client: Client;
  repeatWeeks: number;
  next: Appointment;
  last: Appointment;
  /** Appuntamenti della serie ancora in programma. */
  remaining: number;
  /** Serie «Sempre» (senza fine). */
  openEnded: boolean;
}

/** Clienti con appuntamenti ricorrenti ancora in programma, dal prossimo appuntamento più vicino. */
export function recurringClients(clients: Client[], appts: Appointment[], now: number): RecurringClient[] {
  const byClient = new Map<string, Appointment[]>();
  for (const a of appts) {
    if (!a.seriesId || a.status !== 'programmato' || a.end <= now) continue;
    byClient.set(a.clientId, [...(byClient.get(a.clientId) ?? []), a]);
  }
  const res: RecurringClient[] = [];
  for (const c of clients) {
    const list = byClient.get(c.id);
    if (!list?.length) continue;
    list.sort((x, y) => x.start - y.start);
    res.push({
      client: c,
      repeatWeeks: list[0].repeatWeeks ?? 1,
      next: list[0],
      last: list[list.length - 1],
      remaining: list.length,
      openEnded: list.some((a) => a.openEnded),
    });
  }
  return res.sort((a, b) => a.next.start - b.next.start);
}

/**
 * Serie «Sempre»: aggiunge le date mancanti perché ci siano sempre appuntamenti fino a
 * `now + horizonWeeks`. Si ferma se l'ultima occorrenza non è più «Sempre» o è stata annullata.
 * Ritorna solo gli appuntamenti nuovi da salvare.
 */
export function extendOpenSeries(
  appts: Appointment[],
  now: number,
  makeId: () => string,
  horizonWeeks = OPEN_ENDED_HORIZON_WEEKS,
): Appointment[] {
  // (le date si calcolano sempre dall'ultima occorrenza esistente)
  const bySeries = new Map<string, Appointment[]>();
  for (const a of appts) if (a.seriesId) bySeries.set(a.seriesId, [...(bySeries.get(a.seriesId) ?? []), a]);
  const until = addWeeks(new Date(now), horizonWeeks).getTime();
  const out: Appointment[] = [];
  for (const list of bySeries.values()) {
    const last = list.reduce((m, a) => (a.start > m.start ? a : m));
    // si ferma solo se la serie non è più «Sempre» (Termina la ricorrenza / «questo e i successivi»);
    // un singolo appuntamento annullato, anche l'ultimo, non la interrompe
    if (!last.openEnded) continue;
    const weeks = last.repeatWeeks ?? 1;
    const duration = last.end - last.start;
    for (let k = 1; ; k++) {
      const start = addWeeks(new Date(last.start), k * weeks).getTime();
      if (start > until) break;
      out.push({
        ...last,
        id: makeId(),
        start,
        end: start + duration,
        status: 'programmato',
        tipCents: 0,
        paymentMethod: undefined,
      });
    }
  }
  for (const a of out) if (a.paymentMethod === undefined) delete a.paymentMethod;
  return out;
}

export interface SeriesChanges {
  /** Nuova data/ora del prossimo appuntamento della serie. */
  start: number;
  durationMinutes: number;
  everyWeeks: number;
  /** Numero di appuntamenti da qui in poi, oppure «Sempre». */
  count: number | 'sempre';
  services: AppointmentService[];
  amountCents: number;
  notes: string;
}

/**
 * Modifica di una serie: gli appuntamenti futuri ancora in programma vengono sostituiti da una
 * nuova sequenza (stesso seriesId) con le nuove impostazioni. Passati, completati e annullati restano.
 */
export function planSeriesUpdate(
  all: Appointment[],
  seriesId: string,
  now: number,
  ch: SeriesChanges,
  makeId: () => string,
): { removeIds: string[]; add: Appointment[] } {
  const series = all.filter((a) => a.seriesId === seriesId).sort((a, b) => a.start - b.start);
  if (!series.length) return { removeIds: [], add: [] };
  const future = series.filter((a) => a.status === 'programmato' && a.end > now);
  const base = future[0] ?? series[series.length - 1];
  const forever = ch.count === 'sempre';
  const n = forever ? openEndedCount(ch.everyWeeks) : Math.max(1, ch.count as number);
  const first: Appointment = {
    ...base,
    id: makeId(),
    start: ch.start,
    end: ch.start + ch.durationMinutes * 60000,
    services: ch.services,
    amountCents: ch.amountCents,
    notes: ch.notes,
    status: 'programmato',
    tipCents: 0,
  };
  delete first.paymentMethod;
  delete first.openEnded;
  return { removeIds: future.map((a) => a.id), add: buildSeries(first, ch.everyWeeks, n, makeId, seriesId, forever) };
}
