import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createClient, DuplicateClientError, saveClient } from '../db/actions';
import { db } from '../db/db';
import type { Client } from '../db/types';
import { clientKey, findDuplicateClient, matchClient } from './search';

const c = (id: string, firstName: string, lastName: string, phone: string): Client => ({ id, firstName, lastName, phone, notes: '', createdAt: 0 });

describe('clienti duplicati (regola)', () => {
  const list = [c('1', 'Mario', 'Rossi', '333 123 4567'), c('2', 'Luca', 'Bianchi', ''), c('3', 'Mario', 'Rossi', '347 000 1111')];

  it('stessi dati scritti in modo diverso = stesso cliente', () => {
    expect(findDuplicateClient(list, { firstName: ' mario ', lastName: 'ROSSI', phone: '+39 333-123-45-67' })?.id).toBe('1');
    expect(findDuplicateClient(list, { firstName: 'Mário', lastName: 'Rossi', phone: '00393331234567' })?.id).toBe('1');
    expect(clientKey({ firstName: 'Luca', lastName: 'Bianchi', phone: '' })).toBe(clientKey(list[1]));
  });

  it('stesso nome ma telefono diverso = clienti diversi', () => {
    expect(findDuplicateClient(list, { firstName: 'Mario', lastName: 'Rossi', phone: '320 999 8888' })).toBeUndefined();
    expect(findDuplicateClient(list, { firstName: 'Luca', lastName: 'Bianchi', phone: '333 555 6666' })).toBeUndefined();
  });

  it('senza telefono vale il confronto senza telefono', () => {
    expect(findDuplicateClient(list, { firstName: 'Luca', lastName: 'Bianchi', phone: '  ' })?.id).toBe('2');
  });

  it('la ricerca ignora gli accenti', () => {
    expect(matchClient(c('n', 'Nicolò', 'Società', ''), 'nicolo societa')).toBe(true);
    expect(matchClient(c('n', 'Nicolo', 'Rossi', ''), 'nicolò')).toBe(true);
  });

  it('in modifica ignora sé stesso; nome vuoto non è mai duplicato', () => {
    expect(findDuplicateClient(list, list[0], '1')).toBeUndefined();
    expect(findDuplicateClient(list, { firstName: '', lastName: '', phone: '' })).toBeUndefined();
  });
});

describe('clienti duplicati (database)', () => {
  beforeEach(async () => {
    await db.clients.clear();
  });

  it('il secondo cliente identico viene rifiutato, anche con due salvataggi insieme', async () => {
    const data = { firstName: 'Mario', lastName: 'Rossi', phone: '333 123 4567', notes: '' };
    const results = await Promise.allSettled([createClient(data), createClient(data), createClient({ ...data, phone: '3331234567' })]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(rejected.every((r) => r.reason instanceof DuplicateClientError)).toBe(true);
    expect(await db.clients.count()).toBe(1);
    // stesso nome, altro numero: permesso
    await createClient({ ...data, phone: '320 111 2222' });
    expect(await db.clients.count()).toBe(2);
  });

  it('una modifica che renderebbe due clienti identici viene rifiutata', async () => {
    const a = await createClient({ firstName: 'Anna', lastName: 'Verdi', phone: '333 1', notes: '' }).catch(() => null);
    const b = await createClient({ firstName: 'Anna', lastName: 'Verdi', phone: '3401112222', notes: '' });
    const first = a ?? (await createClient({ firstName: 'Anna', lastName: 'Verdi', phone: '3331112222', notes: '' }));
    await expect(saveClient({ ...b, phone: first.phone })).rejects.toBeInstanceOf(DuplicateClientError);
    await expect(saveClient({ ...b, notes: 'ok' })).resolves.toBeUndefined();
  });

  it('due clienti già doppi (dati vecchi) si possono ancora modificare', async () => {
    const a: Client = { id: 'a', firstName: 'Anna', lastName: 'Verdi', phone: '3331112222', notes: '', createdAt: 0 };
    await db.clients.bulkPut([a, { ...a, id: 'b' }]);
    await expect(saveClient({ ...a, notes: 'nuova nota' })).resolves.toBeUndefined();
  });
});
