/**
 * Aggregazioni statistiche: tutte funzioni pure, testate in stats.test.ts.
 * Gli intervalli sono semiaperti [start, end) in epoch ms; i "giorni" sono giorni di calendario
 * locali (Europe/Rome sul telefono), quindi le giornate di cambio ora durano 23 o 25 ore.
 */
import {
  addDays,
  addHours,
  addMonths,
  addWeeks,
  addYears,
  differenceInCalendarDays,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from 'date-fns';
import type { Appointment, Cents, Client, Expense } from '../db/types';
import { fmt } from './format';
import { fromDateKey, isoWeekday } from './schedule';

export interface DateRange {
  start: number;
  end: number;
}

export type PeriodKind = 'day' | 'week' | 'month' | 'year' | 'custom';

const WEEK = { weekStartsOn: 1 as const };

export function periodRange(kind: Exclude<PeriodKind, 'custom'>, anchor: Date): DateRange {
  switch (kind) {
    case 'day': {
      const s = startOfDay(anchor);
      return { start: s.getTime(), end: addDays(s, 1).getTime() };
    }
    case 'week': {
      const s = startOfWeek(anchor, WEEK);
      return { start: s.getTime(), end: addWeeks(s, 1).getTime() };
    }
    case 'month': {
      const s = startOfMonth(anchor);
      return { start: s.getTime(), end: addMonths(s, 1).getTime() };
    }
    case 'year': {
      const s = startOfYear(anchor);
      return { start: s.getTime(), end: addYears(s, 1).getTime() };
    }
  }
}

/** Intervallo personalizzato da giorno a giorno (entrambi inclusi). */
export function customRange(from: Date, to: Date): DateRange {
  const a = startOfDay(from <= to ? from : to);
  const b = startOfDay(from <= to ? to : from);
  return { start: a.getTime(), end: addDays(b, 1).getTime() };
}

/** Periodo precedente della stessa lunghezza "di calendario". */
export function previousRange(kind: PeriodKind, range: DateRange): DateRange {
  const s = new Date(range.start);
  switch (kind) {
    case 'day':
      return { start: addDays(s, -1).getTime(), end: range.start };
    case 'week':
      return { start: addWeeks(s, -1).getTime(), end: range.start };
    case 'month':
      return { start: addMonths(s, -1).getTime(), end: range.start };
    case 'year':
      return { start: addYears(s, -1).getTime(), end: range.start };
    case 'custom': {
      const days = differenceInCalendarDays(new Date(range.end), s);
      return { start: addDays(s, -days).getTime(), end: range.start };
    }
  }
}

/** Sposta il periodo avanti (+1) o indietro (-1). */
export function shiftRange(kind: PeriodKind, range: DateRange, dir: 1 | -1): DateRange {
  if (dir === -1) return previousRange(kind, range);
  const e = new Date(range.end);
  switch (kind) {
    case 'day':
      return { start: range.end, end: addDays(e, 1).getTime() };
    case 'week':
      return { start: range.end, end: addWeeks(e, 1).getTime() };
    case 'month':
      return { start: range.end, end: addMonths(e, 1).getTime() };
    case 'year':
      return { start: range.end, end: addYears(e, 1).getTime() };
    case 'custom': {
      const days = differenceInCalendarDays(e, new Date(range.start));
      return { start: range.end, end: addDays(e, days).getTime() };
    }
  }
}

export const inRange = (t: number, r: DateRange) => t >= r.start && t < r.end;

export const completedIn = (appts: Appointment[], r: DateRange) =>
  appts.filter((a) => a.status === 'completato' && inRange(a.start, r));

export function expensesIn(expenses: Expense[], r: DateRange): Expense[] {
  return expenses.filter((e) => inRange(fromDateKey(e.date).getTime(), r));
}

export interface Kpis {
  revenueCents: Cents;
  completedCount: number;
  averageTicketCents: Cents;
  tipsCents: Cents;
  newClients: number;
  cancelledCount: number;
  noShowCount: number;
  expensesCents: Cents;
  /** Utile = incassi + mance − spese */
  profitCents: Cents;
}

export function computeKpis(
  appts: Appointment[],
  expenses: Expense[],
  clients: Client[],
  r: DateRange,
): Kpis {
  let revenue = 0;
  let tips = 0;
  let completed = 0;
  let cancelled = 0;
  let noShow = 0;
  for (const a of appts) {
    if (!inRange(a.start, r)) continue;
    if (a.status === 'completato') {
      completed++;
      revenue += a.amountCents;
      tips += a.tipCents;
    } else if (a.status === 'annullato') cancelled++;
    else if (a.status === 'non_presentato') noShow++;
  }
  const exp = expensesIn(expenses, r).reduce((s, e) => s + e.amountCents, 0);
  return {
    revenueCents: revenue,
    completedCount: completed,
    averageTicketCents: completed ? Math.round(revenue / completed) : 0,
    tipsCents: tips,
    newClients: clients.filter((c) => inRange(c.createdAt, r)).length,
    cancelledCount: cancelled,
    noShowCount: noShow,
    expensesCents: exp,
    profitCents: revenue + tips - exp,
  };
}

/** Variazione percentuale; null se il periodo precedente è zero. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export type Granularity = 'hour' | 'day' | 'week' | 'month';

export function granularityFor(kind: PeriodKind, r: DateRange): Granularity {
  if (kind === 'day') return 'hour';
  if (kind === 'year') return 'month';
  const days = differenceInCalendarDays(new Date(r.end), new Date(r.start));
  if (days <= 1) return 'hour';
  if (days <= 31) return 'day';
  if (days <= 120) return 'week';
  return 'month';
}

export interface SeriesPoint {
  key: number;
  label: string;
  revenueCents: Cents;
  tipsCents: Cents;
  count: number;
}

/** Andamento incassi a intervalli regolari (ore, giorni, settimane o mesi di calendario). */
export function revenueSeries(appts: Appointment[], r: DateRange, g: Granularity): SeriesPoint[] {
  const points: SeriesPoint[] = [];
  let cursor = new Date(r.start);
  if (g === 'week') cursor = startOfWeek(cursor, WEEK);
  if (g === 'month') cursor = startOfMonth(cursor);
  const next = (d: Date) =>
    g === 'hour' ? addHours(d, 1) : g === 'day' ? addDays(d, 1) : g === 'week' ? addWeeks(d, 1) : addMonths(d, 1);
  const label = (d: Date) =>
    g === 'hour' ? fmt(d, 'HH') : g === 'day' ? fmt(d, 'd/M') : g === 'week' ? fmt(d, 'd MMM') : fmt(d, 'MMM');
  let guard = 0;
  while (cursor.getTime() < r.end && guard++ < 1000) {
    points.push({ key: cursor.getTime(), label: label(cursor), revenueCents: 0, tipsCents: 0, count: 0 });
    cursor = next(cursor);
  }
  for (const a of completedIn(appts, r)) {
    // ultimo bucket che inizia prima dell'appuntamento
    let lo = 0;
    let hi = points.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (points[mid].key <= a.start) lo = mid;
      else hi = mid - 1;
    }
    const p = points[lo];
    if (!p) continue;
    p.revenueCents += a.amountCents;
    p.tipsCents += a.tipCents;
    p.count++;
  }
  if (g === 'hour') {
    // mostra solo le ore utili (default 8–20, allargate se ci sono appuntamenti fuori)
    const withData = points.filter((p) => p.count > 0).map((p) => new Date(p.key).getHours());
    const from = Math.min(8, ...withData);
    const to = Math.max(20, ...withData);
    return points.filter((p) => {
      const h = new Date(p.key).getHours();
      return h >= from && h <= to;
    });
  }
  return points;
}

