import { describe, expect, it } from 'vitest';
import type { Appointment } from '../db/types';
import { dailyCollected, greeting, pendingCheckout, relativeStart, upcomingAppointments } from './home';

const t = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m).getTime(); // ottobre 2026
let n = 0;
const appt = (start: number, status: Appointment['status'] = 'programmato', amount = 1800, tip = 0): Appointment => ({
  id: `a${n++}`,
  clientId: 'c',
  start,
  end: start + 30 * 60000,
  services: [],
  status,
  amountCents: amount,
  tipCents: tip,
  notes: '',
});

describe('home', () => {
  const now = t(26, 10, 15); // lunedì 26/10, il giorno dopo il ritorno all'ora solare
  const list = [
    appt(t(26, 9, 0)), // finito, da incassare
    appt(t(25, 18, 0)), // ieri, da incassare
    appt(t(26, 10, 0)), // in corso
    appt(t(26, 11, 0)),
    appt(t(27, 9, 0)),
    appt(t(26, 8, 0), 'completato', 2000, 300),
    appt(t(25, 23, 30), 'completato', 1000), // domenica da 25 ore, a tarda sera
    appt(t(20, 10, 0), 'completato', 500), // fuori dai 7 giorni
    appt(t(26, 12, 0), 'annullato'),
  ];

  it('da incassare: finiti ma ancora programmati, dal più recente', () => {
    expect(pendingCheckout(list, now).map((a) => a.start)).toEqual([t(26, 9), t(25, 18)]);
  });

  it('prossimi: include quello in corso, esclude annullati', () => {
    expect(upcomingAppointments(list, now).map((a) => a.start)).toEqual([t(26, 10), t(26, 11), t(27, 9)]);
  });

  it('incassi degli ultimi 7 giorni, con il cambio d’ora', () => {
    const d = dailyCollected(list, 7, now);
    expect(d).toHaveLength(7);
    expect(d[6].cents).toBe(2300); // oggi, mancia inclusa
    expect(d[5].cents).toBe(1000); // domenica 25
    expect(d[0].date).toEqual(new Date(2026, 9, 20));
    expect(d[0].cents).toBe(500);
    expect(d[6].label).toBe('L');
  });

  it('orario relativo', () => {
    expect(relativeStart({ start: t(26, 10), end: t(26, 10, 30) }, now)).toBe('In corso');
    expect(relativeStart({ start: t(26, 10, 40), end: t(26, 11) }, now)).toBe('Tra 25 min');
    expect(relativeStart({ start: t(26, 15, 30), end: t(26, 16) }, now)).toBe('Oggi alle 15:30');
    expect(relativeStart({ start: t(27, 9), end: t(27, 9, 30) }, now)).toBe('Domani alle 09:00');
    expect(relativeStart({ start: t(30, 9), end: t(30, 9, 30) }, now)).toBe('ven 30 ott alle 09:00');
  });

  it('saluto', () => {
    expect(greeting(t(26, 8))).toBe('Buongiorno');
    expect(greeting(t(26, 15))).toBe('Buon pomeriggio');
    expect(greeting(t(26, 21))).toBe('Buonasera');
  });
});
