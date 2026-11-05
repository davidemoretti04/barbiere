import type { ReactNode } from 'react';
import { SwipeRow } from '../../components/SwipeRow';
import type { Appointment } from '../../db/types';
import { useAppointmentActions } from './useAppointmentActions';

/**
 * Riga di un appuntamento con azioni a scorrimento: «Annulla» (se in programma) ed «Elimina».
 * Per gli appuntamenti ricorrenti chiede se agire solo su questo o anche sui successivi.
 */
export function AppointmentSwipeRow({ appointment, children }: { appointment: Appointment; children: ReactNode }) {
  const { cancel, remove } = useAppointmentActions();
  const actions = [
    ...(appointment.status === 'programmato' ? [{ label: 'Annulla', color: 'orange' as const, onClick: () => void cancel(appointment) }] : []),
    { label: 'Elimina', color: 'red' as const, onClick: () => void remove(appointment) },
  ];
  return <SwipeRow actions={actions}>{children}</SwipeRow>;
}
