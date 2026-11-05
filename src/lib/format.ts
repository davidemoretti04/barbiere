import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import type { Appointment, Client } from '../db/types';

export const fmt = (d: Date | number, pattern: string) => format(d, pattern, { locale: it });

export const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function clientName(c: Pick<Client, 'firstName' | 'lastName'> | undefined): string {
  if (!c) return 'Cliente eliminato';
  return [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Senza nome';
}

export function initials(c: Pick<Client, 'firstName' | 'lastName'>): string {
  return ((c.firstName[0] ?? '') + (c.lastName[0] ?? '')).toUpperCase() || '?';
}

export function servicesLabel(a: Pick<Appointment, 'services'>): string {
  return a.services.map((s) => s.name).join(' + ') || 'Appuntamento';
}

export function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Sostituisce i segnaposto {nome}, {data}, {ora} nel template del promemoria. */
export function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key.toLowerCase()] ?? match);
}

export function reminderText(template: string, client: Client | undefined, appt: Pick<Appointment, 'start'>): string {
  return fillTemplate(template, {
    nome: client?.firstName || clientName(client),
    data: fmt(appt.start, "EEEE d MMMM"),
    ora: fmt(appt.start, 'HH:mm'),
  });
}

export const STATUS_LABEL: Record<Appointment['status'], string> = {
  programmato: 'Programmato',
  completato: 'Completato',
  annullato: 'Annullato',
  non_presentato: 'Non presentato',
};

export const PAYMENT_LABEL = { contanti: 'Contanti', carta: 'Carta', altro: 'Altro' } as const;
