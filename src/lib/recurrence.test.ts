import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type Appointment } from '../db/types';
import { parseBackup, serializeBackup, createBackup } from './backup';
import { buildSeries, recurringClients, repeatLabel, seriesFrom, seriesIssues, suggestedRepeatWeeks } from './recurrence';

const base: Appointment = {
  id: 'first',
  clientId: 'c1',
  start: new Date(2026, 9, 6, 10, 0).getTime(), // martedì 6/10/2026 10:00 (ora legale)
  end: new Date(2026, 9, 6, 10, 30).getTime(),
  services: [{ serviceId: 's', name: 'Taglio', priceCents: 1800, durationMinutes: 30 }],
  status: 'programmato',
  amountCents: 1800,
  tipCents: 0,
  notes: 'sfumatura',
};

let k = 0;
const mk = () => `occ-${k++}`;

describe('appuntamenti ricorrenti', () => {
  const series = buildSeries(base, 3, 4, mk, 'S1');

  it('stessa ora locale ogni 3 settimane, anche dopo il cambio d’ora', () => {
    expect(series).toHaveLength(4);
    expect(series.map((a) => new Date(a.start).toString().slice(0, 21))).toEqual([
      'Tue Oct 06 2026 10:00',
      'Tue Oct 27 2026 10:00', // dopo il 25/10 (ora solare)
      'Tue Nov 17 2026 10:00',
      'Tue Dec 08 2026 10:00',
    ]);
    expect(series.every((a) => a.end - a.start === 30 * 60000)).toBe(true);
  });

  it('copia servizi, note e importo; assegna serie e id nuovi', () => {
    expect(series[0].id).toBe('first');
    expect(new Set(series.map((a) => a.id)).size).toBe(4);
    expect(series.every((a) => a.seriesId === 'S1' && a.repeatWeeks === 3)).toBe(true);
    expect(series.every((a) => a.amountCents === 1800 && a.notes === 'sfumatura' && a.status === 'programmato')).toBe(true);
  });

  it('segnala sovrapposizioni e giorni di chiusura', () => {
    const other: Appointment = { ...base, id: 'x', clientId: 'c2', start: series[2].start + 15 * 60000, end: series[2].end + 15 * 60000 };
    const settings = { ...DEFAULT_SETTINGS, closures: [{ id: 'f', from: '2026-12-07', to: '2026-12-12', label: 'Ferie' }] };
    const issues = seriesIssues(series, [other, ...series], settings);
    expect(issues.map((i) => [i.appointment.id, i.overlap, i.outsideHours])).toEqual([
      [series[2].id, true, false],
      [series[3].id, false, true],
    ]);
  });

  it('“questo e i successivi” prende solo i programmati della serie da quella data', () => {
    const all = [...series.map((a, i) => (i === 0 ? { ...a, status: 'completato' as const } : a)), { ...base, id: 'altro' }];
    expect(seriesFrom(all, series[1]).map((a) => a.id)).toEqual([series[1].id, series[2].id, series[3].id]);
    expect(seriesFrom(all, { ...base, id: 'solo' })).toHaveLength(1);
  });

  it('intervallo suggerito dalla frequenza del cliente', () => {
    expect(suggestedRepeatWeeks(20)).toBe(3);
    expect(suggestedRepeatWeeks(4)).toBe(1);
    expect(suggestedRepeatWeeks(200)).toBe(12);
    expect(suggestedRepeatWeeks(null)).toBeNull();
    expect(repeatLabel(1)).toBe('Ogni settimana');
    expect(repeatLabel(3)).toBe('Ogni 3 settimane');
  });

  it('la serie sopravvive al backup', () => {
    const text = serializeBackup(createBackup({ clients: [], services: [], appointments: series, expenses: [], settings: null }));
    const r = parseBackup(text);
    if (!r.ok) throw new Error(r.error);
    expect(r.backup.data.appointments).toEqual(series);
  });

  it('i backup della versione 1 (senza serie) restano importabili', () => {
    const r = parseBackup(JSON.stringify({ app: 'barbiere-gestionale', schemaVersion: 1, exportedAt: '', data: { appointments: [{ ...base }] } }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.backup.data.appointments[0].seriesId).toBeUndefined();
  });

  it('elenco dei clienti ricorrenti', () => {
    const now = new Date(2026, 9, 20).getTime(); // dopo il primo appuntamento della serie
    const other = buildSeries({ ...base, id: 'b1', clientId: 'c2', start: base.start + 86400000, end: base.end + 86400000 }, 2, 3, mk, 'S2');
    const clients = ['c1', 'c2', 'c3'].map((id) => ({ id, firstName: id, lastName: '', phone: '', notes: '', createdAt: 0 }));
    const all = [...series, ...other.map((a, i) => (i === 2 ? { ...a, status: 'annullato' as const } : a))];
    const res = recurringClients(clients, all, now);
    expect(res.map((r) => [r.client.id, r.repeatWeeks, r.remaining])).toEqual([
      ['c2', 2, 1], // 21/10 (il 7/10 è passato, il 4/11 è annullato)
      ['c1', 3, 3], // 27/10, 17/11, 8/12
    ]);
    expect(res[1].next.start).toBe(series[1].start);
    expect(res[1].last.start).toBe(series[3].start);
  });
});
