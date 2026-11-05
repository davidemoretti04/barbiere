import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/db';
import { endSeriesFrom, saveAppointments, topUpOpenSeries } from '../db/actions';
import type { Appointment } from '../db/types';
import { buildSeries, extendOpenSeries, OPEN_ENDED_HORIZON_WEEKS, openEndedCount } from './recurrence';

const first: Appointment = {
  id: 'o0',
  clientId: 'c',
  start: new Date(2026, 9, 6, 10, 0).getTime(), // martedì 6/10/2026, ora legale
  end: new Date(2026, 9, 6, 10, 30).getTime(),
  services: [],
  status: 'programmato',
  amountCents: 1800,
  tipCents: 0,
  notes: '',
};
let n = 0;
const mk = () => `x${n++}`;
const DAY = 86400000;

describe('serie «Sempre» (funzioni pure)', () => {
  it('crea circa 6 mesi di appuntamenti, tutti «Sempre»', () => {
    const s = buildSeries(first, 3, openEndedCount(3), mk, 'S', true);
    expect(s).toHaveLength(9); // 26 settimane / 3 + 1
    expect(s.every((a) => a.openEnded)).toBe(true);
  });

  it('con il passare del tempo aggiunge le date mancanti, alla stessa ora locale', () => {
    const s = buildSeries(first, 3, openEndedCount(3), mk, 'S', true);
    const later = s[0].start + 70 * DAY; // 10 settimane dopo
    const extra = extendOpenSeries(s, later, mk);
    const lastNew = extra[extra.length - 1];
    expect(extra.length).toBeGreaterThan(0);
    expect(lastNew.start).toBeLessThanOrEqual(later + OPEN_ENDED_HORIZON_WEEKS * 7 * DAY + DAY);
    expect(extra.every((a) => a.status === 'programmato' && a.openEnded && a.seriesId === 'S')).toBe(true);
    expect(extra.every((a) => new Date(a.start).getHours() === 10)).toBe(true);
    // la seconda volta non aggiunge doppioni
    expect(extendOpenSeries([...s, ...extra], later, mk)).toHaveLength(0);
  });

  it('non allunga serie a numero fisso o annullate', () => {
    const fixed = buildSeries({ ...first, id: 'f0' }, 2, 4, mk, 'F');
    expect(extendOpenSeries(fixed, first.start + 200 * DAY, mk)).toHaveLength(0);
    const open = buildSeries({ ...first, id: 'a0' }, 2, 3, mk, 'A', true);
    open[2] = { ...open[2], status: 'annullato' };
    expect(extendOpenSeries(open, first.start + 200 * DAY, mk)).toHaveLength(0);
  });
});

describe('serie «Sempre» (database)', () => {
  beforeEach(async () => {
    await db.appointments.clear();
  });

  it('all’avvio allunga la serie; «questo e i successivi» la ferma e si può annullare', async () => {
    const s = buildSeries(first, 2, 3, mk, 'DB', true); // solo 3 date: va allungata
    await saveAppointments(s);
    const added = await topUpOpenSeries(first.start + 7 * DAY);
    expect(added).toBeGreaterThan(5);
    const count = await db.appointments.where('seriesId').equals('DB').count();

    // elimina dalla terza in poi
    const third = (await db.appointments.where('seriesId').equals('DB').sortBy('start'))[2];
    const undo = await endSeriesFrom('DB', third.start, 'delete');
    const left = await db.appointments.where('seriesId').equals('DB').toArray();
    expect(left).toHaveLength(2);
    expect(left.some((a) => a.openEnded)).toBe(false);
    // non riparte più all'avvio
    expect(await topUpOpenSeries(first.start + 7 * DAY)).toBe(0);

    await undo();
    expect(await db.appointments.where('seriesId').equals('DB').count()).toBe(count);

    // annulla dalla terza in poi: restano nello storico come annullati, la serie si ferma
    await endSeriesFrom('DB', third.start, 'cancel');
    const after = await db.appointments.where('seriesId').equals('DB').sortBy('start');
    expect(after.slice(2).every((a) => a.status === 'annullato')).toBe(true);
    expect(await topUpOpenSeries(first.start + 400 * DAY)).toBe(0);
  });
});
