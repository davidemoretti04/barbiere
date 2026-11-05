import { IconPlus, IconX } from '../../components/Icons';
import { SwitchRow } from '../../components/ui';
import { WEEKDAYS, type TimeRange, type Weekday, type WorkingHours } from '../../db/types';
import { parseHM, WEEKDAY_NAMES } from '../../lib/schedule';

const NAMES = WEEKDAY_NAMES;

/** Orari di lavoro per giorno, con più fasce (es. pausa pranzo). */
export function WorkingHoursEditor({ value, onChange }: { value: WorkingHours; onChange: (v: WorkingHours) => void }) {
  const set = (d: Weekday, ranges: TimeRange[]) => onChange({ ...value, [d]: ranges });
  return (
    <div className="group">
      {WEEKDAYS.map((d) => {
        const ranges = value[d] ?? [];
        const open = ranges.length > 0;
        return (
          <div key={d} className="hours-day" style={{ position: 'relative', borderTop: d > 1 ? '0.5px solid var(--separator)' : undefined }}>
            <SwitchRow
              title={NAMES[d]}
              detail={open ? undefined : 'Chiuso'}
              checked={open}
              ariaLabel={`${NAMES[d]} aperto`}
              onChange={(on) => set(d, on ? [{ start: '09:00', end: '13:00' }, { start: '15:00', end: '19:00' }] : [])}
            />
            {ranges.map((r, i) => (
              <div key={i} className="range-row" style={{ paddingBottom: i === ranges.length - 1 ? 4 : 4 }}>
                <input
                  type="time"
                  aria-label={`${NAMES[d]} fascia ${i + 1} inizio`}
                  value={r.start}
                  onChange={(e) => set(d, ranges.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))}
                />
                <span className="muted">–</span>
                <input
                  type="time"
                  aria-label={`${NAMES[d]} fascia ${i + 1} fine`}
                  value={r.end}
                  onChange={(e) => set(d, ranges.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))}
                />
                <span className="grow" />
                <button
                  type="button"
                  className="icon-btn"
                  style={{ color: 'var(--red)' }}
                  aria-label={`Rimuovi fascia ${i + 1} di ${NAMES[d]}`}
                  onClick={() => set(d, ranges.filter((_, j) => j !== i))}
                >
                  <IconX />
                </button>
              </div>
            ))}
            {open && (
              <button
                type="button"
                className="row action"
                style={{ minHeight: 40 }}
                onClick={() => {
                  const last = ranges[ranges.length - 1];
                  const startM = Math.min(parseHM(last.end) + 60, 22 * 60);
                  const h = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
                  set(d, [...ranges, { start: h(startM), end: h(Math.min(startM + 120, 23 * 60 + 30)) }]);
                }}
              >
                <IconPlus width={18} height={18} />
                <span className="row-main small">Aggiungi fascia</span>
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
