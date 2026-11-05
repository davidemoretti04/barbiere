/** Appuntamenti ricorrenti per i clienti abituali (es. "ogni 3 settimane"). Funzioni pure, testate. */
import { addWeeks } from 'date-fns';
import type { Appointment, Settings } from '../db/types';
import { findOverlaps } from './overlap';
import { isWithinWorkingHours } from './schedule';

export const REPEAT_WEEKS_OPTIONS = [1, 2, 3, 4, 5, 6, 8];
export const REPEAT_COUNT_OPTIONS = [4, 6, 8, 12];

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
