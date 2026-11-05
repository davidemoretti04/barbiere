import { useRef, useState } from 'react';
import { useFeedback } from '../../components/feedback-context';
import { IconDownload, IconShare, IconWarning } from '../../components/Icons';
import { Sheet } from '../../components/Sheet';
import { BackButton, Page, Row, Section } from '../../components/ui';
import { db, getSettings, updateSettings } from '../../db/db';
import { useAllAppointments, useClients, useSettings } from '../../db/hooks';
import {
  backupFileName,
  clearAllData,
  createBackup,
  importBackup,
  readAllData,
  serializeBackup,
  parseBackup,
  writeAllData,
  type BackupFile,
  type BackupSummary,
} from '../../lib/backup';
import { clientsCsv, revenueCsv } from '../../lib/csv';
import { fmt } from '../../lib/format';
import { generateSampleData } from '../../lib/sample';
import { shareOrDownload } from '../../lib/share';
import { navigate } from '../../router';

export function BackupPage() {
  const settings = useSettings();
  const clients = useClients();
  const appts = useAllAppointments();
  const { toast, confirm } = useFeedback();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ backup: BackupFile; summary: BackupSummary } | null>(null);
  const [importError, setImportError] = useState('');
  const [busy, setBusy] = useState(false);

  async function exportBackup() {
    setBusy(true);
    try {
      const now = new Date();
      const current = await readAllData(db);
      const data = { ...current, settings: { ...(current.settings ?? (await getSettings())), lastBackupAt: now.getTime() } };
      const file = new File([serializeBackup(createBackup(data, now))], backupFileName(now), { type: 'application/json' });
      const outcome = await shareOrDownload(file, 'Backup Barbiere');
      if (outcome === 'cancelled') {
        toast('Backup non salvato.');
      } else {
        await updateSettings({ lastBackupAt: now.getTime() });
        toast(outcome === 'shared' ? 'Backup pronto: salvalo in un posto sicuro' : 'Backup scaricato');
      }
    } catch {
      toast('Non è stato possibile creare il backup. Riprova.');
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File | undefined) {
    setImportError('');
    if (!file) return;
    try {
      const text = await file.text();
      const res = parseBackup(text);
      if (!res.ok) setImportError(res.error);
      else setPreview({ backup: res.backup, summary: res.summary });
    } catch {
      setImportError('Non è stato possibile leggere il file.');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function doImport(mode: 'replace' | 'merge') {
    if (!preview) return;
    if (mode === 'replace') {
      const ok = await confirm({
        title: 'Sostituire tutti i dati?',
        message: 'I dati attuali su questo telefono verranno cancellati e sostituiti con quelli del backup.',
        confirmLabel: 'Sostituisci tutto',
        destructive: true,
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      await importBackup(db, preview.backup, mode);
      setPreview(null);
      toast(mode === 'replace' ? 'Backup ripristinato' : 'Dati uniti al backup');
      navigate('/agenda', { replace: true });
    } catch {
      toast('Importazione non riuscita: i dati attuali non sono stati modificati.');
    } finally {
      setBusy(false);
    }
  }

  async function exportCsv(kind: 'incassi' | 'clienti') {
    const [cs, as] = [await db.clients.toArray(), await db.appointments.toArray()];
    const text = kind === 'incassi' ? revenueCsv(as, cs) : clientsCsv(cs, as);
    const file = new File([text], `${kind}-${fmt(new Date(), 'yyyy-MM-dd')}.csv`, { type: 'text/csv' });
    const outcome = await shareOrDownload(file, kind === 'incassi' ? 'Incassi' : 'Clienti');
    if (outcome !== 'cancelled') toast('File CSV pronto');
  }

  async function loadSample() {
    const hasData = (clients?.length ?? 0) + (appts?.length ?? 0) > 0;
    const ok = await confirm({
      title: 'Caricare i dati di esempio?',
      message: hasData
        ? 'Clienti e appuntamenti finti verranno AGGIUNTI ai tuoi dati. Per toglierli dovrai usare «Cancella tutti i dati».'
        : 'Verranno creati clienti, appuntamenti e spese finti per provare l’app.',
      confirmLabel: 'Carica dati di esempio',
    });
    if (!ok) return;
    const s = await getSettings();
    const sample = generateSampleData(new Date(), { ...s, onboarded: true });
    const current = await readAllData(db);
    await writeAllData(db, {
      clients: [...current.clients, ...sample.clients],
      services: [...current.services, ...sample.services.filter((x) => !current.services.some((c) => c.name === x.name))],
      appointments: [...current.appointments, ...sample.appointments],
      expenses: [...current.expenses, ...sample.expenses],
      settings: { ...s, onboarded: true },
    });
    toast('Dati di esempio caricati');
  }

  async function wipe() {
    const first = await confirm({
      title: 'Cancellare tutti i dati?',
      message: 'Clienti, appuntamenti, listino, spese e impostazioni verranno eliminati da questo telefono.',
      confirmLabel: 'Continua',
      destructive: true,
    });
    if (!first) return;
    const second = await confirm({
      title: 'Sei sicuro? Non si può annullare.',
      message: settings?.lastBackupAt ? `Ultimo backup: ${fmt(settings.lastBackupAt, 'd MMMM yyyy HH:mm')}.` : 'Non hai mai fatto un backup!',
      confirmLabel: 'Cancella tutto definitivamente',
      destructive: true,
    });
    if (!second) return;
    await clearAllData(db);
    navigate('/agenda', { replace: true });
  }

  return (
    <Page title="Backup e dati" left={<BackButton label="Altro" fallback="/altro" />}>
      <Section
        footer={
          <>
            I dati sono salvati solo su questo telefono. Esporta un backup regolarmente e salvalo su <b>File → iCloud Drive</b> oppure inviatelo via mail o WhatsApp.
            {settings && (
              <>
                <br />
                Ultimo backup: <b>{settings.lastBackupAt ? fmt(settings.lastBackupAt, "d MMMM yyyy 'alle' HH:mm") : 'mai'}</b>
              </>
            )}
          </>
        }
      >
        <button type="button" className="row action" onClick={exportBackup} disabled={busy}>
          <IconShare width={22} height={22} />
          <span className="row-main">Esporta backup</span>
        </button>
        <button type="button" className="row action" onClick={() => fileRef.current?.click()} disabled={busy}>
          <IconDownload width={22} height={22} />
          <span className="row-main">Importa backup…</span>
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
      </Section>
      {importError && (
        <div className="warn" role="alert">
          <IconWarning />
          <div>{importError}</div>
        </div>
      )}

      <Section header="Per il commercialista" footer="File CSV apribili con Excel o Numbers.">
        <Row title="Esporta incassi (CSV)" onClick={() => void exportCsv('incassi')} className="action" />
        <Row title="Esporta clienti (CSV)" onClick={() => void exportCsv('clienti')} className="action" />
      </Section>

      <Section header="Prova l’app" footer="I dati di esempio sono inventati e vengono creati solo su questo telefono.">
        <Row title="Carica dati di esempio" onClick={() => void loadSample()} className="action" />
      </Section>

      <Section>
        <button type="button" className="row destructive" onClick={wipe}>
          Cancella tutti i dati
        </button>
      </Section>

      {preview && (
        <Sheet title="Importa backup" onClose={() => setPreview(null)}>
          <div className="hero">
            <p>Backup del</p>
            <h1 style={{ fontSize: 22 }}>{preview.summary.exportedAt ? fmt(new Date(preview.summary.exportedAt), "d MMMM yyyy 'alle' HH:mm") : 'data sconosciuta'}</h1>
          </div>
          <Section header="Contenuto">
            <Row title="Clienti" detail={preview.summary.clients} />
            <Row title="Appuntamenti" detail={preview.summary.appointments} />
            <Row title="Servizi del listino" detail={preview.summary.services} />
            <Row title="Spese" detail={preview.summary.expenses} />
            <Row title="Impostazioni" detail={preview.summary.hasSettings ? 'Sì' : 'No'} />
          </Section>
          <Section header="Sul telefono adesso">
            <Row title="Clienti" detail={clients?.length ?? 0} />
            <Row title="Appuntamenti" detail={appts?.length ?? 0} />
          </Section>
          <div className="sheet-pad" style={{ display: 'grid', gap: 10 }}>
            <button type="button" className="btn red" onClick={() => void doImport('replace')} disabled={busy}>
              Sostituisci tutto
            </button>
            <p className="small muted" style={{ margin: '-4px 4px 6px' }}>
              Cancella i dati attuali e ripristina esattamente il backup. Consigliato per passare a un nuovo telefono.
            </p>
            <button type="button" className="btn gray" onClick={() => void doImport('merge')} disabled={busy}>
              Unisci ai dati attuali
            </button>
            <p className="small muted" style={{ margin: '-4px 4px 0' }}>
              Aggiunge i dati del backup a quelli presenti; se un elemento esiste in entrambi vince quello del backup. Le impostazioni attuali restano.
            </p>
          </div>
        </Sheet>
      )}
    </Page>
  );
}
