import { subDays } from 'date-fns';
import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { IconChart, IconChevronLeft, IconChevronRight } from '../../components/Icons';
import { EmptyState, Field, Page, Section, Segmented } from '../../components/ui';
import { useAllAppointments, useClients, useExpenses } from '../../db/hooks';
import { capitalize, fmt } from '../../lib/format';
import { formatEuro, formatEuroShort } from '../../lib/money';
import { toDateKey, fromDateKey } from '../../lib/schedule';
import {
  computeKpis,
  customRange,
  granularityFor,
  hourDistribution,
  percentChange,
  periodRange,
  previousRange,
  revenueSeries,
  shiftRange,
  topClients,
  topServices,
  weekdayDistribution,
  type DateRange,
  type PeriodKind,
  type RankItem,
} from '../../lib/stats';
import { navigate } from '../../router';
import { StatDetailSheet, type StatDetailTarget } from './StatDetailSheet';
import { useNow } from '../../hooks/useNow';

const KIND_OPTIONS: { value: PeriodKind; label: string }[] = [
  { value: 'day', label: 'Oggi' },
  { value: 'week', label: 'Settimana' },
  { value: 'month', label: 'Mese' },
  { value: 'year', label: 'Anno' },
  { value: 'custom', label: 'Pers.' },
];

const PREV_LABEL: Record<PeriodKind, string> = {
  day: 'ieri',
  week: 'sett. prec.',
  month: 'mese prec.',
  year: 'anno prec.',
  custom: 'periodo prec.',
};

function rangeLabel(kind: PeriodKind, r: DateRange): string {
  const s = new Date(r.start);
  const last = new Date(r.end - 1);
  switch (kind) {
    case 'day':
      return capitalize(fmt(s, 'EEEE d MMMM yyyy'));
    case 'week':
      return `${fmt(s, 'd MMM')} – ${fmt(last, 'd MMM yyyy')}`;
    case 'month':
      return capitalize(fmt(s, 'MMMM yyyy'));
    case 'year':
      return fmt(s, 'yyyy');
    case 'custom':
      return `${fmt(s, 'd MMM yyyy')} – ${fmt(last, 'd MMM yyyy')}`;
  }
}

let saved: { kind: PeriodKind; range: DateRange } | null = null;

