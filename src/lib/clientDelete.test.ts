import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createClient, deleteClient, restoreClient } from '../db/actions';
import { db } from '../db/db';
import type { Appointment } from '../db/types';
import { clientsCsv } from './csv';
import { findDuplicateClient } from './search';
import { computeKpis, topClients } from './stats';

const NOW = new Date(2026, 10, 6, 12).getTime();
const appt = (id: string, dayOffset: number, status: Appointment['status']): Appointment => ({
  id,
  clientId: 'c',
  start: NOW + dayOffset * 86400000,
  end: NOW + dayOffset * 86400000 + 1800000,
  services: [{ serviceId: 's', name: 'Taglio', priceCents: 1800, durationMinutes: 30 }],
  status,
  amountCents: 1800,
  tipCents: 0,
  notes: '',
});

describe('eliminare un cliente', () => {
  beforeEach(async () => {
    await db.clients.clear();
    await db.appointments.clear();
    await db.clients.add({ id: 'c', firstName: 'Mario', lastName: 'Rossi', phone: '3331234567', notes: '', createdAt: 0 });
    await db.appointments.bulkPut([
      appt('fatto', -10, 'completato'),
      appt('annullato-passato', -5, 'annullato'),
      appt('in-sospeso', -1, 'programmato'),
      appt('futuro', 3, 'programmato'),
    ]);
  });

  it('elimina i futuri e quelli da fare, tiene storico e statistiche con il nome', async () => {
    const undo = await deleteClient('c', NOW);
    const left = (await db.appointments.toArray()).map((a) => a.id).sort();
    expect(left).toEqual(['annullato-passato', 'fatto']);
    const c = await db.clients.get('c');
    expect(c?.deletedAt).toBe(NOW);
    // le statistiche contano ancora l'incasso, con il nome del cliente
    const allTime = { start: 0, end: NOW };
    const appts = await db.appointments.toArray();
    const clients = await db.clients.toArray();
    expect(computeKpis(appts, [], clients, allTime).revenueCents).toBe(1800);
    expect(topClients(appts, clients, { start: 0, end: NOW })[0].name).toBe('Mario Rossi');
    // non è più tra i clienti: niente doppione se lo si ricrea, e niente nel CSV
    expect(findDuplicateClient(clients, { firstName: 'Mario', lastName: 'Rossi', phone: '3331234567' })).toBeUndefined();
    await expect(createClient({ firstName: 'Mario', lastName: 'Rossi', phone: '3331234567', notes: '' })).resolves.toBeTruthy();
    expect(clientsCsv(clients, appts)).not.toContain('Rossi');

    // «Annulla» rimette tutto com'era
    await db.clients.where('id').notEqual('c').delete();
    await undo();
    expect((await db.appointments.toArray()).length).toBe(4);
    expect((await db.clients.get('c'))?.deletedAt).toBeUndefined();
  });

  it('«Ripristina» lo riporta negli elenchi', async () => {
    await deleteClient('c', NOW);
    await restoreClient('c');
    expect((await db.clients.get('c'))?.deletedAt).toBeUndefined();
  });
});
