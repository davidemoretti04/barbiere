import { addDays, addWeeks, isSameDay, startOfDay, startOfWeek } from 'date-fns';
import { useMemo, useState } from 'react';
import { BackupBanner } from '../../components/BackupBanner';
import { useFeedback } from '../../components/feedback-context';
import { IconCalendar, IconChevronLeft, IconChevronRight, IconPlus } from '../../components/Icons';
import { SwipeRow } from '../../components/SwipeRow';
import { EmptyState, Page, Section, Segmented } from '../../components/ui';
import { deleteAppointment, setAppointmentStatus } from '../../db/actions';
import { useAppointmentsBetween, useClients, useSettings } from '../../db/hooks';
import type { Appointment, Client } from '../../db/types';
import { capitalize, clientName, fmt, servicesLabel, STATUS_LABEL } from '../../lib/format';
import { formatEuro } from '../../lib/money';
import { closureFor, nextFreeSlot, workRangesFor } from '../../lib/schedule';
import { dayTotals } from '../../lib/stats';
import { useAppointmentUI } from '../appointments/context';
import { DayTimeline } from './DayTimeline';

// Ricorda giorno e vista tra un cambio di scheda e l'altro
let lastDay: Date | null = null;
let lastMode: 'day' | 'week' = 'day';

export function AgendaPage() {
  const [day, setDayState] = useState(() => lastDay ?? startOfDay(new Date()));
  const [mode, setModeState] = useState<'day' | 'week'>(lastMode);
  const setDay = (d: Date) => {
    lastDay = startOfDay(d);
    setDayState(lastDay);
  };
  const setMode = (m: 'day' | 'week') => {
    lastMode = m;
    setModeState(m);
  };

  const settings = useSettings();
  const clients = useClients();
  const ui = useAppointmentUI();
  const { confirm, toast } = useFeedback();

  const weekStart = startOfWeek(day, { weekStartsOn: 1 });
  const weekEnd = addWeeks(weekStart, 1);
  const weekAppts = useAppointmentsBetween(weekStart.getTime(), weekEnd.getTime());
  const byClient = useMemo(() => new Map((clients ?? []).map((c) => [c.id, c])), [clients]);

  const today = startOfDay(new Date());
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const dayAppts = (weekAppts ?? []).filter((a) => isSameDay(a.start, day));

  const totals =
    mode === 'day'
      ? dayTotals(weekAppts ?? [], day)
      : days.reduce(
          (t, d) => {
            const x = dayTotals(weekAppts ?? [], d);
            return { count: t.count + x.count, expectedCents: t.expectedCents + x.expectedCents, collectedCents: t.collectedCents + x.collectedCents };
          },
          { count: 0, expectedCents: 0, collectedCents: 0 },
        );

  function addNew() {
    if (!settings) return;
    const from = isSameDay(day, today) ? new Date() : day;
    const start = nextFreeSlot(from, settings.defaultDurationMinutes, settings, (weekAppts ?? []).filter((a) => a.status === 'programmato' || a.status === 'completato'));
    ui.openNew({ start: (isSameDay(start, day) ? start : from).getTime() });
  }

  const shift = (dir: 1 | -1) => setDay(mode === 'day' ? addDays(day, dir) : addWeeks(day, dir));
  const closure = settings ? closureFor(day, settings) : undefined;
  const closedDay = settings ? workRangesFor(day, settings).length === 0 : false;

  return (
    <Page
      title="Agenda"
      left={
        !isSameDay(day, today) ? (
          <button type="button" className="nav-btn" onClick={() => setDay(today)}>
            Oggi
          </button>
        ) : undefined
      }
      right={
        <button type="button" className="nav-btn" onClick={addNew} aria-label="Nuovo appuntamento">
          <IconPlus />
        </button>
      }
    >
      <BackupBanner />
      <Segmented
        label="Vista"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'day', label: 'Giorno' },
          { value: 'week', label: 'Settimana' },
        ]}
      />
      <div className="date-nav">
        <button type="button" className="icon-btn" onClick={() => shift(-1)} aria-label={mode === 'day' ? 'Giorno precedente' : 'Settimana precedente'}>
          <IconChevronLeft />
        </button>
        <div className="label" aria-live="polite">
          {mode === 'day' ? capitalize(fmt(day, 'EEEE d MMMM')) : `${fmt(weekStart, 'd MMM')} – ${fmt(addDays(weekStart, 6), 'd MMM yyyy')}`}
          {mode === 'day' && <small>{isSameDay(day, today) ? 'Oggi' : fmt(day, 'yyyy')}</small>}
        </div>
        <button type="button" className="icon-btn" onClick={() => shift(1)} aria-label={mode === 'day' ? 'Giorno successivo' : 'Settimana successiva'}>
          <IconChevronRight />
        </button>
      </div>

      <div className="week-strip" role="group" aria-label="Giorni della settimana">
        {days.map((d) => {
          const n = (weekAppts ?? []).filter((a) => isSameDay(a.start, d) && a.status !== 'annullato').length;
          const closed = settings ? workRangesFor(d, settings).length === 0 : false;
          return (
            <button
              key={d.getTime()}
              type="button"
              className={`${isSameDay(d, today) ? 'today' : ''} ${isSameDay(d, day) ? 'selected' : ''} ${closed ? 'closed' : ''}`}
              onClick={() => {
                setDay(d);
                setMode('day');
              }}
              aria-label={`${capitalize(fmt(d, 'EEEE d MMMM'))}${n ? `, ${n} appuntamenti` : ''}`}
              aria-current={isSameDay(d, day) ? 'date' : undefined}
            >
              <span className="wd">{fmt(d, 'EEEEE')}</span>
              <span className="dn">{fmt(d, 'd')}</span>
              <span className={`dot ${n ? '' : 'none'}`} />
            </button>
          );
        })}
      </div>

      <div className="totals-strip" aria-label="Totali">
        <div>
          <div className="t-label">Appuntamenti</div>
          <div className="t-value">{totals.count}</div>
        </div>
        <div>
          <div className="t-label">Previsto</div>
          <div className="t-value">{formatEuro(totals.expectedCents)}</div>
        </div>
        <div>
          <div className="t-label">Incassato</div>
          <div className="t-value" style={{ color: 'var(--green)' }}>
            {formatEuro(totals.collectedCents)}
          </div>
        </div>
      </div>

      {mode === 'day' && settings && (
        <>
          {closedDay && (
            <p className="center muted small" style={{ margin: '0 16px 8px' }}>
              {closure ? `Chiuso: ${closure.label || 'ferie'}` : 'Giorno di riposo'} — puoi comunque aggiungere appuntamenti.
            </p>
          )}
          <DayTimeline
            day={day}
            settings={settings}
            appointments={dayAppts}
            clients={byClient}
            onSlot={(start) => ui.openNew({ start })}
            onOpen={(id) => ui.openDetail(id)}
          />
        </>
      )}

      {mode === 'week' && (
        <>
          {weekAppts && weekAppts.length === 0 && (
            <EmptyState
              icon={<IconCalendar />}
              title="Settimana libera"
              text="Non ci sono appuntamenti in questa settimana."
              action={
                <button type="button" className="btn" onClick={addNew}>
                  <IconPlus /> Nuovo appuntamento
                </button>
              }
            />
          )}
          {days.map((d) => {
            const list = (weekAppts ?? []).filter((a) => isSameDay(a.start, d));
            if (!list.length) return null;
            const t = dayTotals(list, d);
            return (
              <Section
                key={d.getTime()}
                header={
                  <button type="button" style={{ color: 'inherit', textTransform: 'inherit', fontSize: 'inherit' }} onClick={() => { setDay(d); setMode('day'); }}>
                    {fmt(d, 'EEEE d MMMM')}
                  </button>
                }
                headerRight={<span className="num">{formatEuro(t.expectedCents)}</span>}
              >
                {list.map((a) => (
                  <WeekRow
                    key={a.id}
                    a={a}
                    client={byClient.get(a.clientId)}
                    onOpen={() => ui.openDetail(a.id)}
                    onCancel={async () => {
                      const ok = await confirm({ title: 'Annullare l’appuntamento?', confirmLabel: 'Annulla appuntamento', destructive: true, cancelLabel: 'Indietro' });
                      if (!ok) return;
                      const undo = await setAppointmentStatus(a.id, 'annullato');
                      toast({ message: 'Appuntamento annullato', actionLabel: 'Annulla', onAction: () => void undo() });
                    }}
                    onDelete={async () => {
                      const ok = await confirm({ title: 'Eliminare l’appuntamento?', confirmLabel: 'Elimina', destructive: true });
                      if (!ok) return;
                      const undo = await deleteAppointment(a.id);
                      toast({ message: 'Appuntamento eliminato', actionLabel: 'Annulla', onAction: () => void undo() });
                    }}
                  />
                ))}
              </Section>
            );
          })}
        </>
      )}
    </Page>
  );
}

