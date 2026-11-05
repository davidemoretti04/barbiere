import type { Cents } from '../db/types';

const eur = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });
const eurShort = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

export function formatEuro(cents: Cents): string {
  return eur.format(cents / 100);
}

/** Formato compatto senza decimali (per grafici). */
export function formatEuroShort(cents: Cents): string {
  return eurShort.format(Math.round(cents / 100));
}

/** Valore da mostrare in un campo di input: "12,50" o "" se zero e allowEmpty. */
export function centsToInput(cents: Cents): string {
  const v = (cents / 100).toFixed(2).replace('.', ',');
  return v.endsWith(',00') ? v.slice(0, -3) : v;
}

/**
 * Converte un testo inserito dall'utente in centesimi.
 * Accetta "12", "12,5", "12.50", "€ 12,50", "1.200,00". Ritorna null se non valido.
 */
export function parseEuro(input: string): Cents | null {
  let s = input.replace(/[€\s]/g, '');
  if (s === '') return null;
  if (s.includes(',')) {
    // formato italiano: i punti sono separatori delle migliaia
    s = s.replace(/\./g, '').replace(',', '.');
  } else if ((s.match(/\./g) ?? []).length > 1) {
    s = s.replace(/\./g, '');
  }
  if (!/^-?\d+(\.\d{0,2})?$/.test(s)) return null;
  const n = Math.round(parseFloat(s) * 100);
  return Number.isFinite(n) ? n : null;
}
