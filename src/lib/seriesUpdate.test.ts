import { describe, expect, it } from 'vitest';
import type { Appointment } from '../db/types';
import { buildSeries, openEndedCount, planSeriesUpdate } from './recurrence';

const first: Appointment = {
  id: 's0',
  clientId: 'c',
  start: new Date(2026, 9, 6, 10, 0).getTime(),
  end: new Date(2026, 9, 6, 10, 30).getTime(),
  services: [{ serviceId: 't', name: 'Taglio', priceCents: 1800, durationMinutes: 30 }],
  status: 'programmato',
  amountCents: 1800,
  tipCents: 0,
  notes: '',
};
let n = 0;
const mk = () => `n${n++}`;

describe('modifica di una serie', () => {
  const series = buildSeries(first, 3, 6, mk, 'S');
  // il primo è già stato fatto e incassato
  series[0] = { ...series[0], status: 'completato', tipCents: 200, paymentMethod: 'contanti' };
  const now = series[0].end + 1000;
  const barba = [{ serviceId: 'b', name: 'Taglio + barba', priceCents: 2500, durationMinutes: 45 }];

  it('sostituisce solo i futuri in programma, con nuova ora, intervallo e servizi', () => {
    const newStart = new Date(2026, 9, 29, 15, 30).getTime(); // giovedì alle 15:30
    const plan = planSeriesUpdate(series, 'S', now, { start: newStart, durationMinutes: 45, everyWeeks: 2, count: 4, services: barba, amountCents: 2500, notes: 'nuovo' }, mk);
    expect(plan.removeIds).toEqual(series.slice(1).map((a) => a.id));
    expect(plan.add).toHaveLength(4);
    expect(plan.add.map((a) => new Date(a.start).toString().slice(0, 21))).toEqual([
      'Thu Oct 29 2026 15:30',
      'Thu Nov 12 2026 15:30',
      'Thu Nov 26 2026 15:30',
      'Thu Dec 10 2026 15:30',
    ]);
    expect(plan.add.every((a) => a.seriesId === 'S' && a.repeatWeeks === 2 && a.end - a.start === 45 * 60000)).toBe(true);
    expect(plan.add.every((a) => a.amountCents === 2500 && a.services[0].name === 'Taglio + barba' && a.status === 'programmato')).toBe(true);
    expect(plan.add.some((a) => a.paymentMethod || a.tipCents)).toBe(false);
  });

  it('può diventare «Sempre» o tornare a numero fisso', () => {
    const toForever = planSeriesUpdate(series, 'S', now, { start: series[1].start, durationMinutes: 30, everyWeeks: 4, count: 'sempre', services: first.services, amountCents: 1800, notes: '' }, mk);
    expect(toForever.add).toHaveLength(openEndedCount(4));
    expect(toForever.add.every((a) => a.openEnded)).toBe(true);
    const back = planSeriesUpdate(toForever.add, 'S', now, { start: toForever.add[0].start, durationMinutes: 30, everyWeeks: 4, count: 3, services: first.services, amountCents: 1800, notes: '' }, mk);
    expect(back.add).toHaveLength(3);
    expect(back.add.some((a) => a.openEnded)).toBe(false);
  });
});
