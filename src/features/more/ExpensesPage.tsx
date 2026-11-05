import { addMonths, startOfMonth } from 'date-fns';
import { useState } from 'react';
import { useFeedback } from '../../components/feedback-context';
import { IconCart, IconChevronLeft, IconChevronRight, IconPlus } from '../../components/Icons';
import { Sheet } from '../../components/Sheet';
import { SwipeRow } from '../../components/SwipeRow';
import { EmptyState, Field, Page, Row, Section } from '../../components/ui';
import { deleteExpense, saveExpense } from '../../db/actions';
import { useExpenses } from '../../db/hooks';
import { EXPENSE_CATEGORIES, type Expense } from '../../db/types';
import { capitalize, fmt } from '../../lib/format';
import { newId } from '../../lib/id';
import { centsToInput, formatEuro, parseEuro } from '../../lib/money';
import { fromDateKey, toDateKey } from '../../lib/schedule';
import { expensesByCategory, expensesIn, periodRange } from '../../lib/stats';
import { useNow } from '../../hooks/useNow';

export function ExpensesPage() {
  const expenses = useExpenses();
  const { toast, confirm } = useFeedback();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [editing, setEditing] = useState<Expense | 'new' | null>(null);
  const now = useNow();

  const range = periodRange('month', month);
  const list = expensesIn(expenses ?? [], range).sort((a, b) => b.date.localeCompare(a.date));
  const total = list.reduce((s, e) => s + e.amountCents, 0);
  const cats = expensesByCategory(expenses ?? [], range);

  async function remove(e: Expense) {
    const ok = await confirm({ title: 'Eliminare la spesa?', message: `${e.category} · ${formatEuro(e.amountCents)}`, confirmLabel: 'Elimina', destructive: true });
    if (!ok) return;
    const undo = await deleteExpense(e.id);
    toast({ message: 'Spesa eliminata', actionLabel: 'Annulla', onAction: () => void undo() });
  }

  return (
    <Page
      title="Spese"
      right={
        <button type="button" className="nav-btn" onClick={() => setEditing('new')} aria-label="Nuova spesa">
          <IconPlus />
        </button>
      }
    >
      <div className="date-nav">
        <button type="button" className="icon-btn" onClick={() => setMonth(addMonths(month, -1))} aria-label="Mese precedente">
          <IconChevronLeft />
        </button>
        <div className="label">{capitalize(fmt(month, 'MMMM yyyy'))}</div>
        <button type="button" className="icon-btn" onClick={() => setMonth(addMonths(month, 1))} aria-label="Mese successivo">
          <IconChevronRight />
        </button>
      </div>

      <div className="kpis">
        <div className="kpi wide">
          <div className="k-label">Totale spese del mese</div>
          <div className="k-value">{formatEuro(total)}</div>
        </div>
      </div>

      {expenses && list.length === 0 && (
        <EmptyState
          icon={<IconCart />}
          title="Nessuna spesa"
          text="Registra affitto, prodotti e bollette: le statistiche calcoleranno l’utile."
          action={
            <button type="button" className="btn" onClick={() => setEditing('new')}>
              <IconPlus /> Aggiungi spesa
            </button>
          }
        />
      )}

      {cats.length > 0 && (
        <Section header="Per categoria">
          {cats.map((c) => (
            <Row key={c.category} title={c.category} detail={formatEuro(c.amountCents)} />
          ))}
        </Section>
      )}

      {list.length > 0 && (
        <Section header="Movimenti" footer="Scorri a sinistra per eliminare.">
          {list.map((e) => (
            <SwipeRow key={e.id} actions={[{ label: 'Elimina', color: 'red', onClick: () => void remove(e) }]}>
              <Row
                title={e.category}
                sub={`${fmt(fromDateKey(e.date), 'EEE d MMM')}${e.notes ? ` · ${e.notes}` : ''}`}
                detail={formatEuro(e.amountCents)}
                onClick={() => setEditing(e)}
              />
            </SwipeRow>
          ))}
        </Section>
      )}

      {editing && (
        <ExpenseForm
          expense={editing === 'new' ? undefined : editing}
          defaultDate={range.end > now && range.start <= now ? toDateKey(new Date(now)) : toDateKey(month)}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            toast('Spesa salvata');
          }}
        />
      )}
    </Page>
  );
}

function ExpenseForm({
  expense,
  defaultDate,
  onClose,
  onSaved,
}: {
  expense?: Expense;
  defaultDate: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [date, setDate] = useState(expense?.date ?? defaultDate);
  const [category, setCategory] = useState(expense?.category ?? 'Prodotti');
  const [amount, setAmount] = useState(expense ? centsToInput(expense.amountCents) : '');
  const [notes, setNotes] = useState(expense?.notes ?? '');
  const [error, setError] = useState('');

  async function save() {
    const cents = parseEuro(amount);
    if (cents === null || cents <= 0) return setError('Inserisci un importo valido, ad esempio 45 oppure 45,90.');
    if (!date) return setError('Indica la data.');
    await saveExpense({ id: expense?.id ?? newId(), date, category: category.trim() || 'Altro', amountCents: cents, notes: notes.trim() });
    onSaved();
  }

  return (
    <Sheet
      title={expense ? 'Modifica spesa' : 'Nuova spesa'}
      onClose={onClose}
      dismissable={false}
      left={
        <button type="button" className="nav-btn" onClick={onClose}>
          Annulla
        </button>
      }
      right={
        <button type="button" className="nav-btn bold" onClick={save}>
          Salva
        </button>
      }
    >
      <Section>
        <Field label="Importo">
          <input type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" autoFocus={!expense} />
          <span className="suffix">€</span>
        </Field>
        <Field label="Data">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </Section>
      <div className="section-header">Categoria</div>
      <div className="chips" style={{ margin: '0 16px 24px' }} role="group" aria-label="Categoria">
        {EXPENSE_CATEGORIES.map((c) => (
          <button key={c} type="button" className="chip" aria-pressed={category === c} onClick={() => setCategory(c)}>
            {c}
          </button>
        ))}
      </div>
      <Section header="Note">
        <label className="field stack">
          <span className="sr-only">Note</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Facoltative" rows={2} />
        </label>
      </Section>
      {error && (
        <div className="field-error" role="alert">
          {error}
        </div>
      )}
    </Sheet>
  );
}
