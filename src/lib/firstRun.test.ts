import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { BarberDB } from '../db/db';
import { countSampleData, loadSampleOnFirstRun, removeSampleData } from './firstRun';

const dbs: BarberDB[] = [];
let n = 0;
const fresh = () => {
  const d = new BarberDB(`first-run-${n++}`);
  dbs.push(d);
  return d;
};
afterEach(async () => {
  for (const d of dbs.splice(0)) await d.delete();
});
const memoryStorage = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};

describe('dati di esempio al primo avvio', () => {
  it('carica gli esempi una sola volta, su database vuoto', async () => {
    const db = fresh();
    const storage = memoryStorage();
    expect(await loadSampleOnFirstRun(db, storage, new Date(2026, 10, 5))).toBe(true);
    expect(await countSampleData(db)).toBeGreaterThan(100);
    expect((await db.settings.get('app'))?.onboarded).toBe(true);
    // secondo avvio: non ricarica
    expect(await loadSampleOnFirstRun(db, storage)).toBe(false);
  });

  it('non tocca un telefono che ha già dati', async () => {
    const db = fresh();
    await db.clients.add({ id: 'vero', firstName: 'Mario', lastName: '', phone: '', notes: '', createdAt: 0 });
    expect(await loadSampleOnFirstRun(db, memoryStorage())).toBe(false);
    expect(await countSampleData(db)).toBe(0);
  });

  it('cancella solo gli esempi e torna alla configurazione se non resta nulla', async () => {
    const db = fresh();
    await loadSampleOnFirstRun(db, memoryStorage());
    expect(await removeSampleData(db)).toBe(true);
    expect(await countSampleData(db)).toBe(0);
    expect(await db.services.count()).toBe(0);
    expect(await db.expenses.count()).toBe(0);
    expect((await db.settings.get('app'))?.onboarded).toBe(false);
  });

  it('mantiene i dati veri inseriti insieme agli esempi', async () => {
    const db = fresh();
    await loadSampleOnFirstRun(db, memoryStorage());
    await db.clients.add({ id: 'vero', firstName: 'Mario', lastName: 'Bianchi', phone: '', notes: '', createdAt: 0 });
    await db.appointments.add({
      id: 'app-vero',
      clientId: 'vero',
      start: 1,
      end: 2,
      services: [],
      status: 'programmato',
      amountCents: 0,
      tipCents: 0,
      notes: '',
    });
    // il listino era solo di esempio: si torna alla configurazione, ma i dati veri restano
    expect(await removeSampleData(db)).toBe(true);
    expect((await db.clients.toArray()).map((c) => c.id)).toEqual(['vero']);
    expect((await db.appointments.toArray()).map((a) => a.id)).toEqual(['app-vero']);
    expect((await db.settings.get('app'))?.onboarded).toBe(false);
  });

  it('se c’è un listino vero resta nell’app', async () => {
    const db = fresh();
    await loadSampleOnFirstRun(db, memoryStorage());
    await db.services.add({ id: 'mio', name: 'Taglio', priceCents: 2000, durationMinutes: 30, active: true });
    expect(await removeSampleData(db)).toBe(false);
    expect((await db.services.toArray()).map((s) => s.id)).toEqual(['mio']);
    expect((await db.settings.get('app'))?.onboarded).toBe(true);
  });
});
