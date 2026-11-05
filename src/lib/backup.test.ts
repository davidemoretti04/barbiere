import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { BarberDB, SCHEMA_VERSION } from '../db/db';
import {
  clearAllData,
  createBackup,
  importBackup,
  mergeData,
  parseBackup,
  readAllData,
  serializeBackup,
  writeAllData,
  type BackupData,
} from './backup';
import { clientsCsv, revenueCsv } from './csv';
import { generateSampleData } from './sample';

let dbCount = 0;
const dbs: BarberDB[] = [];
function freshDb() {
  const database = new BarberDB(`test-${dbCount++}`);
  dbs.push(database);
  return database;
}
afterEach(async () => {
  for (const x of dbs.splice(0)) await x.delete();
});

const sortById = <T extends { id: string }>(a: T[]) => [...a].sort((x, y) => x.id.localeCompare(y.id));
function normalize(d: BackupData) {
  return {
    clients: sortById(d.clients),
    services: sortById(d.services),
    appointments: sortById(d.appointments),
    expenses: sortById(d.expenses),
    settings: d.settings,
  };
}

const sample = generateSampleData(new Date(2026, 10, 5, 12));

describe('backup', () => {
  it('i dati di esempio sono abbondanti e coerenti', () => {
    expect(sample.clients.length).toBeGreaterThan(10);
    expect(sample.appointments.length).toBeGreaterThan(200);
    const ids = new Set(sample.clients.map((c) => c.id));
    expect(sample.appointments.every((a) => ids.has(a.clientId))).toBe(true);
  });

  it('esporta → cancella tutto → reimporta ripristina esattamente lo stato', async () => {
    const database = freshDb();
    await writeAllData(database, sample);
    const before = await readAllData(database);

    const text = serializeBackup(createBackup(before, new Date(2026, 10, 5)));
    await clearAllData(database);
    expect((await readAllData(database)).clients).toHaveLength(0);

    const parsed = parseBackup(text);
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.summary).toMatchObject({
      schemaVersion: SCHEMA_VERSION,
      clients: before.clients.length,
      appointments: before.appointments.length,
      hasSettings: true,
    });
    await importBackup(database, parsed.backup, 'replace');
    const after = await readAllData(database);
    expect(normalize(after)).toEqual(normalize(before));
  });

  it('unisci: aggiunge i nuovi, aggiorna quelli con lo stesso id e mantiene le impostazioni', async () => {
    const database = freshDb();
    const mySettings = { ...sample.settings!, slotMinutes: 15 };
    await writeAllData(database, {
      clients: [sample.clients[0], { ...sample.clients[1], notes: 'vecchia nota' }],
      services: [],
      appointments: [],
      expenses: [],
      settings: mySettings,
    });
    const incoming: BackupData = {
      clients: [{ ...sample.clients[1], notes: 'nota aggiornata' }, sample.clients[2]],
      services: sample.services,
      appointments: [],
      expenses: [],
      settings: { ...sample.settings!, slotMinutes: 45 },
    };
    await importBackup(database, createBackup(incoming), 'merge');
    const after = await readAllData(database);
    expect(after.clients).toHaveLength(3);
    expect(after.clients.find((c) => c.id === sample.clients[1].id)?.notes).toBe('nota aggiornata');
    expect(after.services).toHaveLength(sample.services.length);
    expect(after.settings?.slotMinutes).toBe(15);
  });

  it('mergeData è pura', () => {
    const a: BackupData = { clients: [sample.clients[0]], services: [], appointments: [], expenses: [], settings: null };
    const b: BackupData = { ...a, clients: [sample.clients[1]] };
    expect(mergeData(a, b).clients).toHaveLength(2);
    expect(a.clients).toHaveLength(1);
  });

  describe('convalida', () => {
    it.each([
      ['non è json', 'non è un file JSON'],
      ['{"foo":1}', 'non sembra un backup'],
      [JSON.stringify({ app: 'barbiere-gestionale', schemaVersion: 99, data: {} }), 'versione più recente'],
      [JSON.stringify({ app: 'barbiere-gestionale', schemaVersion: 'x', data: {} }), 'versione valida'],
      [JSON.stringify({ app: 'barbiere-gestionale', schemaVersion: 1 }), 'non contiene dati'],
      [
        JSON.stringify({ app: 'barbiere-gestionale', schemaVersion: 1, data: { clients: [{ id: 'x', firstName: 'A' }] } }),
        'Cliente n. 1: il campo «createdAt»',
      ],
      [
        JSON.stringify({
          app: 'barbiere-gestionale',
          schemaVersion: 1,
          data: { appointments: [{ id: 'a', clientId: 'c', start: 2, end: 1, services: [], status: 'completato', amountCents: 1 }] },
        }),
        'Appuntamento n. 1: il campo «end»',
      ],
      [JSON.stringify({ app: 'barbiere-gestionale', schemaVersion: 1, data: { expenses: 'x' } }), 'sezione «expenses»'],
    ])('%s', (text, msg) => {
      const r = parseBackup(text);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toContain(msg);
    });

    it('accetta un backup minimo', () => {
      const r = parseBackup(JSON.stringify({ app: 'barbiere-gestionale', schemaVersion: 1, data: {} }));
      expect(r.ok).toBe(true);
    });
  });
});

describe('csv', () => {
  it('incassi e clienti con separatore ; e BOM', () => {
    const csv = revenueCsv(sample.appointments, sample.clients);
    expect(csv.startsWith('﻿Data;Ora;Cliente;')).toBe(true);
    const lines = csv.trim().split('\r\n');
    expect(lines.length - 1).toBe(sample.appointments.filter((a) => a.status === 'completato').length);
    const c = clientsCsv([{ ...sample.clients[0], notes: 'ha detto "ciao"; ok' }], []);
    expect(c).toContain('"ha detto ""ciao""; ok"');
  });
});
