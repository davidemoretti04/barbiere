import type { BarberDB } from '../db/db';
import { DEFAULT_SETTINGS } from '../db/types';
import { readAllData, writeAllData } from './backup';
import { generateSampleData, SAMPLE_CLOSURE_ID, SAMPLE_VERSION } from './sample';

export const SAMPLE_PREFIX = 'esempio-';
const FIRST_RUN_KEY = 'barbiere-primo-avvio';
const SAMPLE_VERSION_KEY = 'barbiere-versione-esempi';

/**
 * Primo avvio su questo telefono: se il database è completamente vuoto carica i dati di esempio
 * e apre la guida, che propone «Configura la mia barberia» o «Prima provo con gli esempi». Succede una sola volta: dopo "Cancella tutti i dati"
 * o dopo aver cancellato gli esempi si riparte dalla configurazione guidata.
 */
export async function loadSampleOnFirstRun(database: BarberDB, storage: Pick<Storage, 'getItem' | 'setItem'>, now = new Date()): Promise<boolean> {
  if (storage.getItem(FIRST_RUN_KEY)) return false;
  storage.setItem(FIRST_RUN_KEY, now.toISOString());
  const [settings, clients, appointments] = await Promise.all([
    database.settings.count(),
    database.clients.count(),
    database.appointments.count(),
  ]);
  if (settings + clients + appointments > 0) return false; // c'è già qualcosa (es. backup ripristinato)
  const sample = generateSampleData(now, { ...DEFAULT_SETTINGS, onboarded: true });
  // gli esempi ci sono già, ma al primo avvio si apre la guida: si sceglie se configurare o provare prima
  await writeAllData(database, { ...sample, settings: { ...DEFAULT_SETTINGS, ...sample.settings, onboarded: false } });
  storage.setItem(SAMPLE_VERSION_KEY, String(SAMPLE_VERSION));
  return true;
}

/** Toglie i record di esempio senza cambiare le impostazioni (tranne la chiusura di esempio). */
async function removeSampleRecords(database: BarberDB): Promise<void> {
  await database.transaction('rw', [database.clients, database.services, database.appointments, database.expenses, database.settings], async () => {
    const sampleClients = await database.clients.where('id').startsWith(SAMPLE_PREFIX).primaryKeys();
    await database.appointments.where('id').startsWith(SAMPLE_PREFIX).delete();
    if (sampleClients.length) await database.appointments.where('clientId').anyOf(sampleClients).delete();
    await database.clients.bulkDelete(sampleClients);
    await database.services.where('id').startsWith(SAMPLE_PREFIX).delete();
    await database.expenses.where('id').startsWith(SAMPLE_PREFIX).delete();
    const s = await database.settings.get('app');
    if (s?.closures.some((c) => c.id === SAMPLE_CLOSURE_ID)) {
      await database.settings.put({ ...s, closures: s.closures.filter((c) => c.id !== SAMPLE_CLOSURE_ID) });
    }
  });
}

/**
 * Sostituisce gli esempi con quelli dell'ultima versione, lasciando intatti i dati veri e le impostazioni.
 * Automatico all'avvio quando gli esempi sono di una versione precedente (`force` per il tasto manuale).
 * Ritorna true se li ha aggiornati.
 */
export async function refreshSampleData(
  database: BarberDB,
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  now = new Date(),
  force = false,
): Promise<boolean> {
  if (!force && storage.getItem(SAMPLE_VERSION_KEY) === String(SAMPLE_VERSION)) return false;
  if ((await countSampleData(database)) === 0) {
    storage.setItem(SAMPLE_VERSION_KEY, String(SAMPLE_VERSION));
    return false; // niente esempi sul telefono: non si aggiunge nulla
  }
  await removeSampleRecords(database);
  const current = await readAllData(database);
  const settings = { ...DEFAULT_SETTINGS, ...current.settings, id: 'app' as const };
  const sample = generateSampleData(now, settings);
  await writeAllData(database, {
    clients: [...current.clients, ...sample.clients],
    services: [...current.services, ...sample.services],
    appointments: [...current.appointments, ...sample.appointments],
    expenses: [...current.expenses, ...sample.expenses],
    // si tengono le impostazioni attuali (compreso onboarded); si aggiunge solo la chiusura di esempio
    settings: { ...settings, closures: sample.settings?.closures ?? settings.closures },
  });
  storage.setItem(SAMPLE_VERSION_KEY, String(SAMPLE_VERSION));
  return true;
}

export async function countSampleData(database: BarberDB): Promise<number> {
  const [c, a] = await Promise.all([
    database.clients.where('id').startsWith(SAMPLE_PREFIX).count(),
    database.appointments.where('id').startsWith(SAMPLE_PREFIX).count(),
  ]);
  return c + a;
}

/**
 * Elimina solo i dati di esempio (id che iniziano con "esempio-"), lasciando quelli veri.
 * Se il listino resta vuoto (o non resta nulla), riporta l'app alla configurazione guidata
 * per impostare orari e servizi veri; i clienti veri restano.
 * Ritorna true se l'app torna alla configurazione guidata.
 */
export async function removeSampleData(database: BarberDB): Promise<boolean> {
  await removeSampleRecords(database);
  if ((await database.services.count()) === 0) {
    const s = await database.settings.get('app');
    await database.settings.put({ ...DEFAULT_SETTINGS, ...s, id: 'app', onboarded: false });
    return true;
  }
  return false;
}
