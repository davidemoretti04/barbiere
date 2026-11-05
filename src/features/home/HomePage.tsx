import { addDays, addMonths, isSameDay, startOfDay } from 'date-fns';
import { useMemo, useState } from 'react';
import { BackupBanner } from '../../components/BackupBanner';
import { useFeedback } from '../../components/feedback-context';
import { IconCake, IconCalendar, IconCalendarPlus, IconChat, IconCheck, IconUserPlus } from '../../components/Icons';
import { Page, Row, Section } from '../../components/ui';
import { useAllAppointments, useClients, useSettings } from '../../db/hooks';
import type { Appointment, Client } from '../../db/types';
import { useNow } from '../../hooks/useNow';
import { capitalize, clientName, fmt, reminderText, servicesLabel } from '../../lib/format';
import { dailyCollected, greeting, pendingCheckout, relativeStart, upcomingAppointments } from '../../lib/home';
import { formatEuro } from '../../lib/money';
import { whatsappLink } from '../../lib/phone';
import { closureFor, nextFreeSlot, workRangesFor } from '../../lib/schedule';
import { computeKpis, dayTotals, inactiveClients, percentChange, periodRange, upcomingBirthdays, type DateRange } from '../../lib/stats';
import { navigate } from '../../router';
import { useAppointmentUI } from '../appointments/context';
import { ClientForm } from '../clients/ClientForm';

