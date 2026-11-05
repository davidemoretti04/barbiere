export interface IcsEvent {
  uid: string;
  start: number;
  end: number;
  summary: string;
  description?: string;
  location?: string;
  /** Minuti di preavviso per l'avviso del Calendario (opzionale). */
  alarmMinutesBefore?: number;
  /** Ripetizione settimanale senza fine (serie «Sempre»): ogni N settimane. */
  repeatWeeks?: number;
}

/** Fuso orario italiano, necessario perché una ripetizione resti alla stessa ora anche col cambio d'ora. */
export const ROME_TZID = 'Europe/Rome';
const ROME_VTIMEZONE = [
  'BEGIN:VTIMEZONE',
  `TZID:${ROME_TZID}`,
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:+0100',
  'TZOFFSETTO:+0200',
  'TZNAME:CEST',
  'DTSTART:19700329T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:+0200',
  'TZOFFSETTO:+0100',
  'TZNAME:CET',
  'DTSTART:19701025T030000',
  'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
];

/** Data/ora locale (ora del telefono) in formato iCalendar: 20261105T103000 */
export function icsLocalDate(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/** Data/ora UTC in formato iCalendar: 20261105T143000Z */
export function icsDate(ms: number): string {
  return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** Escape dei caratteri speciali nei campi di testo (RFC 5545 §3.3.11). */
export function icsEscape(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Spezza le righe oltre 75 ottetti (RFC 5545 §3.1), senza spezzare caratteri UTF-8. */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = '';
  let bytes = 0;
  let limit = 75;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (bytes + b > limit) {
      parts.push(current);
      current = '';
      bytes = 0;
      limit = 74; // le righe successive iniziano con uno spazio
    }
    current += ch;
    bytes += b;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

function eventLines(event: IcsEvent, now: number): string[] {
  const lines = [
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${icsDate(now)}`,
  ];
  if (event.repeatWeeks) {
    // ora locale italiana + regola di ripetizione senza fine: il Calendario la mostra sempre alla stessa ora
    lines.push(
      `DTSTART;TZID=${ROME_TZID}:${icsLocalDate(event.start)}`,
      `DTEND;TZID=${ROME_TZID}:${icsLocalDate(event.end)}`,
      `RRULE:FREQ=WEEKLY;INTERVAL=${Math.max(1, Math.round(event.repeatWeeks))}`,
    );
  } else {
    lines.push(`DTSTART:${icsDate(event.start)}`, `DTEND:${icsDate(event.end)}`);
  }
  lines.push(`SUMMARY:${icsEscape(event.summary)}`);
  if (event.description) lines.push(`DESCRIPTION:${icsEscape(event.description)}`);
  if (event.location) lines.push(`LOCATION:${icsEscape(event.location)}`);
  if (event.alarmMinutesBefore && event.alarmMinutesBefore > 0) {
    lines.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${icsEscape(event.summary)}`,
      `TRIGGER:-PT${Math.round(event.alarmMinutesBefore)}M`,
      'END:VALARM',
    );
  }
  lines.push('END:VEVENT');
  return lines;
}

/** Calendario con uno o più eventi (es. tutta una serie ricorrente: iOS propone «Aggiungi tutti»). */
export function buildIcsCalendar(events: IcsEvent[], now: number = Date.now()): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Barbiere Gestionale//IT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...(events.some((e) => e.repeatWeeks) ? ROME_VTIMEZONE : []),
    ...events.flatMap((e) => eventLines(e, now)),
    'END:VCALENDAR',
  ];
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

export function buildIcs(event: IcsEvent, now: number = Date.now()): string {
  return buildIcsCalendar([event], now);
}
