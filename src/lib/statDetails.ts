/** Elenchi di dettaglio per ogni statistica (tocco su un riquadro). Funzioni pure, testate. */
import type { Appointment, Cents, Client, Expense, PaymentMethod } from '../db/types';
import { completedIn, expensesIn, inRange, type DateRange } from './stats';

export type StatKind = 'revenue' | 'completed' | 'ticket' | 'tips' | 'newClients' | 'cancelled' | 'expenses' | 'profit' | 'service';

export const STAT_TITLES: Record<StatKind, string> = {
  revenue: 'Incasso',
  completed: 'Appuntamenti completati',
  ticket: 'Scontrino medio',
  tips: 'Mance',
  newClients: 'Nuovi clienti',
  cancelled: 'Annullati e assenti',
  expenses: 'Spese',
  profit: 'Utile',
  service: 'Servizio',
};

const byStartDesc = (a: Appointment, b: Appointment) => b.start - a.start;

export const completedList = (appts: Appointment[], r: DateRange) => completedIn(appts, r).sort(byStartDesc);

export const tipsList = (appts: Appointment[], r: DateRange) => completedList(appts, r).filter((a) => a.tipCents > 0);

/** Completati ordinati per importo, dal più alto. */
export const byAmountList = (appts: Appointment[], r: DateRange) =>
  completedIn(appts, r).sort((a, b) => b.amountCents - a.amountCents || b.start - a.start);

export function cancelledLists(appts: Appointment[], r: DateRange) {
  const inR = appts.filter((a) => inRange(a.start, r)).sort(byStartDesc);
  return {
    cancelled: inR.filter((a) => a.status === 'annullato'),
    noShow: inR.filter((a) => a.status === 'non_presentato'),
  };
}

export const newClientsList = (clients: Client[], r: DateRange) =>
  clients.filter((c) => inRange(c.createdAt, r)).sort((a, b) => b.createdAt - a.createdAt);

export const expensesList = (expenses: Expense[], r: DateRange) =>
  expensesIn(expenses, r).sort((a, b) => b.date.localeCompare(a.date));

/** Completati che contengono il servizio (per id, o per nome se l'id manca). */
export function serviceList(appts: Appointment[], r: DateRange, serviceKey: string) {
  return completedList(appts, r).filter((a) => a.services.some((s) => (s.serviceId || s.name) === serviceKey));
}

export interface PaymentRow {
  method: PaymentMethod | 'nd';
  label: string;
  count: number;
  cents: Cents;
}

/** Incassi (mance incluse) per metodo di pagamento. */
export function paymentBreakdown(list: Appointment[]): PaymentRow[] {
  const labels = { contanti: 'Contanti', carta: 'Carta', altro: 'Altro', nd: 'Non indicato' } as const;
  const map = new Map<PaymentRow['method'], PaymentRow>();
  for (const a of list) {
    const m = a.paymentMethod ?? 'nd';
    const row = map.get(m) ?? { method: m, label: labels[m], count: 0, cents: 0 };
    row.count++;
    row.cents += a.amountCents + a.tipCents;
    map.set(m, row);
  }
  return [...map.values()].sort((a, b) => b.cents - a.cents);
}

/** Raggruppa per giorno locale (chiave = mezzanotte), mantenendo l'ordine di ingresso. */
export function groupByDay<T extends { start: number }>(list: T[]): { day: number; items: T[] }[] {
  const out: { day: number; items: T[] }[] = [];
  for (const x of list) {
    const d = new Date(x.start);
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const last = out[out.length - 1];
    if (last && last.day === day) last.items.push(x);
    else out.push({ day, items: [x] });
  }
  return out;
}
