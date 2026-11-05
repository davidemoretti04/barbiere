import { useState, type ReactNode } from 'react';
import { Sheet } from '../../components/Sheet';
import { EmptyState, Row, Section } from '../../components/ui';
import type { Appointment, Client, Expense } from '../../db/types';
import { capitalize, clientName, fmt, PAYMENT_LABEL, servicesLabel } from '../../lib/format';
import { formatEuro } from '../../lib/money';
import { fromDateKey } from '../../lib/schedule';
import {
  byAmountList,
  cancelledLists,
  completedList,
  expensesList,
  groupByDay,
  newClientsList,
  paymentBreakdown,
  serviceList,
  STAT_TITLES,
  tipsList,
  type StatKind,
} from '../../lib/statDetails';
import { computeKpis, expensesByCategory, type DateRange } from '../../lib/stats';
import { navigate } from '../../router';
import { useAppointmentUI } from '../appointments/context';

export interface StatDetailTarget {
  kind: StatKind;
  /** Per kind = 'service': chiave e nome del servizio. */
  serviceKey?: string;
  serviceName?: string;
}

interface Props {
  target: StatDetailTarget;
  range: DateRange;
  rangeLabel: string;
  appts: Appointment[];
  clients: Client[];
  expenses: Expense[];
  onClose: () => void;
}

