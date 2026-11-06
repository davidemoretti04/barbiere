import { addWeeks } from 'date-fns';
import { db } from './db';
import type { Appointment, Client, Expense, Service } from './types';
import { newId } from '../lib/id';
import { extendOpenSeries } from '../lib/recurrence';
import { clientKey, findDuplicateClient } from '../lib/search';

/** Esiste già un cliente con stesso nome, cognome e telefono. */
export class DuplicateClientError extends Error {
  constructor(public existing: Client) {
    super('Cliente già presente');
  }
}

/** Crea un cliente; se ne esiste già uno identico lancia DuplicateClientError (anche con doppio tocco su «Aggiungi»). */
export async function createClient(data: Omit<Client, 'id' | 'createdAt'>): Promise<Client> {
  return db.transaction('rw', db.clients, async () => {
    const existing = findDuplicateClient(await db.clients.toArray(), data);
    if (existing) throw new DuplicateClientError(existing);
    const c: Client = { ...data, id: newId(), createdAt: Date.now() };
    await db.clients.add(c);
    return c;
  });
}

/** Salva le modifiche; se diventerebbe identico a un altro cliente lancia DuplicateClientError. */
export async function saveClient(c: Client): Promise<void> {
  await db.transaction('rw', db.clients, async () => {
    const before = await db.clients.get(c.id);
    // si blocca solo se la modifica rende il cliente uguale a un altro: chi era già doppio
    // (dati di prima del controllo) può comunque cambiare note e altri dettagli
    const identityChanged = !before || clientKey(before) !== clientKey(c);
    const existing = identityChanged ? findDuplicateClient(await db.clients.toArray(), c, c.id) : undefined;
    if (existing) throw new DuplicateClientError(existing);
    await db.clients.put({ ...c });
  });
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

/** Salva in un colpo tutte le occorrenze di una serie. */
export async function saveAppointments(list: Appointment[]): Promise<void> {
  await db.appointments.bulkPut(
    list.map((a) => {
      const copy = { ...a };
      if (!copy.paymentMethod) delete copy.paymentMethod;
      return copy;
    }),
  );
}

/** Cambia lo stato di più appuntamenti (es. annulla la serie); ritorna una funzione per annullare. */
export async function setStatusMany(ids: string[], status: Appointment['status']): Promise<() => Promise<void>> {
  const before = (await db.appointments.bulkGet(ids)).filter((a): a is Appointment => !!a);
  await db.appointments.bulkPut(before.map((a) => ({ ...a, status })));
  return async () => {
    await db.appointments.bulkPut(before);
  };
}

export async function deleteMany(ids: string[]): Promise<() => Promise<void>> {
  const before = (await db.appointments.bulkGet(ids)).filter((a): a is Appointment => !!a);
  await db.appointments.bulkDelete(ids);
  return async () => {
    await db.appointments.bulkPut(before);
  };
}

export async function deleteAppointment(id: string): Promise<() => Promise<void>> {
  const a = await db.appointments.get(id);
  let added: Appointment | null = null;
  await db.transaction('rw', db.appointments, async () => {
    await db.appointments.delete(id);
    // Serie «Sempre»: se era l'ultima data, si aggiunge subito la successiva, altrimenti
    // all'apertura successiva l'app ricreerebbe proprio la data eliminata.
    if (a?.seriesId && a.openEnded) {
      const rest = await db.appointments.where('seriesId').equals(a.seriesId).toArray();
      if (!rest.some((x) => x.start > a.start)) {
        const start = addWeeks(new Date(a.start), a.repeatWeeks ?? 1).getTime();
        added = { ...a, id: newId(), start, end: start + (a.end - a.start), status: 'programmato', tipCents: 0 };
        delete added.paymentMethod;
        await db.appointments.put(added);
      }
    }
  });
  return async () => {
    await db.transaction('rw', db.appointments, async () => {
      if (added) await db.appointments.delete(added.id);
      if (a) await db.appointments.put(a);
    });
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

/**
 * Elimina un servizio dal listino. Gli appuntamenti conservano la propria copia di nome e prezzo,
 * quindi storico e statistiche non cambiano. Ritorna una funzione per annullare.
 */
export async function deleteService(id: string): Promise<() => Promise<void>> {
  const s = await db.services.get(id);
  await db.services.delete(id);
  return async () => {
    if (s) await db.services.put(s);
  };
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

/**
 * Termina una serie da un appuntamento in poi: i programmati successivi vengono annullati o eliminati
 * e la serie smette di essere «Sempre». Ritorna una funzione per annullare tutto.
 */
export async function endSeriesFrom(seriesId: string, fromStart: number, mode: 'cancel' | 'delete'): Promise<() => Promise<void>> {
  const all = await db.appointments.where('seriesId').equals(seriesId).toArray();
  const following = new Set(all.filter((a) => a.start >= fromStart && a.status === 'programmato').map((a) => a.id));
  await db.transaction('rw', db.appointments, async () => {
    if (mode === 'delete') await db.appointments.bulkDelete([...following]);
    const updated = all
      .filter((a) => mode === 'cancel' || !following.has(a.id))
      .map((a) => {
        const copy: Appointment = { ...a, status: following.has(a.id) ? 'annullato' : a.status };
        delete copy.openEnded;
        return copy;
      });
    await db.appointments.bulkPut(updated);
  });
  return async () => {
    await db.transaction('rw', db.appointments, async () => {
      await db.appointments.where('seriesId').equals(seriesId).delete();
      await db.appointments.bulkPut(all);
    });
  };
}

/** Allunga le serie «Sempre» (all'avvio dell'app). Ritorna quanti appuntamenti ha aggiunto. */
export async function topUpOpenSeries(now: number = Date.now()): Promise<number> {
  const withSeries = await db.appointments.where('seriesId').above('').toArray();
  const extra = extendOpenSeries(withSeries, now, newId);
  if (extra.length) await db.appointments.bulkPut(extra);
  return extra.length;
}

/** Applica la modifica di una serie (vedi planSeriesUpdate). Ritorna una funzione per annullare. */
export async function applySeriesUpdate(seriesId: string, plan: { removeIds: string[]; add: Appointment[] }): Promise<() => Promise<void>> {
  const before = await db.appointments.where('seriesId').equals(seriesId).toArray();
  await db.transaction('rw', db.appointments, async () => {
    await db.appointments.bulkDelete(plan.removeIds);
    await db.appointments.bulkPut(plan.add);
  });
  return async () => {
    await db.transaction('rw', db.appointments, async () => {
      await db.appointments.where('seriesId').equals(seriesId).delete();
      await db.appointments.bulkPut(before);
    });
  };
}