export function HomePage() {
  const now = useNow();
  const appts = useAllAppointments();
  const clients = useClients();
  const settings = useSettings();
  const ui = useAppointmentUI();
  const { toast } = useFeedback();
  const [newClient, setNewClient] = useState(false);

  const byId = useMemo(() => new Map((clients ?? []).map((c) => [c.id, c])), [clients]);
  const today = startOfDay(new Date(now));

  const data = useMemo(() => {
    if (!appts || !clients || !settings) return null;
    const week = periodRange('week', new Date(now));
    const month = periodRange('month', new Date(now));
    // confronto "alla pari": stesso numero di giorni trascorsi nel periodo precedente
    const toNow = (r: DateRange): DateRange => ({ start: r.start, end: Math.min(r.end, now) });
    const prevWeek: DateRange = { start: addDays(new Date(week.start), -7).getTime(), end: addDays(new Date(now), -7).getTime() };
    const prevMonth: DateRange = { start: addMonths(new Date(month.start), -1).getTime(), end: addMonths(new Date(now), -1).getTime() };
    const k = (r: DateRange) => computeKpis(appts, [], clients, r);
    const pending = pendingCheckout(appts, now).filter((a) => a.start >= addDays(today, -14).getTime());
    return {
      today: dayTotals(appts, today),
      remainingToday: appts.filter((a) => a.status === 'programmato' && isSameDay(a.start, today) && a.end > now).length,
      upcoming: upcomingAppointments(appts, now, 6),
      pending,
      week: k(toNow(week)),
      prevWeek: k(prevWeek),
      month: k(toNow(month)),
      prevMonth: k(prevMonth),
      last7: dailyCollected(appts, 7, now),
      birthdays: upcomingBirthdays(clients, now, 7),
      inactive: inactiveClients(clients, appts, settings.inactiveWeeks, now).length,
    };
  }, [appts, clients, settings, now, today]);

  if (!data || !settings) return <Page title="Home">{null}</Page>;

  const closedToday = workRangesFor(today, settings).length === 0;
  const closure = closureFor(today, settings);
  const [next, ...later] = data.upcoming;
  const progress = data.today.expectedCents ? Math.min(100, (data.today.collectedCents / data.today.expectedCents) * 100) : 0;
  const maxDay = Math.max(1, ...data.last7.map((d) => d.cents));

  function newAppointment() {
    if (!settings || !appts) return;
    const busy = appts.filter((a) => a.status === 'programmato' || a.status === 'completato');
    ui.openNew({ start: nextFreeSlot(new Date(now), settings.defaultDurationMinutes, settings, busy).getTime() });
  }

  return (
    <Page title={greeting(now)}>
      <p className="page-sub">{capitalize(fmt(now, 'EEEE d MMMM'))}</p>
      <BackupBanner />

      {/* ----- Oggi ----- */}
      <button type="button" className="card" style={{ display: 'block', width: 'calc(100% - 32px)', textAlign: 'left' }} onClick={() => navigate('/agenda')}>
        <div className="card-label">
          <span>Incassato oggi</span>
          <span className="accent">Agenda ›</span>
        </div>
        <div className="big-money">{formatEuro(data.today.collectedCents)}</div>
        {data.today.expectedCents > 0 && (
          <div className="progress" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100} aria-label="Incassato rispetto al previsto">
            <div style={{ width: `${progress}%` }} />
          </div>
        )}
        <div className="today-stats" style={{ marginTop: data.today.expectedCents ? 0 : 8 }}>
          {closedToday && data.today.count === 0 ? (
            <span>{closure ? `Oggi chiuso: ${closure.label || 'ferie'}` : 'Oggi è il tuo giorno di riposo'}</span>
          ) : (
            <>
              <span>
                Previsto <b>{formatEuro(data.today.expectedCents)}</b>
              </span>
              <span>
                <b>{data.today.count}</b> appuntamenti
              </span>
              <span>
                <b>{data.remainingToday}</b> ancora da fare
              </span>
            </>
          )}
        </div>
      </button>

      {/* ----- Prossimo appuntamento ----- */}
      {next ? (
        <NextCard a={next} now={now} client={byId.get(next.clientId)} template={settings.reminderTemplate} />
      ) : (
        <div className="card">
          <div className="card-label">Prossimo appuntamento</div>
          <p className="muted" style={{ margin: '8px 0 12px' }}>
            Nessun appuntamento in programma.
          </p>
          <button type="button" className="btn tinted" onClick={newAppointment}>
            <IconCalendarPlus /> Fissa un appuntamento
          </button>
        </div>
      )}

      {/* ----- Da incassare ----- */}
      {data.pending.length > 0 && (
        <Section header={`Da incassare (${data.pending.length})`} footer="Appuntamenti già passati ancora da segnare come completati o assenti.">
          {data.pending.slice(0, 5).map((a) => (
            <div key={a.id} className="row">
              <button type="button" className="row-main" style={{ textAlign: 'left' }} onClick={() => ui.openDetail(a.id)}>
                <span className="row-title" style={{ display: 'block' }}>
                  {clientName(byId.get(a.clientId))}
                </span>
                <span className="row-sub" style={{ display: 'block' }}>
                  {isSameDay(a.start, today) ? `Oggi ${fmt(a.start, 'HH:mm')}` : fmt(a.start, "EEE d MMM '·' HH:mm")} · {formatEuro(a.amountCents)}
                </span>
              </button>
              <button type="button" className="btn small green" onClick={() => ui.openCheckout(a.id)}>
                <IconCheck /> Incassa
              </button>
            </div>
          ))}
          {data.pending.length > 5 && <Row title={<span className="muted">e altri {data.pending.length - 5}…</span>} onClick={() => navigate('/agenda')} />}
        </Section>
      )}

      {/* ----- Azioni rapide ----- */}
      <div className="quick-grid">
        <button type="button" className="action-tile" onClick={newAppointment}>
          <IconCalendarPlus /> Appuntamento
        </button>
        <button type="button" className="action-tile" onClick={() => setNewClient(true)}>
          <IconUserPlus /> Cliente
        </button>
        <button type="button" className="action-tile" onClick={() => navigate('/agenda')}>
          <IconCalendar /> Agenda
        </button>
      </div>

      {/* ----- Più tardi ----- */}
      {later.length > 0 && (
        <Section header="Poi">
          {later.map((a) => (
            <Row
              key={a.id}
              onClick={() => ui.openDetail(a.id)}
              leading={
                <span className="num" style={{ width: 52, flex: 'none', fontWeight: 600 }}>
                  {fmt(a.start, 'HH:mm')}
                </span>
              }
              title={clientName(byId.get(a.clientId))}
              sub={isSameDay(a.start, today) ? servicesLabel(a) : `${capitalize(fmt(a.start, 'EEEE d'))} · ${servicesLabel(a)}`}
              detail={formatEuro(a.amountCents)}
            />
          ))}
        </Section>
      )}

      {/* ----- Incassi ----- */}
      <Section header="Incassi" group={false} footer="Confronto con lo stesso numero di giorni del periodo precedente. Mance escluse.">
        <div className="kpis" style={{ margin: '0 0 10px' }}>
          <MoneyKpi label="Questa settimana" cur={data.week.revenueCents} prev={data.prevWeek.revenueCents} prevLabel="sett. scorsa" count={data.week.completedCount} />
          <MoneyKpi label="Questo mese" cur={data.month.revenueCents} prev={data.prevMonth.revenueCents} prevLabel="mese scorso" count={data.month.completedCount} />
        </div>
        <button type="button" className="card" style={{ margin: 0, width: '100%', textAlign: 'left', display: 'block' }} onClick={() => navigate('/statistiche')}>
          <div className="card-label">
            <span>Ultimi 7 giorni</span>
            <span className="accent">Statistiche ›</span>
          </div>
          <div
            className="mini-bars"
            role="img"
            aria-label={`Incassi ultimi 7 giorni: ${data.last7.map((d) => `${fmt(d.date, 'EEEE')} ${formatEuro(d.cents)}`).join(', ')}`}
          >
            {data.last7.map((d, i) => (
              <div key={d.date.getTime()} className={`col ${i === 6 ? 'today' : ''}`} title={`${fmt(d.date, 'EEE d MMM')}: ${formatEuro(d.cents)}`}>
                <div className="bar" style={{ height: `${(d.cents / maxDay) * 72}px` }} />
                <span className="d">{d.label}</span>
              </div>
            ))}
          </div>
        </button>
      </Section>

      {/* ----- Clienti ----- */}
      {(data.birthdays.length > 0 || data.inactive > 0) && (
        <Section header="Clienti">
          {data.birthdays.map((b) => (
            <Row
              key={b.client.id}
              icon={<IconCake />}
              iconBg="#ff2d55"
              title={`${clientName(b.client)}${b.age ? ` compie ${b.age} anni` : ' festeggia il compleanno'}`}
              sub={b.daysUntil === 0 ? 'Oggi' : b.daysUntil === 1 ? 'Domani' : capitalize(fmt(b.date, 'EEEE d MMMM'))}
              chevron
              onClick={() => navigate(`/clienti/${b.client.id}`)}
            />
          ))}
          {data.inactive > 0 && (
            <Row
              icon={<IconChat />}
              iconBg="#34c759"
              title={`${data.inactive} ${data.inactive === 1 ? 'cliente da ricontattare' : 'clienti da ricontattare'}`}
              sub={`Non vengono da più di ${settings.inactiveWeeks} settimane`}
              chevron
              onClick={() => navigate('/clienti?tab=ricontattare')}
            />
          )}
        </Section>
      )}

      {newClient && (
        <ClientForm
          onClose={() => setNewClient(false)}
          onSaved={(c) => {
            setNewClient(false);
            toast(`${clientName(c)} aggiunto`);
          }}
        />
      )}
    </Page>
  );
}

