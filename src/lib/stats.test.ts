import { describe, expect, it } from 'vitest';
import type { Appointment, Client, Expense } from '../db/types';
import {
  clientStats,
  computeKpis,
  customRange,
  dayTotals,
  expensesByCategory,
  granularityFor,
  hourDistribution,
  inactiveClients,
  percentChange,
  periodRange,
  previousRange,
  revenueSeries,
  shiftRange,
  topClients,
  topServices,
  upcomingBirthdays,
  weekdayDistribution,
} from './stats';

const H = 3600_000;
const d = (y: number, m: number, day: number, h = 0, min = 0) => new Date(y, m - 1, day, h, min).getTime();

let n = 0;
function appt(p: Partial<Appointment> & { start: number }): Appointment {
  return {
    id: `a${n++}`,
    clientId: 'c1',
    end: p.start + 30 * 60000,
    services: [{ serviceId: 's1', name: 'Taglio', priceCents: 1800, durationMinutes: 30 }],
    status: 'completato',
    amountCents: 1800,
    tipCents: 0,
    notes: '',
    ...p,
  };
}
const client = (id: string, createdAt: number, extra: Partial<Client> = {}): Client => ({
  id,
  firstName: id.toUpperCase(),
  lastName: '',
  phone: '',
  notes: '',
  createdAt,
  ...extra,
});

describe('fuso orario dei test', () => {
  it('gira in Europe/Rome', () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('Europe/Rome');
    expect(new Date(2026, 6, 1).getTimezoneOffset()).toBe(-120);
    expect(new Date(2026, 0, 1).getTimezoneOffset()).toBe(-60);
  });
});

describe('periodi', () => {
  it('giorno del cambio ora: 25 ore a fine ottobre, 23 a fine marzo', () => {
    const oct = periodRange('day', new Date(2026, 9, 25, 12));
    expect(oct.end - oct.start).toBe(25 * H);
    const mar = periodRange('day', new Date(2026, 2, 29, 12));
    expect(mar.end - mar.start).toBe(23 * H);
  });

  it('settimana da lunedì', () => {
    const w = periodRange('week', new Date(2026, 10, 5)); // giovedì
    expect(new Date(w.start)).toEqual(new Date(2026, 10, 2));
    expect(new Date(w.end)).toEqual(new Date(2026, 10, 9));
  });

  it('periodo precedente e successivo', () => {
    const m = periodRange('month', new Date(2026, 2, 15));
    const prev = previousRange('month', m);
    expect(new Date(prev.start)).toEqual(new Date(2026, 1, 1));
    expect(new Date(prev.end)).toEqual(new Date(2026, 2, 1));
    const next = shiftRange('month', m, 1);
    expect(new Date(next.start)).toEqual(new Date(2026, 3, 1));
    expect(new Date(next.end)).toEqual(new Date(2026, 4, 1));

    const c = customRange(new Date(2026, 9, 20), new Date(2026, 9, 26)); // 7 giorni, attraversa il cambio ora
    expect(new Date(c.end)).toEqual(new Date(2026, 9, 27));
    const pc = previousRange('custom', c);
    expect(new Date(pc.start)).toEqual(new Date(2026, 9, 13));
    expect(pc.end).toBe(c.start);
  });

  it('granularità', () => {
    expect(granularityFor('day', periodRange('day', new Date()))).toBe('hour');
    expect(granularityFor('month', periodRange('month', new Date(2026, 0, 1)))).toBe('day');
    expect(granularityFor('year', periodRange('year', new Date(2026, 0, 1)))).toBe('month');
    expect(granularityFor('custom', customRange(new Date(2026, 0, 1), new Date(2026, 2, 31)))).toBe('week');
  });
});

