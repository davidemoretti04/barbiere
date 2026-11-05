import Dexie from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getSettings } from './db';

export const useSettings = () => useLiveQuery(() => getSettings(), []);
export const useClients = () => useLiveQuery(() => db.clients.toArray(), []);
/** undefined = in caricamento, null = non trovato */
export const useClient = (id: string | undefined) =>
  useLiveQuery(async () => (id ? ((await db.clients.get(id)) ?? null) : null), [id]);
export const useServices = () => useLiveQuery(() => db.services.toArray(), []);
export const useExpenses = () => useLiveQuery(() => db.expenses.orderBy('date').reverse().toArray(), []);
export const useAllAppointments = () => useLiveQuery(() => db.appointments.toArray(), []);
export const useAppointment = (id: string | undefined) =>
  useLiveQuery(() => (id ? db.appointments.get(id) : undefined), [id]);

/** Appuntamenti con inizio in [start, end) — usa l'indice su "start". */
export const useAppointmentsBetween = (start: number, end: number) =>
  useLiveQuery(() => db.appointments.where('start').between(start, end, true, false).sortBy('start'), [start, end]);

/** Appuntamenti di un cliente, dal più recente — usa l'indice composto [clientId+start]. */
export const useClientAppointments = (clientId: string | undefined) =>
  useLiveQuery(
    async () =>
      clientId
        ? (
            await db.appointments
              .where('[clientId+start]')
              .between([clientId, Dexie.minKey], [clientId, Dexie.maxKey])
              .toArray()
          ).reverse()
        : [],
    [clientId],
  );

export const useHasData = () =>
  useLiveQuery(async () => (await db.clients.count()) + (await db.appointments.count()) > 0, []);
