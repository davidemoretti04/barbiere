/**
 * Dati di esempio COMPLETAMENTE FINTI (nomi inventati, numeri 333 000 xxxx non reali).
 * Vengono generati sul telefono solo quando l'utente lo chiede da "Backup e dati".
 */
import { addDays, startOfDay } from 'date-fns';
import { DEFAULT_SETTINGS, type Appointment, type Client, type Expense, type Service, type Settings } from '../db/types';
import type { BackupData } from './backup';
import { atMinutes, parseHM, toDateKey, workRangesFor } from './schedule';

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ['Marco', 'Luca', 'Giovanni', 'Andrea', 'Matteo', 'Paolo', 'Davide', 'Simone', 'Fabio', 'Alessio', 'Stefano', 'Riccardo', 'Lorenzo', 'Tommaso', 'Nicola', 'Pietro', 'Federico', 'Gabriele', 'Emanuele', 'Daniele', 'Antonio', 'Francesco', 'Roberto', 'Michele', 'Enrico', 'Sergio', 'Claudio', 'Filippo'];
const LAST = ['Rossi', 'Bianchi', 'Esposito', 'Romano', 'Colombo', 'Ricci', 'Marino', 'Greco', 'Bruno', 'Gallo', 'Conti', 'De Luca', 'Mancini', 'Costa', 'Giordano', 'Rizzo', 'Lombardi', 'Moretti', 'Barbieri', 'Fontana', 'Santoro', 'Mariani', 'Rinaldi', 'Caruso', 'Ferrara', 'Galli', 'Martini', 'Leone'];

export const SAMPLE_SERVICES: Omit<Service, 'id'>[] = [
  { name: 'Taglio', priceCents: 1800, durationMinutes: 30, active: true },
  { name: 'Barba', priceCents: 1000, durationMinutes: 20, active: true },
  { name: 'Taglio + barba', priceCents: 2500, durationMinutes: 45, active: true },
  { name: 'Rasatura classica', priceCents: 1500, durationMinutes: 30, active: true },
  { name: 'Taglio bambino', priceCents: 1300, durationMinutes: 20, active: true },
];

export function generateSampleData(now: Date = new Date(), settings: Settings = { ...DEFAULT_SETTINGS, onboarded: true }): BackupData {
  const rand = rng(42);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
  const today = startOfDay(now);
  const id = (p: string, n: number) => `esempio-${p}-${n}`;

  const services: Service[] = SAMPLE_SERVICES.map((s, i) => ({ ...s, id: id('servizio', i) }));
  const weights = [0.42, 0.12, 0.3, 0.08, 0.08];
  const pickService = () => {
    const r = rand();
    let acc = 0;
    for (let i = 0; i < weights.length; i++) {
      acc += weights[i];
      if (r < acc) return services[i];
    }
    return services[0];
  };

  // combinazioni nome+cognome tutte diverse, mescolate in modo deterministico
  const pairs = FIRST.flatMap((f) => LAST.map((l) => [f, l] as const));
  for (let i = pairs.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
  }
  const clients: Client[] = Array.from({ length: 110 }, (_, i) => {
    const birthday =
      rand() < 0.5
        ? `${1960 + Math.floor(rand() * 45)}-${String(1 + Math.floor(rand() * 12)).padStart(2, '0')}-${String(1 + Math.floor(rand() * 28)).padStart(2, '0')}`
        : undefined;
    const c: Client = {
      id: id('cliente', i),
      firstName: pairs[i][0],
      lastName: pairs[i][1],
      phone: `333 000 ${String(1000 + i).slice(-4)}`,
      notes: i % 5 === 0 ? 'Preferisce sfumatura bassa' : '',
      createdAt: addDays(today, -150 + Math.floor(rand() * 140)).getTime(),
    };
    if (birthday) c.birthday = birthday;
    return c;
  });

  const appointments: Appointment[] = [];
  let n = 0;
  for (let d = -120; d <= 10; d++) {
    const day = addDays(today, d);
    const ranges = workRangesFor(day, settings);
    for (const r of ranges) {
      let m = parseHM(r.start);
      const end = parseHM(r.end);
      while (m < end) {
        const busy = d < 0 ? 0.62 : d === 0 ? 0.55 : 0.4;
        const svc = pickService();
        if (m + svc.durationMinutes > end) break;
        if (rand() < busy) {
          const client = pick(clients);
          const start = atMinutes(day, m);
          const past = start.getTime() < now.getTime();
          const roll = rand();
          const status: Appointment['status'] = !past
            ? 'programmato'
            : roll < 0.06
              ? 'annullato'
              : roll < 0.09
                ? 'non_presentato'
                : 'completato';
          const extra = status === 'completato' && rand() < 0.1 ? 300 : 0;
          appointments.push({
            id: id('app', n++),
            clientId: client.id,
            start: start.getTime(),
            end: start.getTime() + svc.durationMinutes * 60000,
            services: [{ serviceId: svc.id, name: svc.name, priceCents: svc.priceCents, durationMinutes: svc.durationMinutes }],
            status,
            amountCents: svc.priceCents + extra,
            tipCents: status === 'completato' && rand() < 0.2 ? 200 : 0,
            paymentMethod: status === 'completato' ? (rand() < 0.6 ? 'contanti' : 'carta') : undefined,
            notes: '',
          });
          m += svc.durationMinutes;
        } else {
          m += settings.slotMinutes;
        }
      }
    }
  }
  for (const a of appointments) if (a.paymentMethod === undefined) delete a.paymentMethod;
  // il cliente "esiste" dalla sua prima visita
  for (const c of clients) {
    const first = appointments.filter((a) => a.clientId === c.id).reduce((m, a) => Math.min(m, a.start), Infinity);
    if (Number.isFinite(first)) c.createdAt = Math.min(c.createdAt, first - 3600_000);
  }

  const expenses: Expense[] = [];
  let e = 0;
  for (let mBack = 4; mBack >= 0; mBack--) {
    const first = new Date(today.getFullYear(), today.getMonth() - mBack, 1);
    if (first > today) continue;
    expenses.push({ id: id('spesa', e++), date: toDateKey(first), category: 'Affitto', amountCents: 65000, notes: 'Affitto negozio' });
    const mid = addDays(first, 14);
    if (mid <= today) {
      expenses.push({ id: id('spesa', e++), date: toDateKey(mid), category: 'Prodotti', amountCents: 8000 + Math.floor(rand() * 6000), notes: 'Schiume, lame, cere' });
      expenses.push({ id: id('spesa', e++), date: toDateKey(mid), category: 'Bollette', amountCents: 9000 + Math.floor(rand() * 4000), notes: 'Luce e acqua' });
    }
  }

  return { clients, services, appointments, expenses, settings: { ...settings, onboarded: true } };
}