describe('KPI', () => {
  const appts: Appointment[] = [
    appt({ start: d(2026, 3, 2, 9), amountCents: 1800, tipCents: 200 }),
    appt({ start: d(2026, 3, 15, 10), amountCents: 2500, clientId: 'c2' }),
    appt({ start: d(2026, 3, 29, 10), amountCents: 1500 }), // giorno del passaggio all'ora legale
    appt({ start: d(2026, 3, 20, 11), status: 'annullato' }),
    appt({ start: d(2026, 3, 21, 11), status: 'non_presentato' }),
    appt({ start: d(2026, 3, 22, 11), status: 'programmato' }),
    appt({ start: d(2026, 2, 27, 10), amountCents: 1000 }), // febbraio
    appt({ start: d(2026, 4, 1, 0, 0), amountCents: 9999 }), // primo istante di aprile: escluso
  ];
  const expenses: Expense[] = [
    { id: 'e1', date: '2026-03-01', category: 'Affitto', amountCents: 50000, notes: '' },
    { id: 'e2', date: '2026-03-31', category: 'Prodotti', amountCents: 3000, notes: '' },
    { id: 'e3', date: '2026-04-01', category: 'Prodotti', amountCents: 7000, notes: '' },
  ];
  const clients = [client('c1', d(2026, 2, 10)), client('c2', d(2026, 3, 14))];
  const march = periodRange('month', new Date(2026, 2, 10));

  it('calcola i valori del mese', () => {
    expect(computeKpis(appts, expenses, clients, march)).toEqual({
      revenueCents: 5800,
      completedCount: 3,
      averageTicketCents: 1933,
      tipsCents: 200,
      newClients: 1,
      cancelledCount: 1,
      noShowCount: 1,
      expensesCents: 53000,
      profitCents: 5800 + 200 - 53000,
    });
  });

  it('confronto con il periodo precedente', () => {
    const prev = computeKpis(appts, expenses, clients, previousRange('month', march));
    expect(prev.revenueCents).toBe(1000);
    expect(percentChange(5800, prev.revenueCents)).toBeCloseTo(480);
    expect(percentChange(0, 0)).toBe(0);
    expect(percentChange(5, 0)).toBeNull();
  });

  it('serie giornaliera con il giorno da 23 ore', () => {
    const s = revenueSeries(appts, march, 'day');
    expect(s).toHaveLength(31);
    expect(s[28].label).toBe('29/3');
    expect(s[28].revenueCents).toBe(1500);
    expect(s.reduce((t, p) => t + p.revenueCents, 0)).toBe(5800);
  });

  it('serie mensile per l’anno', () => {
    const s = revenueSeries(appts, periodRange('year', new Date(2026, 5, 1)), 'month');
    expect(s).toHaveLength(12);
    expect(s[1].revenueCents).toBe(1000);
    expect(s[2].revenueCents).toBe(5800);
    expect(s[3].revenueCents).toBe(9999);
    expect(s[0].label).toBe('gen');
  });

  it('serie oraria nel giorno da 25 ore', () => {
    const day = periodRange('day', new Date(2026, 9, 25));
    const late = appt({ start: d(2026, 10, 25, 20, 30), amountCents: 700 });
    const s = revenueSeries([late], day, 'hour');
    expect(s.find((p) => p.label === '20')?.revenueCents).toBe(700);
  });

  it('settimana del cambio ora: la domenica sera resta nella domenica', () => {
    const w = periodRange('week', new Date(2026, 9, 21));
    const sun = appt({ start: d(2026, 10, 25, 23, 30), amountCents: 100 });
    const mon = appt({ start: d(2026, 10, 26, 0, 30), amountCents: 200 });
    const s = revenueSeries([sun, mon], w, 'day');
    expect(s).toHaveLength(7);
    expect(s[6].revenueCents).toBe(100);
    expect(computeKpis([sun, mon], [], [], w).revenueCents).toBe(100);
  });

  it('serie settimanale allineata al lunedì', () => {
    const r = customRange(new Date(2026, 2, 4), new Date(2026, 2, 31));
    const s = revenueSeries(appts, r, 'week');
    expect(new Date(s[0].key)).toEqual(new Date(2026, 2, 2));
    expect(s.reduce((t, p) => t + p.revenueCents, 0)).toBe(5800 - 1800); // il 2/3 è fuori dal periodo
  });

  it('classifiche e distribuzioni', () => {
    const multi = [
      ...appts,
      appt({
        start: d(2026, 3, 10, 15),
        clientId: 'c2',
        amountCents: 2800,
        services: [
          { serviceId: 's1', name: 'Taglio', priceCents: 1800, durationMinutes: 30 },
          { serviceId: 's2', name: 'Barba', priceCents: 1000, durationMinutes: 20 },
        ],
      }),
    ];
    const ts = topServices(multi, march);
    expect(ts[0]).toMatchObject({ name: 'Taglio', count: 4 });
    expect(ts[1]).toMatchObject({ name: 'Barba', count: 1, revenueCents: 1000 });

    const tc = topClients(multi, clients, march);
    expect(tc[0]).toMatchObject({ id: 'c2', revenueCents: 5300, count: 2 });
    expect(tc[1]).toMatchObject({ id: 'c1', revenueCents: 3500, count: 2 });

    const wd = weekdayDistribution(multi, march);
    expect(wd.map((x) => x.label)).toEqual(['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']);
    expect(wd[0].count).toBe(1); // 2/3 lunedì
    expect(wd[1].count).toBe(1); // 10/3 martedì
    expect(wd[6].count).toBe(2); // 15/3 e 29/3 domenica

    const hd = hourDistribution(multi, march);
    expect(hd[0]).toEqual({ label: '09', count: 1 });
    expect(hd.find((x) => x.label === '10')?.count).toBe(2);
    expect(hd.at(-1)).toEqual({ label: '15', count: 1 });
  });

  it('spese per categoria', () => {
    expect(expensesByCategory(expenses, march)).toEqual([
      { category: 'Affitto', amountCents: 50000 },
      { category: 'Prodotti', amountCents: 3000 },
    ]);
  });
});

