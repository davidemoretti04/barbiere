import { BackupBanner } from '../../components/BackupBanner';
import { IconDatabase, IconGear, IconScissors } from '../../components/Icons';
import { Page, Row, Section } from '../../components/ui';
import { useServices, useSettings } from '../../db/hooks';
import { fmt } from '../../lib/format';
import { navigate } from '../../router';

export function MorePage() {
  const services = useServices();
  const settings = useSettings();
  const active = (services ?? []).filter((s) => s.active).length;
  return (
    <Page title="Altro">
      <BackupBanner />
      <Section>
        <Row icon={<IconScissors />} iconBg="#ff9500" title="Listino servizi" detail={active ? `${active}` : undefined} chevron onClick={() => navigate('/altro/listino')} />
      </Section>
      <Section>
        <Row icon={<IconGear />} iconBg="#8e8e93" title="Impostazioni" chevron onClick={() => navigate('/altro/impostazioni')} />
        <Row
          icon={<IconDatabase />}
          iconBg="#007aff"
          title="Backup e dati"
          sub={settings?.lastBackupAt ? `Ultimo backup: ${fmt(settings.lastBackupAt, 'd MMM yyyy')}` : 'Nessun backup ancora'}
          chevron
          onClick={() => navigate('/altro/backup')}
        />
      </Section>
      <p className="center muted small" style={{ padding: '0 24px' }}>
        I dati restano solo su questo telefono. Fai un backup regolarmente e salvalo su iCloud Drive o inviatelo via mail.
        <br />
        Versione {__APP_VERSION__}
      </p>
    </Page>
  );
}
