import { db } from './db';
import type { Appointment, Client, Expense, Service } from './types';
import { newId } from '../lib/id';

export async function createClient(data: Omit<Client, 'id' | 'createdAt'>): Promise<Client> {
  const c: Client = { ...data, id: newId(), createdAt: Date.now() };
  if (!c.birthday) delete c.birthday;
  await db.clients.add(c);
  return c;
}

export async function saveClient(c: Client): Promise<void> {
  const copy = { ...c };
  if (!copy.birthday) delete copy.birthday;
  await db.clients.put(copy);
}

/** Elimina un cliente e i suoi appuntamenti; ritorna una funzione per annullare. */
export async function deleteClient(id: string): Promise<() => Promise<void>> {
  const client = await db.clients.get(id);
  const appts = await db.appointments.where('clientId').equals(id).toArray();
  await db.transaction('rw', db.clients, db.appointments, async () => {
    await db.appointments.where('clientId').equals(id).delete();
    await db.clients.delete(id);
  });
  return async () => {
    await db.transaction('rw', db.clients, db.appointments, async () => {
      if (client) await db.clients.put(client);
      await db.appointments.bulkPut(appts);
    });
  };
}

export async function saveAppointment(a: Appointment): Promise<void> {
  const copy = { ...a };
  if (!copy.paymentMethod) delete copy.paymentMethod;
  await db.appointments.put(copy);
}

export async function deleteAppointment(id: string): Promise<() => Promise<void>> {
  const a = await db.appointments.get(id);
  await db.appointments.delete(id);
  return async () => {
    if (a) await db.appointments.put(a);
  };
}

/** Cambia lo stato; ritorna una funzione per annullare. */
export async function setAppointmentStatus(
  id: string,
  status: Appointment['status'],
  patch: Partial<Appointment> = {},
): Promise<() => Promise<void>> {
  const before = await db.appointments.get(id);
  if (!before) return async () => {};
  const next: Appointment = { ...before, ...patch, status };
  if (status !== 'completato') {
    next.tipCents = 0;
    delete next.paymentMethod;
  }
  await saveAppointment(next);
  return async () => {
    await db.appointments.put(before);
  };
}

export async function saveService(s: Service): Promise<void> {
  await db.services.put(s);
}

export async function saveExpense(e: Expense): Promise<void> {
  await db.expenses.put(e);
}

export async function deleteExpense(id: string): Promise<() => Promise<void>> {
  const e = await db.expenses.get(id);
  await db.expenses.delete(id);
  return async () => {
    if (e) await db.expenses.put(e);
  };
}
