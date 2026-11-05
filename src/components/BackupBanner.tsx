import { differenceInCalendarDays } from 'date-fns';
import { updateSettings } from '../db/db';
import { useHasData, useSettings } from '../db/hooks';
import { useNow } from '../hooks/useNow';
import { navigate } from '../router';
import { useFeedback } from './feedback-context';
import { IconWarning, IconX } from './Icons';

export const BACKUP_REMINDER_DAYS = 14;
export const BACKUP_SNOOZE_DAYS = 7;

/**
 * Banner discreto se l'ultimo backup ha più di 14 giorni (o non è mai stato fatto).
 * Con la ✕ si nasconde per 7 giorni, poi ricompare se il backup non è ancora stato fatto.
 */
export function BackupBanner() {
  const settings = useSettings();
  const hasData = useHasData();
  const now = useNow();
  const { toast } = useFeedback();
  if (!settings || !hasData) return null;
  if ((settings.backupReminderSnoozedUntil ?? 0) > now) return null;
  const last = settings.lastBackupAt;
  const days = last ? differenceInCalendarDays(new Date(now), new Date(last)) : null;
  if (days !== null && days <= BACKUP_REMINDER_DAYS) return null;

  const snooze = () => {
    const previous = settings.backupReminderSnoozedUntil ?? null;
    void updateSettings({ backupReminderSnoozedUntil: now + BACKUP_SNOOZE_DAYS * 86400000 });
    toast({
      message: `Te lo ricorderò tra ${BACKUP_SNOOZE_DAYS} giorni`,
      actionLabel: 'Annulla',
      onAction: () => void updateSettings({ backupReminderSnoozedUntil: previous }),
    });
  };

  return (
    <div className="banner" role="status">
      <IconWarning />
      <span className="grow">
        {days === null ? 'Non hai ancora fatto un backup dei dati.' : `Ultimo backup ${days} giorni fa.`}
      </span>
      <button type="button" onClick={() => navigate('/altro/backup')}>
        Fai backup
      </button>
      <button type="button" className="banner-close" onClick={snooze} aria-label="Chiudi l’avviso del backup per 7 giorni">
        <IconX />
      </button>
    </div>
  );
}
