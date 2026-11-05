import { describe, expect, it } from 'vitest';
import { fillTemplate } from './format';
import { centsToInput, formatEuro, parseEuro } from './money';

describe('importi', () => {
  it.each([
    ['12', 1200],
    ['12,5', 1250],
    ['12,50', 1250],
    ['12.50', 1250],
    ['€ 12,50', 1250],
    ['1.200,00', 120000],
    ['0,1', 10],
    ['0.07', 7],
  ])('parseEuro(%j) = %i', (s, c) => expect(parseEuro(s)).toBe(c));

  it.each(['', 'abc', '12,345', '1,2,3'])('parseEuro(%j) = null', (s) => expect(parseEuro(s)).toBeNull());

  it('nessun errore di arrotondamento', () => {
    expect(parseEuro('0,29')).toBe(29);
    expect(parseEuro('1,15')).toBe(115);
  });

  it('formattazione italiana', () => {
    // le regole italiane (CLDR) separano le migliaia solo da 5 cifre in su
    expect(formatEuro(1234567).replace(/\s/g, ' ')).toBe('12.345,67 €');
    expect(formatEuro(1850).replace(/\s/g, ' ')).toBe('18,50 €');
    expect(centsToInput(1800)).toBe('18');
    expect(centsToInput(1850)).toBe('18,50');
  });
});

describe('template promemoria', () => {
  it('sostituisce i segnaposto e lascia quelli sconosciuti', () => {
    expect(fillTemplate('Ciao {nome}, {data} alle {ora} {altro}', { nome: 'Luca', data: 'giovedì 5 novembre', ora: '10:00' })).toBe(
      'Ciao Luca, giovedì 5 novembre alle 10:00 {altro}',
    );
    expect(fillTemplate('{NOME}', { nome: 'A' })).toBe('A');
  });
});
