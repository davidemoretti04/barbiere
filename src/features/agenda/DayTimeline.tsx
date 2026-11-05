import { isSameDay } from 'date-fns';
import { useEffect, useRef } from 'react';
import { useNow } from '../../hooks/useNow';
import type { Appointment, Client, Settings } from '../../db/types';
import { clientName, fmt, servicesLabel } from '../../lib/format';
import { formatEuro } from '../../lib/money';
import { layoutColumns } from '../../lib/overlap';
import { atMinutes, formatHM, minutesOfDay, parseHM, workRangesFor } from '../../lib/schedule';

const GUTTER = 56;

/** Vista giorno: righe per slot secondo le impostazioni, fasce non lavorative tratteggiate. */
export function DayTimeline({
  day,
  settings,
  appointments,
  clients,
  onSlot,
  onOpen,
  onSwipe,
}: {
  day: Date;
  settings: Settings;
  appointments: Appointment[];
  clients: Map<string, Client>;
  onSlot: (start: number) => void;
  onOpen: (id: string) => void;
  /** Scorrimento verso sinistra su un blocco (azioni Annulla/Elimina). */
  onSwipe?: (a: Appointment) => void;
}) {
  const swipe = useRef<{ x: number; y: number; id: string; done: boolean } | null>(null);
  const slot = Math.max(5, Math.min(240, settings.slotMinutes || 30));
  const ranges = workRangesFor(day, settings);
  let startMin = ranges.length ? Math.min(...ranges.map((r) => parseHM(r.start))) : 9 * 60;
  let endMin = ranges.length ? Math.max(...ranges.map((r) => parseHM(r.end))) : 19 * 60;
  for (const a of appointments) {
    startMin = Math.min(startMin, minutesOfDay(new Date(a.start)));
    const e = isSameDay(a.end, day) ? minutesOfDay(new Date(a.end)) : 24 * 60;
    endMin = Math.max(endMin, e);
  }
  startMin = Math.floor(startMin / 60) * 60;
  endMin = Math.min(24 * 60, Math.ceil(endMin / 60) * 60);
  const ppm = Math.max(44 / slot, 1.1); // ogni slot è alto almeno 44px
  const height = (endMin - startMin) * ppm;

  const isWorking = (m: number) => ranges.some((r) => parseHM(r.start) <= m && m < parseHM(r.end));
  const slots: number[] = [];
  for (let m = startMin; m < endMin; m += slot) slots.push(m);
  const hours: number[] = [];
  for (let m = startMin; m <= endMin; m += 60) hours.push(m);

  const layout = layoutColumns(appointments);
  const now = useNow();
  const nowMin = minutesOfDay(new Date(now));
  const showNow = isSameDay(now, day) && nowMin >= startMin && nowMin <= endMin;

  const nowRef = useRef<HTMLDivElement>(null);
  const dayKey = day.getTime();
  useEffect(() => {
    nowRef.current?.scrollIntoView({ block: 'center' });
  }, [dayKey]);

  return (
    <div className="timeline" style={{ height: height + 16, marginTop: 8 }}>
      {slots.map((m) => {
        const working = isWorking(m);
        return (
          <button
            key={m}
            type="button"
            className={`tl-slot ${m % 60 !== 0 ? 'half' : ''} ${working ? '' : 'off'}`}
            style={{ top: (m - startMin) * ppm, height: slot * ppm }}
            onClick={() => onSlot(atMinutes(day, m).getTime())}
            aria-label={`Nuovo appuntamento alle ${formatHM(m)}${working ? '' : ' (fuori orario)'}`}
          />
        );
      })}
      {hours.map((m) => (
        <div key={m} className="tl-hour" style={{ top: (m - startMin) * ppm }} aria-hidden="true">
          {formatHM(m)}
        </div>
      ))}
      {appointments.map((a) => {
        const pos = layout.get(a.id) ?? { col: 0, cols: 1 };
        const top = (minutesOfDay(new Date(a.start)) - startMin) * ppm;
        const endM = isSameDay(a.end, day) ? minutesOfDay(new Date(a.end)) : 24 * 60;
        const h = Math.max(30, (endM - minutesOfDay(new Date(a.start))) * ppm - 2);
        const c = clients.get(a.clientId);
        return (
          <button
            key={a.id}
            type="button"
            className={`tl-appt ${a.status}`}
            style={{
              top: top + 1,
              height: h,
              left: `calc(${GUTTER + 4}px + (100% - ${GUTTER + 4}px) * ${pos.col / pos.cols})`,
              width: `calc((100% - ${GUTTER + 4}px) / ${pos.cols} - 4px)`,
              zIndex: 2,
            }}
            onClick={() => {
              if (swipe.current?.done) {
                swipe.current = null;
                return;
              }
              onOpen(a.id);
            }}
            onPointerDown={(e) => {
              swipe.current = { x: e.clientX, y: e.clientY, id: a.id, done: false };
            }}
            onPointerUp={(e) => {
              const s = swipe.current;
              if (!s || s.id !== a.id) return;
              const dx = e.clientX - s.x;
              const dy = e.clientY - s.y;
              if (dx < -50 && Math.abs(dy) < 40 && onSwipe) {
                s.done = true;
                onSwipe(a);
              }
            }}
            aria-label={`${fmt(a.start, 'HH:mm')} ${clientName(c)}, ${servicesLabel(a)}. Scorri a sinistra per annullare o eliminare`}
          >
            <strong>
              {fmt(a.start, 'HH:mm')} {clientName(c)}
            </strong>
            {h > 40 && (
              <span>
                {servicesLabel(a)} · {formatEuro(a.amountCents)}
              </span>
            )}
          </button>
        );
      })}
      {showNow && <div ref={nowRef} className="tl-now" style={{ top: (nowMin - startMin) * ppm }} aria-hidden="true" />}
    </div>
  );
}
