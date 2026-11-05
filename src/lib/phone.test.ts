import { describe, expect, it } from 'vitest';
import { formatPhone, normalizePhone, smsLink, whatsappLink, whatsappNumber } from './phone';

describe('normalizePhone', () => {
  it.each([
    ['333 123 4567', '+393331234567'],
    ['3331234567', '+393331234567'],
    ['333-123-45-67', '+393331234567'],
    ['(333) 1234567', '+393331234567'],
    ['+39 333 1234567', '+393331234567'],
    ['0039 333 1234567', '+393331234567'],
    ['393331234567', '+393331234567'],
    ['06 1234 5678', '+390612345678'],
    ['+39 06 12345678', '+390612345678'],
    ['+44 20 7946 0958', '+442079460958'],
    ['3912345678', '+393912345678'], // cellulare 391… senza prefisso
  ])('%s → %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(['', '   ', 'abc', '12', '+12'])('rifiuta %j', (input) => {
    expect(normalizePhone(input)).toBeNull();
  });
});

describe('link', () => {
  it('wa.me senza + e con testo codificato', () => {
    expect(whatsappNumber('333 1234567')).toBe('393331234567');
    expect(whatsappLink('333 1234567', 'Ciao Marco, a domani alle 10:00!')).toBe(
      'https://wa.me/393331234567?text=Ciao%20Marco%2C%20a%20domani%20alle%2010%3A00!',
    );
    expect(whatsappLink('xx', 'ciao')).toBeNull();
  });
  it('sms con body', () => {
    expect(smsLink('3331234567', 'a b')).toBe('sms:+393331234567&body=a%20b');
  });
  it('formattazione leggibile', () => {
    expect(formatPhone('3331234567')).toBe('+39 333 123 4567');
  });
});
