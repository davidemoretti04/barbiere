export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled';

/**
 * Condivide un file con il menu di sistema (iOS: Salva su File, AirDrop, WhatsApp, Mail…).
 * Se il browser non lo permette, scarica il file.
 */
export async function shareOrDownload(file: File, title: string): Promise<ShareOutcome> {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title });
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
      // altri errori (es. NotAllowedError): prova con il download
    }
  }
  downloadFile(file);
  return 'downloaded';
}

export function downloadFile(file: File): void {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
