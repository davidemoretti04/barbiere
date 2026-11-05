import { createContext, useContext } from 'react';

export interface NewAppointmentPrefill {
  start?: number;
  clientId?: string;
}

export interface AppointmentUI {
  openNew: (prefill?: NewAppointmentPrefill) => void;
  openDetail: (id: string) => void;
  openEdit: (id: string) => void;
  openCheckout: (id: string) => void;
}

export const AppointmentUIContext = createContext<AppointmentUI>({
  openNew: () => {},
  openDetail: () => {},
  openEdit: () => {},
  openCheckout: () => {},
});

export const useAppointmentUI = () => useContext(AppointmentUIContext);