export function StatsPage() {
  const appts = useAllAppointments();
  const clients = useClients();
  const expenses = useExpenses();
  const now = useNow();
  const [state, setStateRaw] = useState(() => saved ?? { kind: 'month' as PeriodKind, range: periodRange('month', new Date()) });
  const setState = (s: { kind: PeriodKind; range: DateRange }) => {
    saved = s;
    setStateRaw(s);
  };
  const { kind, range } = state;
  const [detail, setDetail] = useState<StatDetailTarget | null>(null);
  const open = (k: StatDetailTarget['kind']) => () => setDetail({ kind: k });

  const setKind = (k: PeriodKind) => {
    if (k === 'custom') setState({ kind: k, range: customRange(subDays(new Date(), 29), new Date()) });
    else setState({ kind: k, range: periodRange(k, new Date()) });
  };

  const data = useMemo(() => {
    if (!appts || !clients || !expenses) return null;
    const prev = previousRange(kind, range);
    const g = granularityFor(kind, range);
    return {
      kpi: computeKpis(appts, expenses, clients, range),
      prev: computeKpis(appts, expenses, clients, prev),
      series: revenueSeries(appts, range, g),
      granularity: g,
      services: topServices(appts, range, 5),
      best: topClients(appts, clients, range, 5),
      weekdays: weekdayDistribution(appts, range),
      hours: hourDistribution(appts, range),
    };
  }, [appts, clients, expenses, kind, range]);

  const hasAny = (appts?.length ?? 0) > 0 || (expenses?.length ?? 0) > 0;

  return (
    <Page title="Statistiche">
      <Segmented label="Periodo" value={kind} onChange={setKind} options={KIND_OPTIONS} />
      {kind === 'custom' ? (
        <Section>
          <Field label="Dal">
            <input
              type="date"
              value={toDateKey(new Date(range.start))}
              onChange={(e) => e.target.value && setState({ kind, range: customRange(fromDateKey(e.target.value), new Date(range.end - 1)) })}
            />
          </Field>
          <Field label="Al">
            <input
              type="date"
              value={toDateKey(new Date(range.end - 1))}
              onChange={(e) => e.target.value && setState({ kind, range: customRange(new Date(range.start), fromDateKey(e.target.value)) })}
            />
          </Field>
        </Section>
      ) : (
        <div className="date-nav">
          <button type="button" className="icon-btn" aria-label="Periodo precedente" onClick={() => setState({ kind, range: shiftRange(kind, range, -1) })}>
            <IconChevronLeft />
          </button>
          <div className="label" aria-live="polite">
            {rangeLabel(kind, range)}
          </div>
          <button
            type="button"
            className="icon-btn"
            aria-label="Periodo successivo"
            disabled={range.end > now}
            style={{ opacity: range.end > now ? 0.3 : 1 }}
            onClick={() => setState({ kind, range: shiftRange(kind, range, 1) })}
          >
            <IconChevronRight />
          </button>
        </div>
      )}

      {!hasAny && appts && (
        <EmptyState
          icon={<IconChart />}
          title="Ancora nessun dato"
          text="Le statistiche si riempiono quando segni gli appuntamenti come completati. Per provare puoi caricare i dati di esempio."
          action={
            <button type="button" className="btn tinted" onClick={() => navigate('/altro/backup')}>
              Dati di esempio
            </button>
          }
        />
      )}

      {data && hasAny && (
        <>
          <div className="kpis">
            <Kpi onClick={open('revenue')} wide label="Incasso" value={formatEuro(data.kpi.revenueCents)} cur={data.kpi.revenueCents} prev={data.prev.revenueCents} prevLabel={PREV_LABEL[kind]} />
            <Kpi onClick={open('completed')} label="Completati" value={String(data.kpi.completedCount)} cur={data.kpi.completedCount} prev={data.prev.completedCount} prevLabel={PREV_LABEL[kind]} />
            <Kpi onClick={open('ticket')} label="Scontrino medio" value={formatEuro(data.kpi.averageTicketCents)} cur={data.kpi.averageTicketCents} prev={data.prev.averageTicketCents} prevLabel={PREV_LABEL[kind]} />
            <Kpi onClick={open('tips')} label="Mance" value={formatEuro(data.kpi.tipsCents)} cur={data.kpi.tipsCents} prev={data.prev.tipsCents} prevLabel={PREV_LABEL[kind]} />
            <Kpi onClick={open('newClients')} label="Nuovi clienti" value={String(data.kpi.newClients)} cur={data.kpi.newClients} prev={data.prev.newClients} prevLabel={PREV_LABEL[kind]} />
            <Kpi
              onClick={open('cancelled')}
              label="Annullati"
              value={String(data.kpi.cancelledCount + data.kpi.noShowCount)}
              cur={data.kpi.cancelledCount + data.kpi.noShowCount}
              prev={data.prev.cancelledCount + data.prev.noShowCount}
              prevLabel={PREV_LABEL[kind]}
              lowerIsBetter
            />
            <Kpi onClick={open('expenses')} label="Spese" value={formatEuro(data.kpi.expensesCents)} cur={data.kpi.expensesCents} prev={data.prev.expensesCents} prevLabel={PREV_LABEL[kind]} lowerIsBetter />
            <Kpi
              onClick={open('profit')}
              wide
              label="Utile (incassi + mance − spese)"
              value={formatEuro(data.kpi.profitCents)}
              cur={data.kpi.profitCents}
              prev={data.prev.profitCents}
              prevLabel={PREV_LABEL[kind]}
              negative={data.kpi.profitCents < 0}
            />
          </div>

          <Section
            header={`Incassi per ${data.granularity === 'hour' ? 'ora' : data.granularity === 'day' ? 'giorno' : data.granularity === 'week' ? 'settimana' : 'mese'}`}
            group={false}
          >
            <div className="chart-card">
              <BarsChart
                data={data.series.map((p) => ({ label: p.label, value: p.revenueCents, sub: `${p.count} appuntamenti` }))}
                money
                title="Incassi"
              />
            </div>
            <details style={{ padding: '8px 16px 0' }}>
              <summary className="small" style={{ color: 'var(--accent)', minHeight: 44, display: 'flex', alignItems: 'center' }}>
                Vedi i dati in tabella
              </summary>
              <table className="small num" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr className="muted">
                    <th style={{ textAlign: 'left', padding: 4 }}>Periodo</th>
                    <th style={{ textAlign: 'right', padding: 4 }}>App.</th>
                    <th style={{ textAlign: 'right', padding: 4 }}>Incasso</th>
                  </tr>
                </thead>
                <tbody>
                  {data.series.map((p) => (
                    <tr key={p.key}>
                      <td style={{ padding: 4 }}>{p.label}</td>
                      <td style={{ textAlign: 'right', padding: 4 }}>{p.count}</td>
                      <td style={{ textAlign: 'right', padding: 4 }}>{formatEuro(p.revenueCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </Section>

          <Section header="Servizi più richiesti" group={false}>
            <RankList items={data.services} metric="count" empty="Nessun servizio completato nel periodo." onClick={(id, name) => setDetail({ kind: 'service', serviceKey: id, serviceName: name })} />
          </Section>

          <Section header="Migliori clienti per spesa" group={false}>
            <RankList items={data.best} metric="revenue" empty="Nessun incasso nel periodo." onClick={(id) => navigate(`/clienti/${id}`)} />
          </Section>

          {kind !== 'day' && (
            <Section header="Giorni più pieni" group={false}>
              <div className="chart-card">
                <BarsChart data={data.weekdays.map((d) => ({ label: d.label, value: d.count, sub: formatEuro(d.revenueCents) }))} title="Appuntamenti" />
              </div>
            </Section>
          )}

          <Section header="Fasce orarie più piene" group={false}>
            {data.hours.length ? (
              <div className="chart-card">
                <BarsChart data={data.hours.map((h) => ({ label: h.label, value: h.count, sub: `dalle ${h.label}:00` }))} title="Appuntamenti" />
              </div>
            ) : (
              <div className="group">
                <div className="row muted">Nessun appuntamento completato nel periodo.</div>
              </div>
            )}
          </Section>
        </>
      )}
      {detail && appts && clients && expenses && (
        <StatDetailSheet
          target={detail}
          range={range}
          rangeLabel={rangeLabel(kind, range)}
          appts={appts}
          clients={clients}
          expenses={expenses}
          onClose={() => setDetail(null)}
        />
      )}
    </Page>
  );
}

function Kpi({
  onClick,
  label,
  value,
  cur,
  prev,
  prevLabel,
  wide,
  lowerIsBetter,
  negative,
}: {
  onClick: () => void;
  label: string;
  value: string;
  cur: number;
  prev: number;
  prevLabel: string;
  wide?: boolean;
  lowerIsBetter?: boolean;
  negative?: boolean;
}) {
  const pct = percentChange(cur, prev);
  let cls = 'flat';
  let text = `= ${prevLabel}`;
  if (pct === null) text = `nuovo rispetto a ${prevLabel}`;
  else if (Math.abs(pct) >= 0.5) {
    const good = lowerIsBetter ? pct < 0 : pct > 0;
    cls = good ? 'up' : 'down';
    text = `${pct > 0 ? '▲' : '▼'} ${Math.abs(Math.round(pct))}% vs ${prevLabel}`;
  }
  return (
    <button type="button" className={`kpi pressable ${wide ? 'wide' : ''}`} onClick={onClick} aria-label={`${label}: ${value}. Vedi dettaglio`}>
      <div className="k-label">
        {label} <span aria-hidden="true" style={{ color: 'var(--label-3)', float: 'right' }}>›</span>
      </div>
      <div className="k-value" style={negative ? { color: 'var(--red)' } : undefined}>
        {value}
      </div>
      <div className={`k-delta ${cls}`}>{text}</div>
    </button>
  );
}

interface BarDatum {
  label: string;
  value: number;
  sub?: string;
}

function BarsChart({ data, money, title }: { data: BarDatum[]; money?: boolean; title: string }) {
  const fmtValue = (v: number) => (money ? formatEuro(v) : String(v));
  const interval = data.length > 16 ? Math.ceil(data.length / 8) - 1 : 0;
  return (
    <div role="img" aria-label={`${title}: ${data.map((d) => `${d.label} ${fmtValue(d.value)}`).join(', ')}`}>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            interval={interval}
            tick={{ fontSize: 11, fill: 'var(--label-2)' }}
          />
          <YAxis
            width={money ? 52 : 32}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            tick={{ fontSize: 11, fill: 'var(--label-2)' }}
            tickFormatter={(v: number) => (money ? formatEuroShort(v) : String(v))}
          />
          <Tooltip
            cursor={{ fill: 'var(--fill-2)' }}
            content={({ active, payload }) => {
              const d = active && payload?.[0] ? (payload[0].payload as BarDatum) : null;
              if (!d) return null;
              return (
                <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: '8px 10px', boxShadow: 'var(--shadow)', fontSize: 13 }}>
                  <div className="muted">{d.label}</div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{fmtValue(d.value)}</div>
                  {d.sub && <div className="muted">{d.sub}</div>}
                </div>
              );
            }}
          />
          <Bar dataKey="value" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function RankList({
  items,
  metric,
  empty,
  onClick,
}: {
  items: RankItem[];
  metric: 'count' | 'revenue';
  empty: string;
  onClick?: (id: string, name: string) => void;
}) {
  if (!items.length)
    return (
      <div className="group">
        <div className="row muted">{empty}</div>
      </div>
    );
  const max = Math.max(...items.map((i) => (metric === 'count' ? i.count : i.revenueCents)), 1);
  return (
    <div className="group">
      <ul className="bar-list">
        {items.map((i) => {
          const v = metric === 'count' ? i.count : i.revenueCents;
          const content = (
            <>
              <div className="bl-top">
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.name}</span>
                <span className="num muted" style={{ whiteSpace: 'nowrap' }}>
                  {metric === 'count' ? `${i.count} · ${formatEuro(i.revenueCents)}` : `${formatEuro(i.revenueCents)} · ${i.count} visite`}
                </span>
              </div>
              <div className="bl-track" aria-hidden="true">
                <div className="bl-fill" style={{ width: `${(v / max) * 100}%` }} />
              </div>
            </>
          );
          return (
            <li key={i.id}>
              {onClick ? (
                <button type="button" style={{ width: '100%', textAlign: 'left', minHeight: 44 }} onClick={() => onClick(i.id, i.name)}>
                  {content}
                </button>
              ) : (
                content
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

