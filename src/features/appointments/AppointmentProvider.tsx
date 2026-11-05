import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { db, getSettings } from '../../db/db';
import { nextFreeSlot } from '../../lib/schedule';
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

  const openNew = useCallback(async (prefill?: NewAppointmentPrefill) => {
    if (prefill?.start !== undefined) return setSheet({ kind: 'new', prefill });
    // senza orario indicato: proponi il primo slot libero da adesso
    const settings = await getSettings();
    const now = new Date();
    const busy = (await db.appointments.where('start').between(now.getTime() - 86400000, now.getTime() + 15 * 86400000).toArray()).filter(
      (a) => a.status === 'programmato' || a.status === 'completato',
    );
    const start = nextFreeSlot(now, settings.defaultDurationMinutes, settings, busy).getTime();
    setSheet({ kind: 'new', prefill: { ...prefill, start } });
  }, []);
  const openDetail = useCallback((id: string) => setSheet({ kind: 'detail', id }), []);
  const openEdit = useCallback(async (id: string) => {
    const appt = await db.appointments.get(id);
    if (appt) setSheet({ kind: 'edit', appt });
  }, []);
  const openCheckout = useCallback(async (id: string) => {
    const appt = await db.appointments.get(id);
    if (appt) setSheet({ kind: 'checkout', appt });
  }, []);

  const value = useMemo(
    () => ({ openNew: (p?: NewAppointmentPrefill) => void openNew(p), openDetail, openEdit: (id: string) => void openEdit(id), openCheckout: (id: string) => void openCheckout(id) }),
    [openNew, openDetail, openEdit, openCheckout],
  );
  const close = () => setSheet(null);

  return (
    <AppointmentUIContext.Provider value={value}>
      {children}
      {sheet?.kind === 'new' && (
        <AppointmentForm
          prefill={sheet.prefill}
          onClose={close}
          onSaved={(_id, count) => {
            close();
            toast(count > 1 ? `Creati ${count} appuntamenti ricorrenti` : 'Appuntamento aggiunto');
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
