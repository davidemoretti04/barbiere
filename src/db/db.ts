import Dexie, { type EntityTable } from 'dexie';
import {
  DEFAULT_SETTINGS,
  type Appointment,
  type Client,
  type Expense,
  type Service,
  type Settings,
} from './types';

/**
 * Versione dello schema dati. Va incrementata insieme a una nuova `db.version(n)`
 * e a una funzione di migrazione in `migrateBackup` (lib/backup.ts) quando il modello cambia.
 *
 * Esempio di migrazione futura:
 *   db.version(2).stores({ ... }).upgrade(tx => tx.table('clients').toCollection().modify(c => { c.email = ''; }));
 */
export const SCHEMA_VERSION = 2;

export class BarberDB extends Dexie {
  clients!: EntityTable<Client, 'id'>;
  services!: EntityTable<Service, 'id'>;
  appointments!: EntityTable<Appointment, 'id'>;
  expenses!: EntityTable<Expense, 'id'>;
  settings!: EntityTable<Settings, 'id'>;

  constructor(name = 'barbiere') {
    super(name);
    this.version(1).stores({
      clients: 'id, lastName, firstName, createdAt',
      services: 'id, name',
      appointments: 'id, start, clientId, status, [clientId+start]',
      expenses: 'id, date',
      settings: 'id',
    });
    // v2: appuntamenti ricorrenti (indice sulla serie). Nessun dato da trasformare.
    this.version(2).stores({
      appointments: 'id, start, clientId, status, [clientId+start], seriesId',
    });
  }
}

export const db = new BarberDB();

export async function getSettings(database: BarberDB = db): Promise<Settings> {
  const s = await database.settings.get('app');
  return { ...DEFAULT_SETTINGS, ...s };
}

export async function updateSettings(patch: Partial<Settings>, database: BarberDB = db): Promise<void> {
  const current = await getSettings(database);
  await database.settings.put({ ...current, ...patch, id: 'app' });
}

/** Chiede al browser di non cancellare i dati in caso di spazio scarso. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) {
      if (await navigator.storage.persisted()) return true;
      return await navigator.storage.persist();
    }
  } catch {
    // ignorato: non tutti i browser lo supportano
  }
  return false;
}
