import { createContext, useContext } from 'react';

export interface NewAppointmentPrefill {
  start?: number;
  clientId?: string;
  /** Apre il modulo con «Ripeti» già impostato (ogni N settimane). */
  repeatWeeks?: number;
}

export interface AppointmentUI {
  openNew: (prefill?: NewAppointmentPrefill) => void;
  openDetail: (id: string) => void;
  openEdit: (id: string) => void;
  openCheckout: (id: string) => void;
  /** «Modifica ricorrenza» di una serie. */
  openSeries: (seriesId: string) => void;
}

export const AppointmentUIContext = createContext<AppointmentUI>({
  openNew: () => {},
  openDetail: () => {},
  openEdit: () => {},
  openCheckout: () => {},
  openSeries: () => {},
});

export const useAppointmentUI = () => useContext(AppointmentUIContext);
