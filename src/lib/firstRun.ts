import type { BarberDB } from '../db/db';
import { DEFAULT_SETTINGS } from '../db/types';
import { writeAllData } from './backup';
import { generateSampleData } from './sample';

export const SAMPLE_PREFIX = 'esempio-';
const FIRST_RUN_KEY = 'barbiere-primo-avvio';

/**
 * Primo avvio su questo telefono: se il database è completamente vuoto carica i dati di esempio,
 * così l'app si può provare subito. Succede una sola volta: dopo "Cancella tutti i dati"
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
  await writeAllData(database, generateSampleData(now, { ...DEFAULT_SETTINGS, onboarded: true }));
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
  await database.transaction('rw', [database.clients, database.services, database.appointments, database.expenses, database.settings], async () => {
    const sampleClients = await database.clients.where('id').startsWith(SAMPLE_PREFIX).primaryKeys();
    await database.appointments.where('id').startsWith(SAMPLE_PREFIX).delete();
    if (sampleClients.length) await database.appointments.where('clientId').anyOf(sampleClients).delete();
    await database.clients.bulkDelete(sampleClients);
    await database.services.where('id').startsWith(SAMPLE_PREFIX).delete();
    await database.expenses.where('id').startsWith(SAMPLE_PREFIX).delete();
  });
  if ((await database.services.count()) === 0) {
    const s = await database.settings.get('app');
    await database.settings.put({ ...DEFAULT_SETTINGS, ...s, id: 'app', onboarded: false });
    return true;
  }
  return false;
}