/** Schermata con l'elenco che compone una statistica (tocco su un riquadro). */
export function StatDetailSheet({ target: initial, range, rangeLabel, appts, clients, expenses, onClose }: Props) {
  const [target, setTarget] = useState(initial);
  const ui = useAppointmentUI();
  const byId = new Map(clients.map((c) => [c.id, c]));
  const k = computeKpis(appts, expenses, clients, range);
  const { kind } = target;

  const apptRow = (a: Appointment, detail: ReactNode = formatEuro(a.amountCents), withDate = false) => (
    <Row
      key={a.id}
      onClick={() => ui.openDetail(a.id)}
      leading={
        <span className="num" style={{ width: withDate ? 78 : 48, flex: 'none', fontWeight: 600, fontSize: withDate ? 14 : 17 }}>
          {withDate ? fmt(a.start, 'd/M HH:mm') : fmt(a.start, 'HH:mm')}
        </span>
      }
      title={clientName(byId.get(a.clientId))}
      sub={`${servicesLabel(a)}${a.paymentMethod ? ` · ${PAYMENT_LABEL[a.paymentMethod]}` : ''}`}
      detail={detail}
    />
  );

  const dayGroups = (list: Appointment[], detail?: (a: Appointment) => ReactNode) =>
    groupByDay(list).map((g) => {
      const total = g.items.reduce((s, a) => s + a.amountCents, 0);
      return (
        <Section key={g.day} header={capitalize(fmt(g.day, 'EEEE d MMMM'))} headerRight={<span className="num">{formatEuro(total)}</span>}>
          {g.items.map((a) => apptRow(a, detail?.(a)))}
        </Section>
      );
    });

  const hero = (value: string, sub?: string) => (
    <div className="hero">
      <p>{rangeLabel}</p>
      <h1 className="num" style={{ fontSize: 34, marginTop: 4 }}>
        {value}
      </h1>
      {sub && <p className="small">{sub}</p>}
    </div>
  );

  let body: ReactNode = null;
  const empty = <EmptyState title="Niente da mostrare" text="Nessun elemento in questo periodo." />;

  if (kind === 'revenue' || kind === 'completed') {
    const list = completedList(appts, range);
    body = (
      <>
        {kind === 'revenue'
          ? hero(formatEuro(k.revenueCents), `${k.completedCount} completati · mance ${formatEuro(k.tipsCents)} a parte`)
          : hero(String(k.completedCount), `per ${formatEuro(k.revenueCents)} di incasso`)}
        {list.length > 0 && (
          <Section header="Per metodo di pagamento (mance incluse)">
            {paymentBreakdown(list).map((p) => (
              <Row key={p.method} title={p.label} sub={`${p.count} appuntamenti`} detail={formatEuro(p.cents)} />
            ))}
          </Section>
        )}
        {list.length ? dayGroups(list) : empty}
      </>
    );
  } else if (kind === 'ticket') {
    const list = byAmountList(appts, range);
    body = (
      <>
        {hero(formatEuro(k.averageTicketCents), list.length ? `min ${formatEuro(list[list.length - 1].amountCents)} · max ${formatEuro(list[0].amountCents)} · ${list.length} completati` : undefined)}
        {list.length ? <Section header="Dal più alto">{list.map((a) => apptRow(a, undefined, true))}</Section> : empty}
      </>
    );
  } else if (kind === 'tips') {
    const list = tipsList(appts, range);
    body = (
      <>
        {hero(formatEuro(k.tipsCents), `${list.length} appuntamenti con mancia su ${k.completedCount}`)}
        {list.length ? dayGroups(list, (a) => `+${formatEuro(a.tipCents)}`) : empty}
      </>
    );
  } else if (kind === 'newClients') {
    const list = newClientsList(clients, range);
    const visits = new Map<string, number>();
    for (const a of appts) if (a.status === 'completato') visits.set(a.clientId, (visits.get(a.clientId) ?? 0) + 1);
    body = (
      <>
        {hero(String(list.length))}
        {list.length ? (
          <Section>
            {list.map((c) => (
              <Row
                key={c.id}
                title={clientName(c)}
                sub={`Aggiunto il ${fmt(c.createdAt, 'd MMMM yyyy')}`}
                detail={`${visits.get(c.id) ?? 0} visite`}
                chevron
                onClick={() => {
                  onClose();
                  navigate(`/clienti/${c.id}`);
                }}
              />
            ))}
          </Section>
        ) : (
          empty
        )}
      </>
    );
  } else if (kind === 'cancelled') {
    const { cancelled, noShow } = cancelledLists(appts, range);
    const lost = [...cancelled, ...noShow].reduce((s, a) => s + a.amountCents, 0);
    body = (
      <>
        {hero(`${cancelled.length} / ${noShow.length}`, `annullati / non presentati · ${formatEuro(lost)} di incasso mancato`)}
        {noShow.length > 0 && (
          <Section header={<span style={{ color: 'var(--red)' }}>Non si sono presentati ({noShow.length})</span>}>
            {noShow.map((a) => apptRow(a, <span style={{ color: 'var(--red)' }}>{formatEuro(a.amountCents)}</span>, true))}
          </Section>
        )}
        {cancelled.length > 0 && <Section header={`Annullati (${cancelled.length})`}>{cancelled.map((a) => apptRow(a, undefined, true))}</Section>}
        {!cancelled.length && !noShow.length && empty}
      </>
    );
  } else if (kind === 'expenses') {
    const list = expensesList(expenses, range);
    body = (
      <>
        {hero(formatEuro(k.expensesCents), `${list.length} movimenti`)}
        {list.length > 0 && (
          <Section header="Per categoria">
            {expensesByCategory(expenses, range).map((c) => (
              <Row key={c.category} title={c.category} detail={formatEuro(c.amountCents)} />
            ))}
          </Section>
        )}
        {list.length ? (
          <Section header="Movimenti" footer="Per modificare o aggiungere spese usa la scheda Spese.">
            {list.map((e) => (
              <Row key={e.id} title={e.category} sub={`${fmt(fromDateKey(e.date), 'EEE d MMM')}${e.notes ? ` · ${e.notes}` : ''}`} detail={formatEuro(e.amountCents)} />
            ))}
          </Section>
        ) : (
          empty
        )}
      </>
    );
  } else if (kind === 'profit') {
    body = (
      <>
        {hero(formatEuro(k.profitCents))}
        <Section footer="Tocca una voce per vederne il dettaglio.">
          <Row title="Incassi" detail={`+ ${formatEuro(k.revenueCents)}`} chevron onClick={() => setTarget({ kind: 'revenue' })} />
          <Row title="Mance" detail={`+ ${formatEuro(k.tipsCents)}`} chevron onClick={() => setTarget({ kind: 'tips' })} />
          <Row title="Spese" detail={`− ${formatEuro(k.expensesCents)}`} chevron onClick={() => setTarget({ kind: 'expenses' })} />
          <Row
            title={<strong>Utile</strong>}
            detail={<strong style={{ color: k.profitCents < 0 ? 'var(--red)' : 'var(--label)' }}>{formatEuro(k.profitCents)}</strong>}
          />
        </Section>
      </>
    );
  } else if (kind === 'service' && target.serviceKey) {
    const list = serviceList(appts, range, target.serviceKey);
    const revenue = list.reduce((s, a) => s + a.services.filter((x) => (x.serviceId || x.name) === target.serviceKey).reduce((t, x) => t + x.priceCents, 0), 0);
    body = (
      <>
        {hero(String(list.length), `volte nel periodo · ${formatEuro(revenue)} da listino`)}
        {list.length ? dayGroups(list) : empty}
      </>
    );
  }

  const title = kind === 'service' ? target.serviceName ?? STAT_TITLES.service : STAT_TITLES[kind];
  return (
    <Sheet
      title={title}
      onClose={onClose}
      tall
      left={
        target !== initial ? (
          <button type="button" className="nav-btn" onClick={() => setTarget(initial)}>
            ‹ {STAT_TITLES[initial.kind]}
          </button>
        ) : undefined
      }
    >
      {body}
    </Sheet>
  );
}
