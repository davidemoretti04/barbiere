import { describe, expect, it } from 'vitest';
import type { Appointment, Client, Expense } from '../db/types';
import {
  byAmountList,
  cancelledLists,
  completedList,
  expensesList,
  groupByDay,
  newClientsList,
  paymentBreakdown,
  serviceList,
  tipsList,
} from './statDetails';
import { computeKpis, periodRange } from './stats';

const d = (day: number, h = 10) => new Date(2026, 2, day, h).getTime(); // marzo 2026 (29/3 cambio d'ora)
let n = 0;
const appt = (p: Partial<Appointment> & { start: number }): Appointment => ({
  id: `a${n++}`,
  clientId: 'c',
  end: p.start + 1800000,
  services: [{ serviceId: 's1', name: 'Taglio', priceCents: 1800, durationMinutes: 30 }],
  status: 'completato',
  amountCents: 1800,
  tipCents: 0,
  notes: '',
  ...p,
});

const list = [
  appt({ start: d(2), amountCents: 1800, tipCents: 200, paymentMethod: 'contanti' }),
  appt({ start: d(2, 15), amountCents: 2500, paymentMethod: 'carta', services: [{ serviceId: 's2', name: 'Barba', priceCents: 2500, durationMinutes: 30 }] }),
  appt({ start: d(29, 9), amountCents: 1500 }),
  appt({ start: d(10), status: 'annullato' }),
  appt({ start: d(11), status: 'non_presentato' }),
  appt({ start: d(12), status: 'programmato' }),
  appt({ start: new Date(2026, 3, 1).getTime(), amountCents: 9999 }), // aprile: fuori
];
const march = periodRange('month', new Date(2026, 2, 15));

describe('dettaglio statistiche', () => {
  it('gli elenchi tornano con i numeri dei riquadri', () => {
    const k = computeKpis(list, [], [], march);
    const done = completedList(list, march);
    expect(done).toHaveLength(k.completedCount);
    expect(done.reduce((s, a) => s + a.amountCents, 0)).toBe(k.revenueCents);
    expect(tipsList(list, march).reduce((s, a) => s + a.tipCents, 0)).toBe(k.tipsCents);
    const c = cancelledLists(list, march);
    expect([c.cancelled.length, c.noShow.length]).toEqual([k.cancelledCount, k.noShowCount]);
  });

  it('ordinamenti', () => {
    expect(completedList(list, march).map((a) => a.start)).toEqual([d(29, 9), d(2, 15), d(2)]);
    expect(byAmountList(list, march).map((a) => a.amountCents)).toEqual([2500, 1800, 1500]);
  });

  it('per metodo di pagamento (mance incluse)', () => {
    expect(paymentBreakdown(completedList(list, march))).toEqual([
      { method: 'carta', label: 'Carta', count: 1, cents: 2500 },
      { method: 'contanti', label: 'Contanti', count: 1, cents: 2000 },
      { method: 'nd', label: 'Non indicato', count: 1, cents: 1500 },
    ]);
  });

  it('per servizio', () => {
    expect(serviceList(list, march, 's2')).toHaveLength(1);
    expect(serviceList(list, march, 's1')).toHaveLength(2);
  });

  it('raggruppa per giorno', () => {
    const g = groupByDay(completedList(list, march));
    expect(g.map((x) => [new Date(x.day).getDate(), x.items.length])).toEqual([
      [29, 1],
      [2, 2],
    ]);
  });

  it('nuovi clienti e spese del periodo', () => {
    const clients: Client[] = [
      { id: 'x', firstName: 'A', lastName: '', phone: '', notes: '', createdAt: d(5) },
      { id: 'y', firstName: 'B', lastName: '', phone: '', notes: '', createdAt: d(20) },
      { id: 'z', firstName: 'C', lastName: '', phone: '', notes: '', createdAt: new Date(2026, 1, 1).getTime() },
    ];
    expect(newClientsList(clients, march).map((c) => c.id)).toEqual(['y', 'x']);
    const exp: Expense[] = [
      { id: '1', date: '2026-03-01', category: 'Affitto', amountCents: 1, notes: '' },
      { id: '2', date: '2026-03-31', category: 'Prodotti', amountCents: 1, notes: '' },
      { id: '3', date: '2026-04-01', category: 'Prodotti', amountCents: 1, notes: '' },
    ];
    expect(expensesList(exp, march).map((e) => e.id)).toEqual(['2', '1']);
  });
});
