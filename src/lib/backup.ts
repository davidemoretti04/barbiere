import type { BarberDB } from '../db/db';
import { SCHEMA_VERSION } from '../db/db';
import {
  DEFAULT_SETTINGS,
  type Appointment,
  type Client,
  type Expense,
  type Service,
  type Settings,
} from '../db/types';

export const BACKUP_APP_ID = 'barbiere-gestionale';

export interface BackupData {
  clients: Client[];
  services: Service[];
  appointments: Appointment[];
  expenses: Expense[];
  settings: Settings | null;
}

export interface BackupFile {
  app: typeof BACKUP_APP_ID;
  schemaVersion: number;
  exportedAt: string;
  data: BackupData;
}

export interface BackupSummary {
  exportedAt: string;
  schemaVersion: number;
  clients: number;
  services: number;
  appointments: number;
  expenses: number;
  hasSettings: boolean;
}

export type ParseResult =
  | { ok: true; backup: BackupFile; summary: BackupSummary }
  | { ok: false; error: string };

export function createBackup(data: BackupData, now: Date = new Date()): BackupFile {
  return { app: BACKUP_APP_ID, schemaVersion: SCHEMA_VERSION, exportedAt: now.toISOString(), data };
}

export function serializeBackup(b: BackupFile): string {
  return JSON.stringify(b, null, 2);
}

export function backupFileName(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `backup-barbiere-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.json`;
}

// ---------- validazione ----------

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

class ValidationError extends Error {}

function req(cond: boolean, what: string, index: number, field: string) {
  if (!cond) throw new ValidationError(`${what} n. ${index + 1}: il campo «${field}» manca o non è valido.`);
}

function validateClient(v: unknown, i: number): Client {
  req(isObj(v), 'Cliente', i, 'record');
  const o = v as Obj;
  req(isStr(o.id) && o.id !== '', 'Cliente', i, 'id');
  req(isStr(o.firstName), 'Cliente', i, 'firstName');
  req(o.lastName === undefined || isStr(o.lastName), 'Cliente', i, 'lastName');
  req(o.phone === undefined || isStr(o.phone), 'Cliente', i, 'phone');
  req(o.birthday === undefined || o.birthday === null || isStr(o.birthday), 'Cliente', i, 'birthday');
  req(isNum(o.createdAt), 'Cliente', i, 'createdAt');
  const c: Client = {
    id: o.id as string,
    firstName: o.firstName as string,
    lastName: (o.lastName as string) ?? '',
    phone: (o.phone as string) ?? '',
    notes: isStr(o.notes) ? o.notes : '',
    createdAt: o.createdAt as number,
  };
  if (isStr(o.birthday) && o.birthday) c.birthday = o.birthday;
  return c;
}

function validateService(v: unknown, i: number): Service {
  req(isObj(v), 'Servizio', i, 'record');
  const o = v as Obj;
  req(isStr(o.id) && o.id !== '', 'Servizio', i, 'id');
  req(isStr(o.name), 'Servizio', i, 'name');
  req(isInt(o.priceCents), 'Servizio', i, 'priceCents');
  req(isInt(o.durationMinutes), 'Servizio', i, 'durationMinutes');
  return {
    id: o.id as string,
    name: o.name as string,
    priceCents: o.priceCents as number,
    durationMinutes: o.durationMinutes as number,
    active: o.active !== false,
  };
}

const STATUSES = ['programmato', 'completato', 'annullato', 'non_presentato'];
const METHODS = ['contanti', 'carta', 'altro'];

