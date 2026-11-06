import { useState } from 'react';
import { useFeedback } from '../../components/feedback-context';
import { IconPlus } from '../../components/Icons';
import { Sheet } from '../../components/Sheet';
import { SwipeRow } from '../../components/SwipeRow';
import { BackButton, Field, Page, Row, Section } from '../../components/ui';
import { updateSettings } from '../../db/db';
import { useSettings } from '../../db/hooks';
import type { Closure, Settings } from '../../db/types';
import { fmt, reminderText } from '../../lib/format';
import { newId } from '../../lib/id';
import { fromDateKey, hoursProblem, SLOT_PRESETS, toDateKey } from '../../lib/schedule';
import { WorkingHoursEditor } from './WorkingHoursEditor';
import { useNow } from '../../hooks/useNow';
import { MinutesField } from '../../components/MinutesField';

export function SettingsPage() {
  const settings = useSettings();
  const { toast } = useFeedback();
  const [closureOpen, setClosureOpen] = useState(false);
  const now = useNow();
  if (!settings) return <Page title="Impostazioni" left={<BackButton label="Altro" fallback="/altro" />} swipeBackFallback="/altro">{null}</Page>;

  const save = (patch: Partial<Settings>) => void updateSettings(patch);
  const problem = hoursProblem(settings.workingHours);
  const sampleText = reminderText(settings.reminderTemplate, { id: 'x', firstName: 'Marco', lastName: '', phone: '', notes: '', createdAt: 0 }, { start: now + 86400000 });

  return (
    <Page title="Impostazioni" left={<BackButton label="Altro" fallback="/altro" />} swipeBackFallback="/altro">
      <Section header="Orari di lavoro" group={false} footer={problem ?? 'Aggiungi più fasce per la pausa pranzo. Gli appuntamenti fuori orario sono permessi, con un avviso.'}>
        <WorkingHoursEditor value={settings.workingHours} onChange={(wh) => save({ workingHours: wh })} />
      </Section>

      <Section header="Agenda" footer="Durata slot: l’altezza delle righe nella vista giorno e il passo degli orari proposti.">
        <MinutesField key={`slot-${settings.slotMinutes}`} label="Durata slot" value={settings.slotMinutes} onChange={(n) => save({ slotMinutes: n })} />
        <div className="field" style={{ minHeight: 52 }}>
          <div className="chips" role="group" aria-label="Durata slot rapida">
            {SLOT_PRESETS.map((m) => (
              <button key={m} type="button" className="chip" aria-pressed={settings.slotMinutes === m} onClick={() => save({ slotMinutes: m })}>
                {m} min
              </button>
            ))}
          </div>
        </div>
        <MinutesField
          key={`def-${settings.defaultDurationMinutes}`}
          label="Durata predefinita"
          value={settings.defaultDurationMinutes}
          onChange={(n) => save({ defaultDurationMinutes: n })}
        />
      </Section>

      <Section header="Chiusure e ferie" footer="Scorri a sinistra per eliminare.">
        {settings.closures.length === 0 && <Row title={<span className="muted">Nessuna chiusura programmata</span>} />}
        {[...settings.closures]
          .sort((a, b) => a.from.localeCompare(b.from))
          .map((c) => (
            <SwipeRow
              key={c.id}
              actions={[
                {
                  label: 'Elimina',
                  color: 'red',
                  onClick: () => {
                    save({ closures: settings.closures.filter((x) => x.id !== c.id) });
                    toast({ message: 'Chiusura eliminata', actionLabel: 'Annulla', onAction: () => save({ closures: settings.closures }) });
                  },
                },
              ]}
            >
              <Row
                title={c.label || 'Chiusura'}
                detail={c.from === c.to ? fmt(fromDateKey(c.from), 'd MMM yyyy') : `${fmt(fromDateKey(c.from), 'd MMM')} – ${fmt(fromDateKey(c.to), 'd MMM yyyy')}`}
              />
            </SwipeRow>
          ))}
        <button type="button" className="row action" onClick={() => setClosureOpen(true)}>
          <IconPlus width={20} height={20} />
          <span className="row-main">Aggiungi chiusura</span>
        </button>
      </Section>

      <Section header="Promemoria WhatsApp / SMS" footer={<>Segnaposto: <b>{'{nome}'}</b>, <b>{'{data}'}</b>, <b>{'{ora}'}</b>. Anteprima: «{sampleText}»</>}>
        <label className="field stack">
          <span className="sr-only">Testo del promemoria</span>
          <textarea
            defaultValue={settings.reminderTemplate}
            rows={4}
            onBlur={(e) => save({ reminderTemplate: e.target.value.trim() || settings.reminderTemplate })}
            onChange={(e) => e.target.value.trim() && save({ reminderTemplate: e.target.value })}
          />
        </label>
      </Section>

      <Section header="Clienti" footer="Dopo quante settimane senza visite un cliente compare in «Da ricontattare».">
        <Field label="Cliente inattivo dopo">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            defaultValue={settings.inactiveWeeks}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              if (n >= 1 && n <= 104) save({ inactiveWeeks: n });
            }}
          />
          <span className="suffix">sett.</span>
        </Field>
      </Section>

      {closureOpen && (
        <ClosureForm
          onClose={() => setClosureOpen(false)}
          onSave={(c) => {
            save({ closures: [...settings.closures, c] });
            setClosureOpen(false);
            toast('Chiusura aggiunta');
          }}
        />
      )}
    </Page>
  );
}

function ClosureForm({ onClose, onSave }: { onClose: () => void; onSave: (c: Closure) => void }) {
  const today = toDateKey(new Date());
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [label, setLabel] = useState('Ferie');
  const valid = from && to && from <= to;
  return (
    <Sheet
      title="Nuova chiusura"
      onClose={onClose}
      left={
        <button type="button" className="nav-btn" onClick={onClose}>
          Annulla
        </button>
      }
      right={
        <button type="button" className="nav-btn bold" disabled={!valid} onClick={() => onSave({ id: newId(), from, to, label: label.trim() })}>
          Aggiungi
        </button>
      }
    >
      <Section footer={!valid ? 'La data di fine deve essere uguale o successiva all’inizio.' : undefined}>
        <Field label="Motivo">
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Es. Ferie, Festa patronale" />
        </Field>
        <Field label="Dal">
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              if (e.target.value > to) setTo(e.target.value);
            }}
          />
        </Field>
        <Field label="Al">
          <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </Field>
      </Section>
    </Sheet>
  );
}
