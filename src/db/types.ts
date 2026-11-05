/** Tutti gli importi sono in centesimi di euro (interi). */
export type Cents = number;

export interface Client {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  notes: string;
  /** Data di nascita in formato 'YYYY-MM-DD' (opzionale). */
  birthday?: string;
  /** Epoch in millisecondi. */
  createdAt: number;
}

export interface Service {
  id: string;
  name: string;
  priceCents: Cents;
  durationMinutes: number;
  active: boolean;
}

/** Copia del servizio al momento della prenotazione: lo storico non cambia se cambia il listino. */
export interface AppointmentService {
  serviceId: string;
  name: string;
  priceCents: Cents;
  durationMinutes: number;
}

export type AppointmentStatus = 'programmato' | 'completato' | 'annullato' | 'non_presentato';
export type PaymentMethod = 'contanti' | 'carta' | 'altro';

export interface Appointment {
  id: string;
  clientId: string;
  /** Epoch in millisecondi. */
  start: number;
  end: number;
  services: AppointmentService[];
  status: AppointmentStatus;
  /** Importo finale (per i programmati: importo previsto). */
  amountCents: Cents;
  tipCents: Cents;
  paymentMethod?: PaymentMethod;
  notes: string;
  /** Appuntamenti ricorrenti: stesso seriesId per tutta la serie. */
  seriesId?: string;
  /** Ogni quante settimane si ripete la serie. */
  repeatWeeks?: number;
}

export interface Expense {
  id: string;
  /** 'YYYY-MM-DD' (data locale). */
  date: string;
  category: string;
  amountCents: Cents;
  notes: string;
}

/** Fascia oraria 'HH:mm'–'HH:mm'. */
export interface TimeRange {
  start: string;
  end: string;
}

/** Chiave 1 = lunedì … 7 = domenica (ISO). */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type WorkingHours = Record<Weekday, TimeRange[]>;

export interface Closure {
  id: string;
  /** 'YYYY-MM-DD' inclusivo */
  from: string;
  /** 'YYYY-MM-DD' inclusivo */
  to: string;
  label: string;
}

export interface Settings {
  id: 'app';
  onboarded: boolean;
  workingHours: WorkingHours;
  closures: Closure[];
  slotMinutes: number;
  defaultDurationMinutes: number;
  reminderTemplate: string;
  inactiveWeeks: number;
  /** Epoch ms dell'ultimo backup esportato, null se mai. */
  lastBackupAt: number | null;
}

export const WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 7];

export const DEFAULT_SETTINGS: Settings = {
  id: 'app',
  onboarded: false,
  workingHours: {
    1: [],
    2: [
      { start: '09:00', end: '13:00' },
      { start: '15:00', end: '19:30' },
    ],
    3: [
      { start: '09:00', end: '13:00' },
      { start: '15:00', end: '19:30' },
    ],
    4: [
      { start: '09:00', end: '13:00' },
      { start: '15:00', end: '19:30' },
    ],
    5: [
      { start: '09:00', end: '13:00' },
      { start: '15:00', end: '19:30' },
    ],
    6: [{ start: '09:00', end: '18:00' }],
    7: [],
  },
  closures: [],
  slotMinutes: 30,
  defaultDurationMinutes: 30,
  reminderTemplate:
    'Ciao {nome}! Ti ricordo l’appuntamento dal barbiere {data} alle {ora}. A presto!',
  inactiveWeeks: 6,
  lastBackupAt: null,
};

export const EXPENSE_CATEGORIES = [
  'Prodotti',
  'Affitto',
  'Bollette',
  'Attrezzatura',
  'Tasse',
  'Altro',
] as const;
