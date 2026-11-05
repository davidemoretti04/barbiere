import type { Appointment, Client } from '../db/types';
import { clientName, fmt, PAYMENT_LABEL, servicesLabel } from './format';

/** CSV con separatore ";" e BOM UTF-8: si apre correttamente in Excel italiano. */
export function toCsv(rows: (string | number)[][]): string {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + rows.map((r) => r.map(esc).join(';')).join('\r\n') + '\r\n';
}

const euro = (c: number) => (c / 100).toFixed(2).replace('.', ',');

export function revenueCsv(appts: Appointment[], clients: Client[]): string {
  const byId = new Map(clients.map((c) => [c.id, c]));
  const rows: (string | number)[][] = [
    ['Data', 'Ora', 'Cliente', 'Servizi', 'Importo (EUR)', 'Mancia (EUR)', 'Totale (EUR)', 'Metodo di pagamento'],
  ];
  for (const a of appts.filter((x) => x.status === 'completato').sort((x, y) => x.start - y.start)) {
    rows.push([
      fmt(a.start, 'dd/MM/yyyy'),
      fmt(a.start, 'HH:mm'),
      clientName(byId.get(a.clientId)),
      servicesLabel(a),
      euro(a.amountCents),
      euro(a.tipCents),
      euro(a.amountCents + a.tipCents),
      a.paymentMethod ? PAYMENT_LABEL[a.paymentMethod] : '',
    ]);
  }
  return toCsv(rows);
}

export function clientsCsv(clients: Client[], appts: Appointment[]): string {
  const rows: (string | number)[][] = [['Nome', 'Cognome', 'Telefono', 'Visite', 'Totale speso (EUR)', 'Note']];
  const agg = new Map<string, { visits: number; total: number }>();
  for (const a of appts) {
    if (a.status !== 'completato') continue;
    const g = agg.get(a.clientId) ?? { visits: 0, total: 0 };
    g.visits++;
    g.total += a.amountCents + a.tipCents;
    agg.set(a.clientId, g);
  }
  for (const c of [...clients].sort((a, b) => clientName(a).localeCompare(clientName(b), 'it'))) {
    const g = agg.get(c.id) ?? { visits: 0, total: 0 };
    rows.push([c.firstName, c.lastName, c.phone, g.visits, euro(g.total), c.notes]);
  }
  return toCsv(rows);
}
