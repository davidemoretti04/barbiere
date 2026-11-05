import type { Appointment } from '../db/types';

export interface Interval {
  start: number;
  end: number;
}

/** Due intervalli [start, end) si sovrappongono se uno inizia prima che l'altro finisca. */
export function intervalsOverlap(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * Appuntamenti attivi (programmati o completati) che si sovrappongono al candidato.
 * Gli annullati e i non presentati non occupano l'agenda. `excludeId` esclude l'appuntamento in modifica.
 */
export function findOverlaps(
  candidate: Interval,
  appointments: Appointment[],
  excludeId?: string,
): Appointment[] {
  return appointments.filter(
    (a) =>
      a.id !== excludeId &&
      (a.status === 'programmato' || a.status === 'completato') &&
      intervalsOverlap(candidate, a),
  );
}

/**
 * Disposizione in colonne per la vista giorno: gli appuntamenti sovrapposti vengono affiancati.
 * Ritorna per ogni id la colonna e il numero di colonne del suo gruppo.
 */
export function layoutColumns<T extends Interval & { id: string }>(
  items: T[],
): Map<string, { col: number; cols: number }> {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const result = new Map<string, { col: number; cols: number }>();
  let group: { item: T; col: number }[] = [];
  let groupEnd = -Infinity;
  const flush = () => {
    const cols = group.reduce((m, g) => Math.max(m, g.col + 1), 0);
    for (const g of group) result.set(g.item.id, { col: g.col, cols });
    group = [];
  };
  for (const item of sorted) {
    if (item.start >= groupEnd && group.length) {
      flush();
      groupEnd = -Infinity;
    }
    const used = new Set(group.filter((g) => g.item.end > item.start).map((g) => g.col));
    let col = 0;
    while (used.has(col)) col++;
    group.push({ item, col });
    groupEnd = Math.max(groupEnd, item.end);
  }
  if (group.length) flush();
  return result;
}
