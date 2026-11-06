import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { Appointment } from './types';
import { db } from './db';
import { checkoutAllAtListPrice, deleteMany, listPrice, saveAppointments, setStatusMany } from './actions';
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

describe('incassa tutto', () => {
  it('completa al prezzo di listino, in contanti, senza mancia; si può annullare', async () => {
    const base: Appointment = {
      id: 'x', clientId: 'c', start: 1, end: 2, status: 'programmato', tipCents: 0, notes: '',
      services: [
        { serviceId: 't', name: 'Taglio', priceCents: 1800, durationMinutes: 30 },
        { serviceId: 'b', name: 'Barba', priceCents: 1000, durationMinutes: 20 },
      ],
      amountCents: 2500, // previsto con sconto
    };
    const noServices: Appointment = { ...base, id: 'y', services: [], amountCents: 1500 };
    const done: Appointment = { ...base, id: 'z', status: 'completato', amountCents: 999, paymentMethod: 'carta' };
    await db.appointments.bulkPut([base, noServices, done]);
    expect(listPrice(base)).toBe(2800);
    const undo = await checkoutAllAtListPrice(['x', 'y', 'z']);
    const [a, b, c] = await db.appointments.bulkGet(['x', 'y', 'z']);
    expect([a?.status, a?.amountCents, a?.paymentMethod, a?.tipCents]).toEqual(['completato', 2800, 'contanti', 0]);
    expect([b?.status, b?.amountCents]).toEqual(['completato', 1500]);
    expect([c?.amountCents, c?.paymentMethod]).toEqual([999, 'carta']); // già completato: non toccato
    await undo();
    expect((await db.appointments.get('x'))?.status).toBe('programmato');
    expect((await db.appointments.get('y'))?.paymentMethod).toBeUndefined();
  });
});
