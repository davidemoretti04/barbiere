import { differenceInCalendarDays } from 'date-fns';
import { useHasData, useSettings } from '../db/hooks';
import { navigate } from '../router';
import { IconWarning } from './Icons';

export const BACKUP_REMINDER_DAYS = 14;

/** Banner discreto se l'ultimo backup ha più di 14 giorni (o non è mai stato fatto). */
export function BackupBanner() {
  const settings = useSettings();
  const hasData = useHasData();
  if (!settings || !hasData) return null;
  const last = settings.lastBackupAt;
  const days = last ? differenceInCalendarDays(new Date(), new Date(last)) : null;
  if (days !== null && days <= BACKUP_REMINDER_DAYS) return null;
  return (
    <div className="banner" role="status">
      <IconWarning />
      <span className="grow">
        {days === null ? 'Non hai ancora fatto un backup dei dati.' : `Ultimo backup ${days} giorni fa.`}
      </span>
      <button type="button" onClick={() => navigate('/altro/backup')}>
        Fai backup
      </button>
    </div>
  );
}
