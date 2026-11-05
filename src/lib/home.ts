/** Funzioni pure per la schermata Home (testate in home.test.ts). */
import { addDays, differenceInCalendarDays, startOfDay } from 'date-fns';
import type { Appointment } from '../db/types';
import { fmt } from './format';

/** Appuntamenti già finiti ma ancora "programmati": vanno incassati (o segnati come assenti). */
export function pendingCheckout(appts: Appointment[], now: number): Appointment[] {
  return appts.filter((a) => a.status === 'programmato' && a.end <= now).sort((a, b) => b.start - a.start);
}

/** Prossimi appuntamenti programmati (compreso quello in corso), dal più vicino. */
export function upcomingAppointments(appts: Appointment[], now: number, limit = 5): Appointment[] {
  return appts
    .filter((a) => a.status === 'programmato' && a.end > now)
    .sort((a, b) => a.start - b.start)
    .slice(0, limit);
}

/** Incassi (mance incluse) degli ultimi `days` giorni, oggi compreso, dal più vecchio. */
export function dailyCollected(appts: Appointment[], days: number, now: number) {
  const today = startOfDay(new Date(now));
  const out = Array.from({ length: days }, (_, i) => {
    const d = addDays(today, i - days + 1);
    return { date: d, label: fmt(d, 'EEEEE'), cents: 0 };
  });
  for (const a of appts) {
    if (a.status !== 'completato') continue;
    const idx = differenceInCalendarDays(new Date(a.start), today) + days - 1;
    if (idx >= 0 && idx < days) out[idx].cents += a.amountCents + a.tipCents;
  }
  return out;
}

/** "In corso", "tra 25 min", "alle 15:30", "domani alle 9:00", "ven 7 nov alle 10:00". */
export function relativeStart(a: Pick<Appointment, 'start' | 'end'>, now: number): string {
  if (a.start <= now && now < a.end) return 'In corso';
  const mins = Math.round((a.start - now) / 60000);
  if (mins >= 0 && mins < 60) return mins <= 1 ? 'Tra un minuto' : `Tra ${mins} min`;
  const days = differenceInCalendarDays(new Date(a.start), new Date(now));
  const time = fmt(a.start, 'HH:mm');
  if (days === 0) return `Oggi alle ${time}`;
  if (days === 1) return `Domani alle ${time}`;
  return `${fmt(a.start, 'EEE d MMM')} alle ${time}`;
}

export function greeting(now: number): string {
  const h = new Date(now).getHours();
  if (h >= 5 && h < 13) return 'Buongiorno';
  if (h >= 13 && h < 18) return 'Buon pomeriggio';
  return 'Buonasera';
}