function NextCard({ a, now, client, template }: { a: Appointment; now: number; client: Client | undefined; template: string }) {
  const ui = useAppointmentUI();
  const live = a.start <= now && now < a.end;
  const wa = client?.phone ? whatsappLink(client.phone, reminderText(template, client, a)) : null;
  return (
    <div className={`card next-card ${live ? 'live' : ''}`}>
      <div className="card-label">
        <span>{live ? 'In corso' : 'Prossimo appuntamento'}</span>
        <span style={{ color: live ? 'var(--green)' : 'var(--accent)', textTransform: 'none', letterSpacing: 0 }}>
          {live ? `fino alle ${fmt(a.end, 'HH:mm')}` : relativeStart(a, now)}
        </span>
      </div>
      <button type="button" style={{ display: 'block', textAlign: 'left', width: '100%' }} onClick={() => ui.openDetail(a.id)}>
        <div className="who">{clientName(client)}</div>
        <div className="what">
          {fmt(a.start, 'HH:mm')}–{fmt(a.end, 'HH:mm')} · {servicesLabel(a)} · {formatEuro(a.amountCents)}
        </div>
      </button>
      <div className="btn-row">
        {live ? (
          <button type="button" className="btn green" onClick={() => ui.openCheckout(a.id)}>
            <IconCheck /> Incassa
          </button>
        ) : wa ? (
          <a className="btn tinted" href={wa} target="_blank" rel="noopener noreferrer">
            <IconChat /> Promemoria
          </a>
        ) : null}
        <button type="button" className="btn gray" onClick={() => ui.openDetail(a.id)}>
          Dettagli
        </button>
      </div>
    </div>
  );
}

function MoneyKpi({ label, cur, prev, prevLabel, count }: { label: string; cur: number; prev: number; prevLabel: string; count: number }) {
  const pct = percentChange(cur, prev);
  let cls = 'flat';
  let text = `= ${prevLabel}`;
  if (pct === null) text = `nuovo rispetto a ${prevLabel}`;
  else if (Math.abs(pct) >= 0.5) {
    cls = pct > 0 ? 'up' : 'down';
    text = `${pct > 0 ? '▲' : '▼'} ${Math.abs(Math.round(pct))}% vs ${prevLabel}`;
  }
  return (
    <div className="kpi">
      <div className="k-label">{label}</div>
      <div className="k-value">{formatEuro(cur)}</div>
      <div className="small muted">{count} completati</div>
      <div className={`k-delta ${cls}`}>{text}</div>
    </div>
  );
}
