import { describe, expect, it } from 'vitest';
import { buildIcs, foldLine, icsDate, icsEscape } from './ics';

describe('ics', () => {
  const start = new Date(2026, 10, 5, 10, 30).getTime(); // 5/11/2026 10:30 ora italiana (CET, UTC+1)
  const end = start + 45 * 60000;
  const ics = buildIcs(
    {
      uid: 'abc-123@barbiere',
      start,
      end,
      summary: 'Barbiere: Taglio + barba',
      description: 'Cliente: Mario Rossi; note: sfumatura, corta\nsecondo rigo',
      alarmMinutesBefore: 60,
    },
    Date.UTC(2026, 10, 1, 8, 0, 0),
  );

  it('struttura valida con CRLF', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
    expect(ics.endsWith('END:VEVENT\r\nEND:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('\r\nPRODID:');
    expect(ics).toContain('\r\nUID:abc-123@barbiere\r\n');
    expect(ics).toContain('\r\nDTSTAMP:20261101T080000Z\r\n');
    expect(ics.split('\r\n').every((l) => !l.includes('\n'))).toBe(true);
  });

  it('orari convertiti in UTC (CET = UTC+1)', () => {
    expect(ics).toContain('DTSTART:20261105T093000Z');
    expect(ics).toContain('DTEND:20261105T101500Z');
  });

  it('ora legale: in estate UTC+2', () => {
    expect(icsDate(new Date(2026, 6, 1, 10, 0).getTime())).toBe('20260701T080000Z');
  });

  it('escape dei caratteri speciali', () => {
    expect(icsEscape('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne');
    expect(ics).toContain('DESCRIPTION:Cliente: Mario Rossi\\; note: sfumatura\\, corta\\nsecondo rigo');
  });

  it('allarme', () => {
    expect(ics).toContain('BEGIN:VALARM\r\nACTION:DISPLAY');
    expect(ics).toContain('TRIGGER:-PT60M');
  });

  it('piega le righe lunghe a 75 ottetti senza spezzare caratteri', () => {
    const long = 'SUMMARY:' + 'è'.repeat(80);
    const folded = foldLine(long);
    const parts = folded.split('\r\n ');
    expect(parts.length).toBeGreaterThan(1);
    const enc = new TextEncoder();
    expect(enc.encode(parts[0]).length).toBeLessThanOrEqual(75);
    for (const p of parts.slice(1)) expect(enc.encode(' ' + p).length).toBeLessThanOrEqual(75);
    expect(parts.join('')).toBe(long);
  });
});
