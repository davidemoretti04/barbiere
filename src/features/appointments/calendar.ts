import type { Appointment, Client } from '../../db/types';
import { clientName, servicesLabel } from '../../lib/format';
import { buildIcsCalendar } from '../../lib/ics';
import { downloadFile } from '../../lib/share';

export const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/**
 * Genera il file .ics di uno o più appuntamenti (es. una serie ricorrente) per il Calendario di Apple.
 * Su iPhone viene aperto direttamente: iOS mostra l'anteprima con «Aggiungi» / «Aggiungi tutti».
 * Altrove viene scaricato.
 */
export function addToCalendar(appts: Appointment | Appointment[], client: Pick<Client, 'firstName' | 'lastName' | 'phone'> | undefined) {
  const list = Array.isArray(appts) ? appts : [appts];
  if (!list.length) return;
  // serie «Sempre»: un solo evento che il Calendario ripete senza fine
  const events = list.length > 1 && list[0].openEnded ? [list[0]] : list;
  const ics = buildIcsCalendar(
    events.map((a) => ({
      uid: `${a.id}@barbiere-gestionale`,
      start: a.start,
      end: a.end,
      summary: `${clientName(client)} – ${servicesLabel(a)}`,
      description: [client?.phone ? `Tel: ${client.phone}` : '', a.notes].filter(Boolean).join('\n'),
      alarmMinutesBefore: 30,
      repeatWeeks: list.length > 1 && a.openEnded ? a.repeatWeeks : undefined,
    })),
  );
  const file = new File([ics], `appuntamento-${list[0].id.slice(0, 8)}.ics`, { type: 'text/calendar' });
  if (isIOS()) {
    const url = URL.createObjectURL(file);
    window.location.assign(url);
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } else {
    downloadFile(file);
  }
}
