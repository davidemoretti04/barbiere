import type { Client } from '../db/types';
import { normalizePhone } from './phone';

/** Testo confrontabile: minuscolo, senza accenti e spazi superflui. */
const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/** Ricerca cliente per nome, cognome (in qualsiasi ordine) o parte del numero di telefono. Ignora maiuscole e accenti. */
export function matchClient(c: Client, q: string): boolean {
  const query = norm(q);
  if (!query) return true;
  const full = norm(`${c.firstName} ${c.lastName}`);
  const rev = norm(`${c.lastName} ${c.firstName}`);
  const digits = query.replace(/\D/g, '');
  return (
    full.includes(query) ||
    rev.includes(query) ||
    (digits.length >= 3 && c.phone.replace(/\D/g, '').includes(digits))
  );
}

/** Telefono confrontabile: stesso numero anche se scritto in modi diversi (+39, spazi, trattini). */
const normPhone = (p: string) => {
  const t = p.trim();
  if (!t) return '';
  return normalizePhone(t) ?? t.replace(/\D/g, '');
};

/**
 * Chiave di un cliente: due clienti sono «lo stesso» se nome, cognome e telefono coincidono
 * (anche se entrambi senza telefono). Stesso nome con telefono diverso = clienti diversi.
 */
export function clientKey(c: Pick<Client, 'firstName' | 'lastName' | 'phone'>): string {
  return `${norm(c.firstName)}|${norm(c.lastName)}|${normPhone(c.phone)}`;
}

/** Cliente attivo (non eliminato). */
export const isActiveClient = (c: Pick<Client, 'deletedAt'>) => !c.deletedAt;

/** Cliente già presente con gli stessi dati (escluso quello in modifica e quelli eliminati). */
export function findDuplicateClient(
  clients: Client[],
  data: Pick<Client, 'firstName' | 'lastName' | 'phone'>,
  excludeId?: string,
): Client | undefined {
  if (!norm(data.firstName)) return undefined;
  const key = clientKey(data);
  return clients.find((c) => c.id !== excludeId && isActiveClient(c) && clientKey(c) === key);
}
