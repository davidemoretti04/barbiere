import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { db } from '../../db/db';
import type { Appointment } from '../../db/types';
import { useFeedback } from '../../components/feedback-context';
import { AppointmentDetail } from './AppointmentDetail';
import { AppointmentForm } from './AppointmentForm';
import { CheckoutSheet } from './CheckoutSheet';
import { AppointmentUIContext, type NewAppointmentPrefill } from './context';

type SheetState =
  | { kind: 'new'; prefill?: NewAppointmentPrefill }
  | { kind: 'edit'; appt: Appointment }
  | { kind: 'detail'; id: string }
  | { kind: 'checkout'; appt: Appointment }
  | null;

/** Gestisce i fogli di creazione, dettaglio, modifica e incasso, apribili da qualunque schermata. */
export function AppointmentProvider({ children }: { children: ReactNode }) {
  const [sheet, setSheet] = useState<SheetState>(null);
  const { toast } = useFeedback();

  const openNew = useCallback((prefill?: NewAppointmentPrefill) => setSheet({ kind: 'new', prefill }), []);
  const openDetail = useCallback((id: string) => setSheet({ kind: 'detail', id }), []);
  const openEdit = useCallback(async (id: string) => {
    const appt = await db.appointments.get(id);
    if (appt) setSheet({ kind: 'edit', appt });
  }, []);
  const openCheckout = useCallback(async (id: string) => {
    const appt = await db.appointments.get(id);
    if (appt) setSheet({ kind: 'checkout', appt });
  }, []);

  const value = useMemo(() => ({ openNew, openDetail, openEdit: (id: string) => void openEdit(id) }), [openNew, openDetail, openEdit]);
  const close = () => setSheet(null);

  return (
    <AppointmentUIContext.Provider value={value}>
      {children}
      {sheet?.kind === 'new' && (
        <AppointmentForm
          prefill={sheet.prefill}
          onClose={close}
          onSaved={() => {
            close();
            toast('Appuntamento aggiunto');
          }}
        />
      )}
      {sheet?.kind === 'edit' && (
        <AppointmentForm
          editing={sheet.appt}
          onClose={() => setSheet({ kind: 'detail', id: sheet.appt.id })}
          onSaved={(id) => {
            setSheet({ kind: 'detail', id });
            toast('Modifiche salvate');
          }}
        />
      )}
      {sheet?.kind === 'detail' && (
        <AppointmentDetail
          id={sheet.id}
          onClose={close}
          onEdit={() => void openEdit(sheet.id)}
          onCheckout={() => void openCheckout(sheet.id)}
        />
      )}
      {sheet?.kind === 'checkout' && (
        <CheckoutSheet appointment={sheet.appt} onClose={() => setSheet({ kind: 'detail', id: sheet.appt.id })} onDone={close} />
      )}
    </AppointmentUIContext.Provider>
  );
}
