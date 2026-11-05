import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { Appointment } from './types';
import { db } from './db';
import { deleteMany, saveAppointments, setStatusMany } from './actions';
import { buildSeries } from '../lib/recurrence';

const first: Appointment = {
  id: 'p',
  clientId: 'c',
  start: new Date(2026, 10, 10, 10).getTime(),
  end: new Date(2026, 10, 10, 10, 30).getTime(),
  services: [],
  status: 'programmato',
  amountCents: 1800,
  tipCents: 0,
  notes: '',
};

describe('azioni sulle serie', () => {
  it('annulla e ripristina più appuntamenti; elimina e ripristina', async () => {
    let i = 0;
    const series = buildSeries(first, 3, 6, () => `s${i++}`, 'S');
    await saveAppointments(series);
    expect(await db.appointments.where('seriesId').equals('S').count()).toBe(6);

    const ids = series.slice(1).map((a) => a.id);
    const undo = await setStatusMany(ids, 'annullato');
    const statuses = async () => (await db.appointments.where('seriesId').equals('S').sortBy('start')).map((a) => a.status);
    expect(await statuses()).toEqual(['programmato', ...Array(5).fill('annullato')]);
    await undo();
    expect(await statuses()).toEqual(Array(6).fill('programmato'));

    const undoDel = await deleteMany(ids);
    expect(await db.appointments.where('seriesId').equals('S').count()).toBe(1);
    await undoDel();
    expect(await db.appointments.where('seriesId').equals('S').count()).toBe(6);
  });
});
