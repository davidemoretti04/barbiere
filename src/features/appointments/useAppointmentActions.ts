import { useFeedback } from '../../components/feedback-context';
import { deleteAppointment, endSeriesFrom, setAppointmentStatus } from '../../db/actions';
import { db } from '../../db/db';
import type { Appointment } from '../../db/types';
import { seriesFrom } from '../../lib/recurrence';

/**
 * Annulla / elimina un appuntamento, usate dal dettaglio e dagli swipe sulle righe.
 * Per gli appuntamenti ricorrenti chiede «Solo questo» o «Questo e i successivi» (che ferma la serie).
 * Ogni azione mostra un avviso con «Annulla». Ritornano true se l'azione è stata eseguita.
 */
export function useAppointmentActions() {
  const { confirm, choose, toast } = useFeedback();

  async function scope(a: Appointment, verb: 'Annulla' | 'Elimina'): Promise<'one' | 'following' | null> {
    if (!a.seriesId) return 'one';
    const all = await db.appointments.where('seriesId').equals(a.seriesId).toArray();
    const following = seriesFrom(all, a);
    if (following.length <= 1 && !a.openEnded) return 'one';
    const i = await choose({
      title: `${verb}: appuntamento ricorrente`,
      message: a.openEnded
        ? 'La serie si ripete senza fine. Scegli se togliere solo questo appuntamento o fermare la serie da qui in poi.'
        : `Ci sono altri ${following.length - 1} appuntamenti successivi in questa serie.`,
      options: [
        { label: 'Solo questo', destructive: true },
        { label: a.openEnded ? 'Questo e i successivi (ferma la serie)' : `Questo e i successivi (${following.length})`, destructive: true },
      ],
      cancelLabel: 'Indietro',
    });
    return i === 0 ? 'one' : i === 1 ? 'following' : null;
  }

  async function cancel(a: Appointment): Promise<boolean> {
    const s = await scope(a, 'Annulla');
    if (!s) return false;
    if (s === 'following' && a.seriesId) {
      const undo = await endSeriesFrom(a.seriesId, a.start, 'cancel');
      toast({ message: 'Serie annullata da questo appuntamento in poi', actionLabel: 'Annulla', onAction: () => void undo() });
      return true;
    }
    if (!a.seriesId) {
      const ok = await confirm({
        title: 'Annullare l’appuntamento?',
        message: 'Resterà nello storico come annullato.',
        confirmLabel: 'Annulla appuntamento',
        destructive: true,
        cancelLabel: 'Indietro',
      });
      if (!ok) return false;
    }
    const undo = await setAppointmentStatus(a.id, 'annullato');
    toast({ message: 'Appuntamento annullato', actionLabel: 'Annulla', onAction: () => void undo() });
    return true;
  }

  async function remove(a: Appointment): Promise<boolean> {
    const s = await scope(a, 'Elimina');
    if (!s) return false;
    if (s === 'following' && a.seriesId) {
      const undo = await endSeriesFrom(a.seriesId, a.start, 'delete');
      toast({ message: 'Serie eliminata da questo appuntamento in poi', actionLabel: 'Annulla', onAction: () => void undo() });
      return true;
    }
    if (!a.seriesId) {
      const ok = await confirm({
        title: 'Eliminare l’appuntamento?',
        message: 'Verrà rimosso anche dalle statistiche.',
        confirmLabel: 'Elimina',
        destructive: true,
      });
      if (!ok) return false;
    }
    const undo = await deleteAppointment(a.id);
    toast({ message: 'Appuntamento eliminato', actionLabel: 'Annulla', onAction: () => void undo() });
    return true;
  }

  return { cancel, remove };
}