function validateAppointment(v: unknown, i: number): Appointment {
  req(isObj(v), 'Appuntamento', i, 'record');
  const o = v as Obj;
  req(isStr(o.id) && o.id !== '', 'Appuntamento', i, 'id');
  req(isStr(o.clientId), 'Appuntamento', i, 'clientId');
  req(isNum(o.start), 'Appuntamento', i, 'start');
  req(isNum(o.end) && (o.end as number) >= (o.start as number), 'Appuntamento', i, 'end');
  req(Array.isArray(o.services), 'Appuntamento', i, 'services');
  req(isStr(o.status) && STATUSES.includes(o.status), 'Appuntamento', i, 'status');
  req(isInt(o.amountCents), 'Appuntamento', i, 'amountCents');
  req(o.tipCents === undefined || isInt(o.tipCents), 'Appuntamento', i, 'tipCents');
  req(
    o.paymentMethod === undefined || o.paymentMethod === null || (isStr(o.paymentMethod) && METHODS.includes(o.paymentMethod)),
    'Appuntamento',
    i,
    'paymentMethod',
  );
  const services = (o.services as unknown[]).map((s) => {
    req(isObj(s) && isStr(s.name) && isInt(s.priceCents) && isInt(s.durationMinutes), 'Appuntamento', i, 'services');
    const so = s as Obj;
    return {
      serviceId: isStr(so.serviceId) ? so.serviceId : '',
      name: so.name as string,
      priceCents: so.priceCents as number,
      durationMinutes: so.durationMinutes as number,
    };
  });
  const a: Appointment = {
    id: o.id as string,
    clientId: o.clientId as string,
    start: o.start as number,
    end: o.end as number,
    services,
    status: o.status as Appointment['status'],
    amountCents: o.amountCents as number,
    tipCents: (o.tipCents as number) ?? 0,
    notes: isStr(o.notes) ? o.notes : '',
  };
  if (isStr(o.paymentMethod)) a.paymentMethod = o.paymentMethod as Appointment['paymentMethod'];
  return a;
}

function validateExpense(v: unknown, i: number): Expense {
  req(isObj(v), 'Spesa', i, 'record');
  const o = v as Obj;
  req(isStr(o.id) && o.id !== '', 'Spesa', i, 'id');
  req(isStr(o.date) && /^\d{4}-\d{2}-\d{2}$/.test(o.date), 'Spesa', i, 'date');
  req(isStr(o.category), 'Spesa', i, 'category');
  req(isInt(o.amountCents), 'Spesa', i, 'amountCents');
  return {
    id: o.id as string,
    date: o.date as string,
    category: o.category as string,
    amountCents: o.amountCents as number,
    notes: isStr(o.notes) ? o.notes : '',
  };
}

function validateSettings(v: unknown): Settings {
  if (!isObj(v)) throw new ValidationError('Le impostazioni nel backup non sono valide.');
  const s = { ...DEFAULT_SETTINGS, ...(v as Partial<Settings>), id: 'app' as const };
  if (!isObj(s.workingHours) || !Array.isArray(s.closures) || !isInt(s.slotMinutes) || s.slotMinutes <= 0) {
    throw new ValidationError('Le impostazioni nel backup non sono valide.');
  }
  return s;
}

/**
 * Porta un backup di una versione precedente allo schema attuale.
 * Aggiungere qui un passo per ogni nuova versione (v1 → v2 → …).
 */
export function migrateBackup(raw: Obj, fromVersion: number): Obj {
  const out = raw;
  // if (fromVersion < 2) { ...trasforma out.data... }
  void fromVersion;
  return out;
}