function WeekRow({
  a,
  client,
  onOpen,
  onCancel,
  onDelete,
}: {
  a: Appointment;
  client: Client | undefined;
  onOpen: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const actions = [
    ...(a.status === 'programmato' ? [{ label: 'Annulla', color: 'orange' as const, onClick: onCancel }] : []),
    { label: 'Elimina', color: 'red' as const, onClick: onDelete },
  ];
  const faded = a.status === 'annullato' || a.status === 'non_presentato';
  return (
    <SwipeRow actions={actions}>
      <button type="button" className="row" onClick={onOpen}>
        <span className="num" style={{ width: 48, flex: 'none', fontWeight: 600, color: faded ? 'var(--label-3)' : undefined }}>
          {fmt(a.start, 'HH:mm')}
        </span>
        <span className="row-main" style={{ opacity: faded ? 0.5 : 1 }}>
          <span className="row-title" style={{ display: 'block', textDecoration: faded ? 'line-through' : undefined }}>
            {clientName(client)}
          </span>
          <span className="row-sub" style={{ display: 'block' }}>
            {servicesLabel(a)}
          </span>
        </span>
        <span style={{ textAlign: 'right' }}>
          <span className="row-detail" style={{ display: 'block' }}>
            {formatEuro(a.amountCents)}
          </span>
          {a.status !== 'programmato' && <span className={`badge ${a.status}`}>{STATUS_LABEL[a.status]}</span>}
        </span>
      </button>
    </SwipeRow>
  );
}