describe('clienti', () => {
  it('statistiche personali', () => {
    const list = [
      appt({ start: d(2026, 1, 1, 10), amountCents: 2000, tipCents: 500 }),
      appt({ start: d(2026, 1, 21, 10), amountCents: 2000 }),
      appt({ start: d(2026, 2, 10, 10), amountCents: 2000 }),
      appt({ start: d(2026, 2, 20, 10), status: 'annullato' }),
      appt({ start: d(2026, 3, 1, 10), status: 'programmato' }),
      appt({ start: d(2026, 1, 5, 10), clientId: 'altro' }),
    ];
    expect(clientStats(list, 'c1', d(2026, 2, 25))).toEqual({
      totalSpentCents: 6500,
      visits: 3,
      averageCents: 2167,
      lastVisit: d(2026, 2, 10, 10),
      averageGapDays: 20,
      nextAppointment: d(2026, 3, 1, 10),
    });
    expect(clientStats(list, 'nessuno').averageGapDays).toBeNull();
  });

  it('da ricontattare', () => {
    const now = d(2026, 11, 5, 12);
    const clients = [client('vecchio', 0), client('recente', 0), client('prenotato', 0), client('mai', 0)];
    const list = [
      appt({ clientId: 'vecchio', start: d(2026, 8, 1, 10) }),
      appt({ clientId: 'recente', start: d(2026, 10, 30, 10) }),
      appt({ clientId: 'prenotato', start: d(2026, 8, 1, 10) }),
      appt({ clientId: 'prenotato', start: d(2026, 11, 10, 10), status: 'programmato' }),
    ];
    const res = inactiveClients(clients, list, 6, now);
    expect(res.map((r) => r.client.id)).toEqual(['vecchio']);
    expect(res[0].weeksAgo).toBe(13);
  });

  it('prossimi compleanni, anche il 29 febbraio', () => {
    const now = d(2027, 2, 20, 9);
    const list = [
      client('oggi', 0, { birthday: '1990-02-20' }),
      client('bisestile', 0, { birthday: '2000-02-29' }),
      client('lontano', 0, { birthday: '1980-08-01' }),
      client('passato', 0, { birthday: '1985-02-10' }),
      client('senza', 0),
    ];
    const res = upcomingBirthdays(list, now, 60);
    expect(res.map((r) => [r.client.id, r.daysUntil, r.age])).toEqual([
      ['oggi', 0, 37],
      ['bisestile', 8, 27], // 2027 non è bisestile → 28/2
    ]);
  });
});

describe('totali del giorno', () => {
  it('previsto e incassato', () => {
    const day = new Date(2026, 10, 5);
    const list = [
      appt({ start: d(2026, 11, 5, 9), amountCents: 1800, tipCents: 200 }),
      appt({ start: d(2026, 11, 5, 10), amountCents: 2500, status: 'programmato' }),
      appt({ start: d(2026, 11, 5, 11), amountCents: 1000, status: 'annullato' }),
      appt({ start: d(2026, 11, 6, 9), amountCents: 1000 }),
    ];
    expect(dayTotals(list, day)).toEqual({ count: 2, expectedCents: 4300, collectedCents: 2000 });
  });
});