export function parseBackup(text: string): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Il file non è un backup valido (non è un file JSON leggibile).' };
  }
  if (!isObj(json) || json.app !== BACKUP_APP_ID) {
    return { ok: false, error: 'Questo file non sembra un backup di questa app.' };
  }
  const version = json.schemaVersion;
  if (!isInt(version) || version < 1) {
    return { ok: false, error: 'Il backup non indica una versione valida.' };
  }
  if (version > SCHEMA_VERSION) {
    return {
      ok: false,
      error: 'Il backup è stato creato con una versione più recente dell’app. Aggiorna l’app e riprova.',
    };
  }
  try {
    const migrated = migrateBackup(json, version);
    const d = migrated.data;
    if (!isObj(d)) throw new ValidationError('Il backup non contiene dati.');
    const arr = (k: string) => {
      const v = d[k];
      if (v === undefined) return [];
      if (!Array.isArray(v)) throw new ValidationError(`La sezione «${k}» del backup non è valida.`);
      return v as unknown[];
    };
    const data: BackupData = {
      clients: arr('clients').map(validateClient),
      services: arr('services').map(validateService),
      appointments: arr('appointments').map(validateAppointment),
      expenses: arr('expenses').map(validateExpense),
      settings: d.settings == null ? null : validateSettings(d.settings),
    };
    const backup: BackupFile = {
      app: BACKUP_APP_ID,
      schemaVersion: SCHEMA_VERSION,
      exportedAt: isStr(json.exportedAt) ? json.exportedAt : '',
      data,
    };
    return {
      ok: true,
      backup,
      summary: {
        exportedAt: backup.exportedAt,
        schemaVersion: version,
        clients: data.clients.length,
        services: data.services.length,
        appointments: data.appointments.length,
        expenses: data.expenses.length,
        hasSettings: data.settings !== null,
      },
    };
  } catch (e) {
    if (e instanceof ValidationError) return { ok: false, error: e.message };
    return { ok: false, error: 'Il backup è danneggiato o incompleto.' };
  }
}

/**
 * Unione: i record del backup vengono aggiunti; quelli con lo stesso id sostituiscono i presenti.
 * Le impostazioni attuali vengono mantenute.
 */
export function mergeData(existing: BackupData, incoming: BackupData): BackupData {
  const merge = <T extends { id: string }>(a: T[], b: T[]) => {
    const m = new Map(a.map((x) => [x.id, x]));
    for (const x of b) m.set(x.id, x);
    return [...m.values()];
  };
  return {
    clients: merge(existing.clients, incoming.clients),
    services: merge(existing.services, incoming.services),
    appointments: merge(existing.appointments, incoming.appointments),
    expenses: merge(existing.expenses, incoming.expenses),
    settings: existing.settings ?? incoming.settings,
  };
}

// ---------- accesso al database ----------

export async function readAllData(database: BarberDB): Promise<BackupData> {
  const [clients, services, appointments, expenses, settings] = await Promise.all([
    database.clients.toArray(),
    database.services.toArray(),
    database.appointments.toArray(),
    database.expenses.toArray(),
    database.settings.get('app'),
  ]);
  return { clients, services, appointments, expenses, settings: settings ?? null };
}

export async function clearAllData(database: BarberDB): Promise<void> {
  await database.transaction(
    'rw',
    [database.clients, database.services, database.appointments, database.expenses, database.settings],
    async () => {
      await Promise.all([
        database.clients.clear(),
        database.services.clear(),
        database.appointments.clear(),
        database.expenses.clear(),
        database.settings.clear(),
      ]);
    },
  );
}

export async function writeAllData(database: BarberDB, data: BackupData): Promise<void> {
  await database.transaction(
    'rw',
    [database.clients, database.services, database.appointments, database.expenses, database.settings],
    async () => {
      await Promise.all([
        database.clients.clear(),
        database.services.clear(),
        database.appointments.clear(),
        database.expenses.clear(),
        database.settings.clear(),
      ]);
      await database.clients.bulkPut(data.clients);
      await database.services.bulkPut(data.services);
      await database.appointments.bulkPut(data.appointments);
      await database.expenses.bulkPut(data.expenses);
      if (data.settings) await database.settings.put({ ...data.settings, id: 'app' });
    },
  );
}

export async function importBackup(database: BarberDB, backup: BackupFile, mode: 'replace' | 'merge'): Promise<void> {
  if (mode === 'replace') {
    const settings = backup.data.settings ? { ...backup.data.settings, onboarded: true } : null;
    await writeAllData(database, { ...backup.data, settings: settings ?? (await database.settings.get('app')) ?? null });
  } else {
    const current = await readAllData(database);
    await writeAllData(database, mergeData(current, backup.data));
  }
}