export interface RankItem {
  id: string;
  name: string;
  count: number;
  revenueCents: Cents;
}

export function topServices(appts: Appointment[], r: DateRange, limit = 5): RankItem[] {
  const map = new Map<string, RankItem>();
  for (const a of completedIn(appts, r)) {
    for (const s of a.services) {
      const key = s.serviceId || s.name;
      const it = map.get(key) ?? { id: key, name: s.name, count: 0, revenueCents: 0 };
      it.count++;
      it.revenueCents += s.priceCents;
      map.set(key, it);
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count || b.revenueCents - a.revenueCents).slice(0, limit);
}

export function topClients(appts: Appointment[], clients: Client[], r: DateRange, limit = 5): RankItem[] {
  const names = new Map(clients.map((c) => [c.id, [c.firstName, c.lastName].filter(Boolean).join(' ')]));
  const map = new Map<string, RankItem>();
  for (const a of completedIn(appts, r)) {
    const it = map.get(a.clientId) ?? {
      id: a.clientId,
      name: names.get(a.clientId) || 'Cliente eliminato',
      count: 0,
      revenueCents: 0,
    };
    it.count++;
    it.revenueCents += a.amountCents + a.tipCents;
    map.set(a.clientId, it);
  }
  return [...map.values()].sort((a, b) => b.revenueCents - a.revenueCents || b.count - a.count).slice(0, limit);
}

const WEEKDAY_SHORT = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

/** Appuntamenti completati per giorno della settimana (lunedì per primo). */
export function weekdayDistribution(appts: Appointment[], r: DateRange) {
  const counts = WEEKDAY_SHORT.map((label) => ({ label, count: 0, revenueCents: 0 }));
  for (const a of completedIn(appts, r)) {
    const c = counts[isoWeekday(new Date(a.start)) - 1];
    c.count++;
    c.revenueCents += a.amountCents;
  }
  return counts;
}

/** Appuntamenti completati per ora di inizio (ora locale). */
export function hourDistribution(appts: Appointment[], r: DateRange) {
  const counts = new Array(24).fill(0) as number[];
  for (const a of completedIn(appts, r)) counts[new Date(a.start).getHours()]++;
  const used = counts.map((c, h) => (c ? h : -1)).filter((h) => h >= 0);
  if (!used.length) return [];
  const from = Math.min(...used);
  const to = Math.max(...used);
  return counts.slice(from, to + 1).map((count, i) => ({ label: `${String(from + i).padStart(2, '0')}`, count }));
}

export interface ClientStats {
  totalSpentCents: Cents;
  visits: number;
  averageCents: Cents;
  lastVisit: number | null;
  /** Giorni medi tra una visita e la successiva (null se meno di 2 visite). */
  averageGapDays: number | null;
  nextAppointment: number | null;
}

export function clientStats(appts: Appointment[], clientId: string, now: number = Date.now()): ClientStats {
  const mine = appts.filter((a) => a.clientId === clientId);
  const done = mine.filter((a) => a.status === 'completato').sort((a, b) => a.start - b.start);
  const total = done.reduce((s, a) => s + a.amountCents + a.tipCents, 0);
  let gap: number | null = null;
  if (done.length >= 2) {
    const days = differenceInCalendarDays(new Date(done[done.length - 1].start), new Date(done[0].start));
    gap = Math.round((days / (done.length - 1)) * 10) / 10;
  }
  const upcoming = mine
    .filter((a) => a.status === 'programmato' && a.start >= now)
    .sort((a, b) => a.start - b.start)[0];
  return {
    totalSpentCents: total,
    visits: done.length,
    averageCents: done.length ? Math.round(total / done.length) : 0,
    lastVisit: done.length ? done[done.length - 1].start : null,
    averageGapDays: gap,
    nextAppointment: upcoming ? upcoming.start : null,
  };
}

export interface InactiveClient {
  client: Client;
  lastVisit: number;
  weeksAgo: number;
}

/**
 * Clienti da ricontattare: hanno almeno una visita completata, l'ultima più vecchia di `weeks`
 * settimane, e nessun appuntamento futuro già programmato.
 */
export function inactiveClients(
  clients: Client[],
  appts: Appointment[],
  weeks: number,
  now: number = Date.now(),
): InactiveClient[] {
  const last = new Map<string, number>();
  const hasFuture = new Set<string>();
  for (const a of appts) {
    if (a.status === 'completato') last.set(a.clientId, Math.max(last.get(a.clientId) ?? 0, a.start));
    if (a.status === 'programmato' && a.start >= now) hasFuture.add(a.clientId);
  }
  const threshold = addWeeks(new Date(now), -weeks).getTime();
  const res: InactiveClient[] = [];
  for (const c of clients) {
    const l = last.get(c.id);
    if (l === undefined || l >= threshold || hasFuture.has(c.id)) continue;
    res.push({ client: c, lastVisit: l, weeksAgo: Math.floor(differenceInCalendarDays(new Date(now), new Date(l)) / 7) });
  }
  return res.sort((a, b) => a.lastVisit - b.lastVisit);
}

export interface UpcomingBirthday {
  client: Client;
  date: Date;
  daysUntil: number;
  /** Età che compirà (se l'anno è noto). */
  age: number | null;
}

/** Prossimi compleanni nei prossimi `withinDays` giorni (oggi incluso). 29/2 → 28/2 negli anni non bisestili. */
export function upcomingBirthdays(clients: Client[], now: number = Date.now(), withinDays = 60): UpcomingBirthday[] {
  const today = startOfDay(new Date(now));
  const res: UpcomingBirthday[] = [];
  for (const c of clients) {
    if (!c.birthday || !/^\d{4}-\d{2}-\d{2}$/.test(c.birthday)) continue;
    const [y, m, d] = c.birthday.split('-').map(Number);
    const make = (year: number) => {
      const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
      return new Date(year, m - 1, m === 2 && d === 29 && !isLeap ? 28 : d);
    };
    let next = make(today.getFullYear());
    if (next < today) next = make(today.getFullYear() + 1);
    const days = differenceInCalendarDays(next, today);
    if (days > withinDays) continue;
    res.push({ client: c, date: next, daysUntil: days, age: y > 1900 ? next.getFullYear() - y : null });
  }
  return res.sort((a, b) => a.daysUntil - b.daysUntil);
}

export interface DayTotals {
  count: number;
  expectedCents: Cents;
  collectedCents: Cents;
}

/** Totali di una giornata: previsto = programmati + completati; incassato = completati (mance incluse). */
export function dayTotals(appts: Appointment[], day: Date): DayTotals {
  const r = periodRange('day', day);
  let count = 0;
  let expected = 0;
  let collected = 0;
  for (const a of appts) {
    if (!inRange(a.start, r)) continue;
    if (a.status === 'programmato' || a.status === 'completato') {
      count++;
      expected += a.amountCents;
    }
    if (a.status === 'completato') collected += a.amountCents + a.tipCents;
  }
  return { count, expectedCents: expected, collectedCents: collected };
}

/** Riepilogo mensile delle spese per categoria. */
export function expensesByCategory(expenses: Expense[], r: DateRange) {
  const map = new Map<string, Cents>();
  for (const e of expensesIn(expenses, r)) map.set(e.category, (map.get(e.category) ?? 0) + e.amountCents);
  return [...map.entries()].map(([category, amountCents]) => ({ category, amountCents })).sort((a, b) => b.amountCents - a.amountCents);
}
