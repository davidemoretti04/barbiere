import { addDays, format } from 'date-fns';
import { WEEKDAYS, type Settings, type TimeRange, type Weekday, type WorkingHours } from '../db/types';

/** "09:30" → 570 minuti dalla mezzanotte. */
export function parseHM(hm: string): number {
  const [h, m] = hm.split(':').map((x) => parseInt(x, 10));
  return (h || 0) * 60 + (m || 0);
}

export function formatHM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Data locale al minuto indicato del giorno (sicuro con l'ora legale). */
export function atMinutes(day: Date, minutes: number): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(minutes / 60), minutes % 60);
}

/** Minuti dalla mezzanotte locale. */
export function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

export function isoWeekday(d: Date): Weekday {
  const w = d.getDay();
  return (w === 0 ? 7 : w) as Weekday;
}

export function toDateKey(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map((x) => parseInt(x, 10));
  return new Date(y, (m || 1) - 1, d || 1);
}

export function closureFor(d: Date, settings: Pick<Settings, 'closures'>) {
  const key = toDateKey(d);
  return settings.closures.find((c) => c.from <= key && key <= (c.to || c.from));
}

/** Fasce lavorative del giorno (vuoto se chiuso o in ferie). */
export function workRangesFor(d: Date, settings: Pick<Settings, 'closures' | 'workingHours'>): TimeRange[] {
  if (closureFor(d, settings)) return [];
  return [...(settings.workingHours[isoWeekday(d)] ?? [])].sort((a, b) => parseHM(a.start) - parseHM(b.start));
}

/** true se l'intervallo è interamente dentro una fascia lavorativa dello stesso giorno. */
export function isWithinWorkingHours(
  start: number,
  end: number,
  settings: Pick<Settings, 'closures' | 'workingHours'>,
): boolean {
  const s = new Date(start);
  const e = new Date(end);
  if (toDateKey(s) !== toDateKey(e) && minutesOfDay(e) !== 0) return false;
  const sm = minutesOfDay(s);
  const em = toDateKey(s) === toDateKey(e) ? minutesOfDay(e) : 24 * 60;
  return workRangesFor(s, settings).some((r) => parseHM(r.start) <= sm && em <= parseHM(r.end));
}

/** Arrotonda in avanti al prossimo slot. */
export function roundUpToSlot(d: Date, slotMinutes: number): Date {
  const m = minutesOfDay(d);
  const rounded = Math.ceil(m / slotMinutes) * slotMinutes;
  if (rounded >= 24 * 60) return atMinutes(addDays(d, 1), 0);
  return atMinutes(d, rounded);
}

/**
 * Primo orario libero utile a partire da `from` (entro 14 giorni), per il tasto "+".
 */
export function nextFreeSlot(
  from: Date,
  durationMinutes: number,
  settings: Settings,
  busy: { start: number; end: number }[],
): Date {
  const slot = Math.max(5, settings.slotMinutes);
  let day = from;
  for (let i = 0; i < 14; i++) {
    const ranges = workRangesFor(day, settings);
    for (const r of ranges) {
      let m = parseHM(r.start);
      const endM = parseHM(r.end);
      if (i === 0) m = Math.max(m, Math.ceil(minutesOfDay(from) / slot) * slot);
      for (; m + durationMinutes <= endM; m += slot) {
        const s = atMinutes(day, m).getTime();
        const e = s + durationMinutes * 60000;
        if (!busy.some((b) => b.start < e && s < b.end)) return new Date(s);
      }
    }
    day = atMinutes(addDays(day, 1), 0);
  }
  return roundUpToSlot(from, slot);
}

export const SLOT_PRESETS = [15, 30, 45, 60];

export const WEEKDAY_NAMES: Record<Weekday, string> = {
  1: 'Lunedì',
  2: 'Martedì',
  3: 'Mercoledì',
  4: 'Giovedì',
  5: 'Venerdì',
  6: 'Sabato',
  7: 'Domenica',
};

/** Messaggio d'errore se gli orari di lavoro non sono coerenti, altrimenti null. */
export function hoursProblem(wh: WorkingHours): string | null {
  for (const d of WEEKDAYS) {
    const rs = [...(wh[d] ?? [])].sort((a, b) => parseHM(a.start) - parseHM(b.start));
    for (let i = 0; i < rs.length; i++) {
      if (parseHM(rs[i].end) <= parseHM(rs[i].start)) return `${WEEKDAY_NAMES[d]}: l’orario di fine deve essere dopo l’inizio.`;
      if (i > 0 && parseHM(rs[i].start) < parseHM(rs[i - 1].end)) return `${WEEKDAY_NAMES[d]}: due fasce si sovrappongono.`;
    }
  }
  return null;
}
