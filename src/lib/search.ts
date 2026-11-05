import type { Client } from '../db/types';

/** Ricerca cliente per nome, cognome (in qualsiasi ordine) o parte del numero di telefono. */
export function matchClient(c: Client, q: string): boolean {
  const query = q.trim().toLowerCase();
  if (!query) return true;
  const full = `${c.firstName} ${c.lastName}`.toLowerCase();
  const rev = `${c.lastName} ${c.firstName}`.toLowerCase();
  const digits = query.replace(/\D/g, '');
  return (
    full.includes(query) ||
    rev.includes(query) ||
    (digits.length >= 3 && c.phone.replace(/\D/g, '').includes(digits))
  );
}
