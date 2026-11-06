/**
 * Dati di esempio COMPLETAMENTE FINTI (nomi inventati, numeri 333 000 xxxx non reali).
 * Servono a provare l'app: quando una nuova versione cambia gli esempi si incrementa SAMPLE_VERSION
 * e chi ha ancora gli esempi sul telefono li riceve aggiornati da solo (i dati veri non si toccano).
 */
import { addDays, addWeeks, startOfDay } from 'date-fns';
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

/** Da incrementare a ogni modifica degli esempi: al prossimo avvio vengono sostituiti da soli. */
export const SAMPLE_VERSION = 3;

/** Chiusura di esempio (ferie): id con il prefisso degli esempi, così si cancella insieme a loro. */
export const SAMPLE_CLOSURE_ID = 'esempio-ferie';

export const SAMPLE_SERVICES: Omit<Service, 'id'>[] = [
  { name: 'Taglio', priceCents: 1800, durationMinutes: 30, active: true },
  { name: 'Barba', priceCents: 1000, durationMinutes: 20, active: true },
  { name: 'Taglio + barba', priceCents: 2500, durationMinutes: 45, active: true },
  { name: 'Rasatura classica', priceCents: 1500, durationMinutes: 30, active: true },
  { name: 'Taglio bambino', priceCents: 1300, durationMinutes: 20, active: true },
  // archiviato: per provare «Archiviati» nel listino (non viene usato nei nuovi appuntamenti)
  { name: 'Shampoo e piega', priceCents: 1200, durationMinutes: 20, active: false },
];

export function generateSampleData(now: Date = new Date(), settings: Settings = { ...DEFAULT_SETTINGS, onboarded: true }): BackupData {
  const rand = rng(42);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
  const today = startOfDay(now);
  const id = (p: string, n: number) => `esempio-${p}-${n}`;

  const services: Service[] = SAMPLE_SERVICES.map((s, i) => ({ ...s, id: id('servizio', i) }));
  const weights = [0.42, 0.12, 0.3, 0.08, 0.08, 0];
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
    const c: Client = {
      id: id('cliente', i),
      firstName: pairs[i][0],
      lastName: pairs[i][1],
      phone: `333 000 ${String(1000 + i).slice(-4)}`,
      notes: i % 5 === 0 ? 'Preferisce sfumatura bassa' : '',
      createdAt: addDays(today, -150 + Math.floor(rand() * 140)).getTime(),
    };
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
          const recent = d >= -6; // ultima settimana
          const status: Appointment['status'] = !past
            ? 'programmato'
            : roll < 0.08
              ? 'annullato'
              : recent && roll < 0.14
                ? 'programmato' // «da incassare» in Home
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
  // Alcuni clienti abituali con appuntamenti ricorrenti già in programma
  const SERIES = [
    { client: 3, weeks: 3, svc: 0 },
    { client: 7, weeks: 2, svc: 2 },
    { client: 12, weeks: 4, svc: 0 },
    { client: 18, weeks: 3, svc: 1 },
  ];
  SERIES.forEach((cfg, k) => {
    // primo giorno lavorativo a partire da dopodomani (+k), alle 9:00
    let day = addDays(today, 2 + k);
    for (let g = 0; g < 14 && workRangesFor(day, settings).length === 0; g++) day = addDays(day, 1);
    const svc = services[cfg.svc];
    const count = k === 2 ? 2 : 6; // una serie quasi finita, per mostrare l'avviso
    for (let i = 0; i < count; i++) {
      const start = atMinutes(addWeeks(day, i * cfg.weeks), parseHM('09:00') + k * 60).getTime(); // un orario diverso per serie
      const end = start + svc.durationMinutes * 60000;
      // libera lo spazio occupato da appuntamenti di esempio casuali
      for (let x = appointments.length - 1; x >= 0; x--) {
        const a = appointments[x];
        if (!a.seriesId && a.start < end && start < a.end) appointments.splice(x, 1);
      }
      appointments.push({
        id: id('serie', k * 100 + i),
        clientId: clients[cfg.client].id,
        start,
        end,
        services: [{ serviceId: svc.id, name: svc.name, priceCents: svc.priceCents, durationMinutes: svc.durationMinutes }],
        status: 'programmato',
        amountCents: svc.priceCents,
        tipCents: 0,
        notes: '',
        seriesId: id('serie', k),
        repeatWeeks: cfg.weeks,
        ...(k === 0 ? { openEnded: true } : {}),
      });
    }
  });

  for (const a of appointments) if (a.paymentMethod === undefined) delete a.paymentMethod;
  // uno vecchio dimenticato da incassare (resta in Home finché non lo si segna)
  const forgotten = appointments.filter((a) => a.status === 'completato' && a.start < addDays(today, -40).getTime())[0];
  if (forgotten) {
    forgotten.status = 'programmato';
    forgotten.tipCents = 0;
    delete forgotten.paymentMethod;
  }

  // un cliente già eliminato: sparisce dagli elenchi ma i suoi appuntamenti fatti restano nello storico
  const gone = clients[clients.length - 1];
  gone.deletedAt = addDays(today, -2).getTime();
  for (let x = appointments.length - 1; x >= 0; x--) {
    const a = appointments[x];
    if (a.clientId === gone.id && (a.status === 'programmato' || a.start >= gone.deletedAt)) appointments.splice(x, 1);
  }

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

  // ferie di esempio tra circa tre settimane (per provare chiusure e avvisi nell'agenda)
  const holidayStart = addDays(today, 21);
  const closures = [
    ...settings.closures.filter((c) => c.id !== SAMPLE_CLOSURE_ID),
    { id: SAMPLE_CLOSURE_ID, from: toDateKey(holidayStart), to: toDateKey(addDays(holidayStart, 2)), label: 'Ferie (esempio)' },
  ];

  return { clients, services, appointments, expenses, settings: { ...settings, closures, onboarded: true } };
}
