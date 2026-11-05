/**
 * Normalizza un numero di telefono in formato internazionale E.164 (es. "+393331234567").
 * I numeri italiani senza prefisso ricevono +39. Ritorna null se il numero non è utilizzabile.
 */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  let digits = trimmed.replace(/[^\d+]/g, '');
  if (digits.startsWith('00')) digits = '+' + digits.slice(2);
  if (digits.startsWith('+')) {
    const rest = digits.slice(1).replace(/\+/g, '');
    return rest.length >= 8 && rest.length <= 15 ? '+' + rest : null;
  }
  digits = digits.replace(/\+/g, '');
  // Già con prefisso 39 (es. 39 333 1234567 → 12 cifre; fissi 39 0xx...)
  if (digits.startsWith('39') && digits.length >= 11 && digits.length <= 13) {
    const national = digits.slice(2);
    if (national.startsWith('3') || national.startsWith('0')) return '+' + digits;
  }
  // Cellulari italiani (3xx, 9–10 cifre) e fissi (0xx, 6–11 cifre)
  if (/^3\d{8,9}$/.test(digits) || /^0\d{5,10}$/.test(digits)) return '+39' + digits;
  return null;
}

/** Numero per i link wa.me: solo cifre, senza "+". */
export function whatsappNumber(input: string): string | null {
  const n = normalizePhone(input);
  return n ? n.slice(1) : null;
}

export function whatsappLink(phone: string, text: string): string | null {
  const n = whatsappNumber(phone);
  if (!n) return null;
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
}

/** Link SMS compatibile con iOS ("&body=" dopo il numero). */
export function smsLink(phone: string, text: string): string | null {
  const n = normalizePhone(phone);
  if (!n) return null;
  return `sms:${n}&body=${encodeURIComponent(text)}`;
}

export function telLink(phone: string): string | null {
  const n = normalizePhone(phone);
  return n ? `tel:${n}` : null;
}

/** Formattazione leggibile: "+39 333 123 4567". */
export function formatPhone(input: string): string {
  const n = normalizePhone(input);
  if (!n) return input;
  if (n.startsWith('+39')) {
    const nat = n.slice(3);
    if (nat.startsWith('3') && nat.length === 10) {
      return `+39 ${nat.slice(0, 3)} ${nat.slice(3, 6)} ${nat.slice(6)}`;
    }
    return `+39 ${nat}`;
  }
  return n;
}
