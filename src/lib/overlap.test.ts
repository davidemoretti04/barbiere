import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type Appointment } from '../db/types';
import { findOverlaps, intervalsOverlap, layoutColumns } from './overlap';
import { isWithinWorkingHours, nextFreeSlot } from './schedule';

const at = (h: number, m = 0, day = 5) => new Date(2026, 10, day, h, m).getTime();
const appt = (id: string, s: number, e: number, status: Appointment['status'] = 'programmato'): Appointment => ({
  id,
  clientId: 'c',
  start: s,
  end: e,
  services: [],
  status,
  amountCents: 0,
  tipCents: 0,
  notes: '',
});

describe('sovrapposizioni', () => {
  it('intervalli adiacenti non si sovrappongono', () => {
    expect(intervalsOverlap({ start: at(9), end: at(10) }, { start: at(10), end: at(11) })).toBe(false);
    expect(intervalsOverlap({ start: at(9), end: at(10, 1) }, { start: at(10), end: at(11) })).toBe(true);
    expect(intervalsOverlap({ start: at(9), end: at(12) }, { start: at(10), end: at(11) })).toBe(true);
  });

  it('ignora annullati, non presentati e quello in modifica', () => {
    const list = [
      appt('a', at(9), at(9, 30)),
      appt('b', at(9, 15), at(9, 45), 'annullato'),
      appt('c', at(9, 15), at(9, 45), 'non_presentato'),
      appt('d', at(9, 20), at(10), 'completato'),
    ];
    const res = findOverlaps({ start: at(9, 10), end: at(9, 40) }, list, 'a').map((x) => x.id);
    expect(res).toEqual(['d']);
  });

  it('colonne per la vista giorno', () => {
    const cols = layoutColumns([
      { id: 'a', start: at(9), end: at(10) },
      { id: 'b', start: at(9, 30), end: at(10, 30) },
      { id: 'c', start: at(10), end: at(11) },
      { id: 'd', start: at(12), end: at(13) },
    ]);
    expect(cols.get('a')).toEqual({ col: 0, cols: 2 });
    expect(cols.get('b')).toEqual({ col: 1, cols: 2 });
    expect(cols.get('c')).toEqual({ col: 0, cols: 2 });
    expect(cols.get('d')).toEqual({ col: 0, cols: 1 });
  });
});

describe('orario di lavoro', () => {
  const s = DEFAULT_SETTINGS; // lun–ven 9–13 / 15–19:30, sab 9–18, dom chiuso
  it('dentro e fuori fascia', () => {
    // 5/11/2026 è un giovedì
    expect(isWithinWorkingHours(at(9), at(9, 30), s)).toBe(true);
    expect(isWithinWorkingHours(at(12, 45), at(13, 15), s)).toBe(false); // sconfina nella pausa
    expect(isWithinWorkingHours(at(14), at(14, 30), s)).toBe(false);
    expect(isWithinWorkingHours(at(19), at(19, 30), s)).toBe(true);
    expect(isWithinWorkingHours(at(10, 0, 9), at(10, 30, 9), s)).toBe(true); // lunedì aperto di default
    expect(isWithinWorkingHours(at(10, 0, 8), at(10, 30, 8), s)).toBe(false); // domenica chiuso
    const closedMonday = { ...s, workingHours: { ...s.workingHours, 1: [] } };
    expect(isWithinWorkingHours(at(10, 0, 9), at(10, 30, 9), closedMonday)).toBe(false);
  });
  it('ferie', () => {
    const withClosure = { ...s, closures: [{ id: 'x', from: '2026-11-04', to: '2026-11-06', label: 'Ferie' }] };
    expect(isWithinWorkingHours(at(9), at(9, 30), withClosure)).toBe(false);
  });
  it('primo slot libero', () => {
    const busy = [appt('a', at(9), at(9, 30)), appt('b', at(9, 30), at(10))];
    expect(nextFreeSlot(new Date(at(8)), 30, s, busy).getTime()).toBe(at(10));
    // dopo le 19:00 di giovedì → venerdì alle 9
    expect(nextFreeSlot(new Date(at(19, 10)), 30, s, []).getTime()).toBe(at(9, 0, 6));
  });
});
