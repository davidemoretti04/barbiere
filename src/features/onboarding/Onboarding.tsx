import { useRef, useState } from 'react';
import { useFeedback } from '../../components/feedback-context';
import { IconPlus, IconX } from '../../components/Icons';
import { Field, Section } from '../../components/ui';
import { db } from '../../db/db';
import { DEFAULT_SETTINGS, type Settings } from '../../db/types';
import { importBackup, parseBackup, writeAllData } from '../../lib/backup';
import { newId } from '../../lib/id';
import { centsToInput, parseEuro } from '../../lib/money';
import { generateSampleData } from '../../lib/sample';
import { hoursProblem, SLOT_PRESETS } from '../../lib/schedule';
import { MinutesField } from '../../components/MinutesField';
import { WorkingHoursEditor } from '../more/WorkingHoursEditor';

interface DraftService {
  key: string;
  name: string;
  price: string;
  duration: string;
}

const STARTER: DraftService[] = [
  { key: 'a', name: 'Taglio', price: '18', duration: '30' },
  { key: 'b', name: 'Barba', price: '10', duration: '20' },
  { key: 'c', name: 'Taglio + barba', price: '25', duration: '45' },
];

/** Configurazione guidata al primo avvio: orari, durata slot, listino iniziale. */
export function Onboarding() {
  const { toast, confirm } = useFeedback();
  const [step, setStep] = useState(0);
  const [settings, setSettings] = useState<Settings>({ ...DEFAULT_SETTINGS });
  const [services, setServices] = useState<DraftService[]>(STARTER);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  const go = (n: number) => {
    setError('');
    setStep(n);
    pageRef.current?.scrollTo({ top: 0 });
  };

  async function finish() {
    const parsed = services
      .filter((s) => s.name.trim())
      .map((s) => ({ name: s.name.trim(), price: parseEuro(s.price || '0'), duration: parseInt(s.duration, 10) }));
    const bad = parsed.find((s) => s.price === null || !(s.duration > 0));
    if (bad) return setError(`Controlla prezzo e durata di «${bad.name}».`);
    await db.transaction('rw', db.services, db.settings, async () => {
      await db.services.bulkPut(parsed.map((s) => ({ id: newId(), name: s.name, priceCents: s.price ?? 0, durationMinutes: s.duration, active: true })));
      await db.settings.put({ ...settings, onboarded: true });
    });
  }

  async function sample() {
    const ok = await confirm({ title: 'Provare con dati di esempio?', message: 'Verranno creati clienti e appuntamenti inventati. Potrai cancellarli da Altro → Backup e dati.', confirmLabel: 'Carica dati di esempio' });
    if (ok) await writeAllData(db, generateSampleData(new Date(), { ...DEFAULT_SETTINGS, onboarded: true }));
  }

  async function restore(file: File | undefined) {
    if (!file) return;
    const res = parseBackup(await file.text());
    if (fileRef.current) fileRef.current.value = '';
    if (!res.ok) return toast(res.error);
    await importBackup(db, res.backup, 'replace');
    toast(`Ripristinati ${res.summary.clients} clienti e ${res.summary.appointments} appuntamenti`);
  }

  const problem = hoursProblem(settings.workingHours);

  return (
    <div className="page" ref={pageRef} style={{ paddingBottom: 0 }}>
      <div className="onboarding">
        <div className="steps" aria-label={`Passo ${step + 1} di 3`}>
          {[0, 1, 2].map((i) => (
            <i key={i} className={i === step ? 'on' : ''} />
          ))}
        </div>

        {step === 0 && (
          <>
            <img src={`${import.meta.env.BASE_URL}pwa-192.png`} alt="" className="hero-icon" />
            <div className="hero">
              <h1>Benvenuto!</h1>
              <p>Agenda, clienti e incassi in un’unica app. I dati restano solo su questo telefono.</p>
            </div>
            <Section header="Quando lavori?" group={false} footer={problem ?? 'Puoi aggiungere più fasce (es. pausa pranzo) e cambiarle in seguito.'}>
              <WorkingHoursEditor value={settings.workingHours} onChange={(wh) => setSettings({ ...settings, workingHours: wh })} />
            </Section>
            <Section>
              <button type="button" className="row action" onClick={() => fileRef.current?.click()}>
                <span className="row-main">Ho già un backup: ripristinalo</span>
              </button>
              <button type="button" className="row action" onClick={() => void sample()}>
                <span className="row-main">Prova con dati di esempio</span>
              </button>
            </Section>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => void restore(e.target.files?.[0])} />
          </>
        )}

        {step === 1 && (
          <>
            <div className="hero">
              <h1>Durata degli appuntamenti</h1>
              <p>Lo slot è il passo dell’agenda (es. ogni 30 minuti). La durata predefinita si usa quando non scegli un servizio.</p>
            </div>
            <Section>
              <MinutesField key={`s${settings.slotMinutes}`} label="Durata slot" value={settings.slotMinutes} onChange={(n) => setSettings({ ...settings, slotMinutes: n })} />
              <div className="field" style={{ minHeight: 52 }}>
                <div className="chips" role="group" aria-label="Durata slot rapida">
                  {SLOT_PRESETS.map((m) => (
                    <button key={m} type="button" className="chip" aria-pressed={settings.slotMinutes === m} onClick={() => setSettings({ ...settings, slotMinutes: m })}>
                      {m} min
                    </button>
                  ))}
                </div>
              </div>
              <MinutesField
                key={`d${settings.defaultDurationMinutes}`}
                label="Durata predefinita"
                value={settings.defaultDurationMinutes}
                onChange={(n) => setSettings({ ...settings, defaultDurationMinutes: n })}
              />
            </Section>
          </>
        )}

        {step === 2 && (
          <>
            <div className="hero">
              <h1>Il tuo listino</h1>
              <p>Modifica prezzi e durate, aggiungi o togli servizi. Potrai cambiarli quando vuoi.</p>
            </div>
            {services.map((s, i) => (
              <Section
                key={s.key}
                header={`Servizio ${i + 1}`}
                headerRight={
                  <button type="button" className="icon-btn" style={{ color: 'var(--red)', minHeight: 32 }} aria-label={`Rimuovi ${s.name || 'servizio'}`} onClick={() => setServices(services.filter((x) => x.key !== s.key))}>
                    <IconX width={18} height={18} />
                  </button>
                }
              >
                <Field label="Nome">
                  <input value={s.name} onChange={(e) => setServices(services.map((x) => (x.key === s.key ? { ...x, name: e.target.value } : x)))} placeholder="Es. Taglio" />
                </Field>
                <Field label="Prezzo">
                  <input type="text" inputMode="decimal" value={s.price} onChange={(e) => setServices(services.map((x) => (x.key === s.key ? { ...x, price: e.target.value } : x)))} />
                  <span className="suffix">€</span>
                </Field>
                <Field label="Durata">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={s.duration}
                    onChange={(e) => setServices(services.map((x) => (x.key === s.key ? { ...x, duration: e.target.value.replace(/\D/g, '') } : x)))}
                  />
                  <span className="suffix">min</span>
                </Field>
              </Section>
            ))}
            <Section>
              <button type="button" className="row action" onClick={() => setServices([...services, { key: newId(), name: '', price: centsToInput(0), duration: String(settings.defaultDurationMinutes) }])}>
                <IconPlus width={20} height={20} />
                <span className="row-main">Aggiungi servizio</span>
              </button>
            </Section>
            {error && (
              <div className="field-error" role="alert" style={{ marginBottom: 12 }}>
                {error}
              </div>
            )}
          </>
        )}

        <div className="footer-bar">
          <div className="btn-row">
            {step > 0 && (
              <button type="button" className="btn gray" onClick={() => go(step - 1)}>
                Indietro
              </button>
            )}
            {step < 2 ? (
              <button type="button" className="btn" disabled={!!problem && step === 0} onClick={() => go(step + 1)}>
                Avanti
              </button>
            ) : (
              <button type="button" className="btn" onClick={() => void finish()}>
                Inizia
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
