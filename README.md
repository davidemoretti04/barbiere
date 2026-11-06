# Barbiere — Gestionale (app per iPhone)

App per un barbiere che lavora da solo: **agenda**, **clienti**, **incassi**, **statistiche**, **spese** e **backup**.
Si installa su iPhone da Safari come una vera app, funziona **senza internet** e **non costa nulla**: niente server,
niente account, niente abbonamenti. **Tutti i dati restano sul telefono.**

---

## Indice

1. [Pubblicare l’app gratis su GitHub Pages](#1-pubblicare-lapp-gratis-su-github-pages)
2. [Installare l’app su iPhone](#2-installare-lapp-su-iphone)
3. [Backup: come non perdere mai i dati](#3-backup-come-non-perdere-mai-i-dati)
4. [Come si usa (in breve)](#4-come-si-usa-in-breve)
5. [Aggiornare l’app](#5-aggiornare-lapp)
6. [Per chi sviluppa](#6-per-chi-sviluppa)
7. [Scelte fatte e limiti noti](#7-scelte-fatte-e-limiti-noti)

---

## 1. Pubblicare l’app gratis su GitHub Pages

Serve solo un account GitHub gratuito. Non serve installare nulla sul computer.

1. **Crea un account** su <https://github.com> (se non ce l’hai).
2. **Crea un repository nuovo**: in alto a destra **+** → **New repository**.
   - *Repository name*: ad esempio `barbiere` (sarà parte dell’indirizzo dell’app).
   - Lascia **Public** (GitHub Pages gratuito richiede un repository pubblico).
     Non è un problema: nel repository c’è solo il programma, **mai i dati dei clienti**, che stanno solo sul telefono.
   - Premi **Create repository**.
3. **Carica i file**: nella pagina del repository vuoto, clicca **uploading an existing file**,
   trascina **tutto il contenuto** di questa cartella (comprese le cartelle `.github`, `public`, `scripts`, `src`)
   **tranne** le cartelle `node_modules` e `dist`, poi premi **Commit changes**.
   > Su Mac/Windows le cartelle che iniziano con il punto (`.github`) possono essere nascoste:
   > su Mac premi `Cmd + Shift + .` nel Finder per mostrarle; su Windows *Visualizza → Elementi nascosti*.
   > Senza `.github/workflows/deploy.yml` la pubblicazione automatica non parte.
4. **Attiva Pages**: nel repository vai su **Settings** → **Pages** →
   alla voce **Source** scegli **GitHub Actions**.
5. **Avvia la pubblicazione**: vai sulla scheda **Actions**. Se vedi “Pubblica su GitHub Pages” in esecuzione aspetta il
   segno di spunta verde (circa 1–2 minuti). Se non è partito, clicca **Pubblica su GitHub Pages** → **Run workflow**.
6. **Fatto!** L’app è online all’indirizzo:

   ```
   https://<tuo-nome-utente>.github.io/<nome-repository>/
   ```

   ad esempio `https://mariorossi.github.io/barbiere/`. Lo trovi anche in **Settings → Pages**.

Ogni volta che modifichi un file nel ramo `main`, l’app viene ricostruita e ripubblicata da sola.

---

## 2. Installare l’app su iPhone

1. Apri **Safari** (deve essere Safari) e vai all’indirizzo dell’app.
2. Tocca il pulsante **Condividi** (il quadrato con la freccia in su).
3. Scorri e tocca **Aggiungi alla schermata Home** → **Aggiungi**.
4. Apri l’app dall’icona con le forbici: si apre a **schermo intero**, come un’app normale.
5. La prima volta si apre la **guida** e l’app contiene già **dati di esempio** (clienti e appuntamenti inventati). Due scelte:
   - **Configura la mia barberia**: toglie gli esempi e chiede orari di lavoro, durata degli slot e listino;
   - **Prima provo con gli esempi**: entri subito nell’app. Quando vuoi iniziare davvero tocca **Cancella** nel banner azzurro:
     spariscono solo i dati finti e torni alla guida. I clienti che hai inserito tu restano.

Dopo la prima apertura l’app funziona anche **in modalità aereo**.

> **Importante:** usa sempre l’app dall’icona sulla schermata Home. I dati dell’icona e quelli di Safari sono separati.

---

## 3. Backup: come non perdere mai i dati

I dati vivono **solo sul telefono** (non c’è cloud). Se perdi o cambi il telefono, o cancelli l’app, i dati
si perdono — **a meno che tu non abbia un backup**. L’app ti avvisa con un banner se l’ultimo backup ha più di 14 giorni; con la ✕ lo nascondi per 7 giorni.

**Fare un backup** (consigliato ogni settimana):

1. **Altro → Backup e dati → Esporta backup**.
2. Si apre il menu di condivisione di iPhone: scegli **Salva su File** → **iCloud Drive**
   (oppure invialo a te stesso via Mail o WhatsApp).

**Ripristinare un backup** (es. su un telefono nuovo):

1. Installa l’app come al punto 2.
2. Nella configurazione iniziale tocca **Ho già un backup: ripristinalo**, oppure vai in
   **Altro → Backup e dati → Importa backup…** e scegli il file `backup-barbiere-AAAA-MM-GG.json`.
3. Vedrai un’anteprima (quanti clienti, appuntamenti, ecc.) e potrai scegliere:
   - **Sostituisci tutto**: cancella i dati attuali e ripristina esattamente il backup (per il telefono nuovo);
   - **Unisci ai dati attuali**: aggiunge i dati del backup; se un elemento esiste in entrambi vince quello del backup.
     Le impostazioni attuali restano.

**Per il commercialista**: **Altro → Backup e dati → Esporta incassi (CSV)** / **Esporta clienti (CSV)**.
I file si aprono con Excel o Numbers.

**Per provare l’app**: **Carica dati di esempio** crea clienti e appuntamenti inventati.
Gli esempi si aggiornano da soli quando una nuova versione dell’app li cambia (i dati veri restano);
**Aggiorna i dati di esempio** lo fa a mano.
**Cancella tutti i dati** (con doppia conferma) riporta l’app allo stato iniziale.

---

## 4. Come si usa (in breve)

Le schede in basso sono: **Home · Agenda · Clienti · Statistiche · Spese · Altro**.

- **Home** (si apre all’avvio): incassato di oggi rispetto al previsto, prossimo appuntamento (con **Incassa** se è in corso),
  appuntamenti passati **da incassare**, i successivi, incassi di settimana e mese, ultimi 7 giorni, compleanni e clienti da ricontattare.
- **Nuovo appuntamento**: in *Agenda* tocca uno spazio libero (oppure **+** in alto).
  Scrivi il nome del cliente: se non esiste tocca **Nuovo cliente «…»** e aggiungi il telefono. Tocca i servizi
  (durata e prezzo si calcolano da soli e si possono modificare) → **Aggiungi**.
  Se l’orario si sovrappone a un altro o è fuori orario compare un avviso, ma puoi salvare comunque.
- **Clienti doppi**: non si possono avere due clienti con stesso nome, cognome e telefono (contano anche maiuscole, accenti e
  modi diversi di scrivere il numero, es. `+39 333…` = `333…`). L’app avvisa e propone di aprire o usare il cliente già presente.
  Stesso nome con telefono diverso è permesso.
- **Nuovo cliente abituale**: nel modulo del nuovo cliente attiva **Appuntamenti ricorrenti** e scegli ogni quante settimane:
  dopo il salvataggio si apre il primo appuntamento con *Ripeti* già impostato.
- **Appuntamenti ricorrenti** (clienti abituali): nel nuovo appuntamento scegli **Ripeti** (ogni 1–8 settimane) e **Quante volte**
  (4, 6, 8, 12 oppure **∞ Sempre**: continua finché non lo togli; l’app tiene sempre pronti i prossimi 6 mesi e li allunga da sola).
  La stella ★ indica l’intervallo con cui il cliente viene di solito. Avvisa se una data si sovrappone o cade in un giorno di chiusura.
- **Modificare una ricorrenza**: da *Clienti → Ricorrenti*, dalla scheda del cliente (*Cliente abituale*) o dal dettaglio di un appuntamento
  (**Modifica ricorrenza**) puoi cambiare intervallo, giorno e ora, quante volte, servizi, durata e importo di **tutti i prossimi** appuntamenti,
  oppure **Terminare la ricorrenza**. Per spostare un solo appuntamento usa *Modifica o sposta solo questo*.
- **Annullare o eliminare**: scorri a sinistra una riga (o un blocco nella vista Giorno) oppure usa i tasti nel dettaglio.
  Per le serie scegli **Solo questo** o **Questo e i successivi** (che ferma la serie). «Non si è presentato» si segna come **Annullato**.
- **Da incassare (Home)**: gli appuntamenti passati non ancora completati restano lì finché non li incassi o li annulli.
  **Incassa tutto** li completa in un colpo al prezzo di listino, in contanti, senza mancia (con conferma e Annulla).
- **Incassare**: tocca l’appuntamento → **Segna come completato** → controlla l’importo (sconto/extra),
  mancia e metodo di pagamento (facoltativi) → **Incassa**. Solo gli appuntamenti completati contano negli incassi.
- **Promemoria**: dal dettaglio dell’appuntamento, **Promemoria** apre WhatsApp con il messaggio pronto
  (il testo si cambia in *Impostazioni*); c’è anche **SMS**.
- **Calendario di iPhone**: nel nuovo appuntamento l’opzione **Aggiungi al Calendario** è già attiva: dopo il salvataggio iPhone
  mostra l’evento (o tutta la serie ricorrente) e basta toccare **Aggiungi** / **Aggiungi tutti**, con avviso 30 minuti prima.
  Le serie «Sempre» entrano nel Calendario come un unico evento che si ripete senza fine.
  Si può spegnere per il singolo appuntamento. Dal dettaglio, il tasto **Aggiungi al Calendario** lo riaggiunge in qualsiasi momento.
- **Chiudere i fogli**: oltre a *Chiudi*, puoi trascinarli verso il basso. Nei moduli con dati l’app chiede prima conferma.
- **Annullare un’azione**: dopo eliminazioni, incassi e annullamenti compare un avviso in basso con **Annulla**.
- **Scorri a sinistra** sulle righe (settimana, clienti, listino, spese) per le azioni rapide.
- **Clienti → Da ricontattare**: chi non viene da più di X settimane (soglia in *Impostazioni*), con tasto WhatsApp.
- **Statistiche**: scegli Oggi/Settimana/Mese/Anno/Personalizzato; ogni numero è confrontato con il periodo precedente.
  **Tocca un riquadro** (Incasso, Completati, Mance, Spese, Utile…) o un servizio per vedere l’elenco che lo compone.

---

## 5. Aggiornare l’app

1. Chi sviluppa modifica il codice sul ramo `main` di GitHub: il workflow ricostruisce e ripubblica l’app da solo (1–2 minuti).
2. Sul telefono, quando apri l’app (con internet) lei controlla se online c’è una versione nuova; se resta aperta, ricontrolla ogni ora.
3. La nuova versione si scarica in silenzio e compare il banner **“Nuova versione disponibile”** con **Aggiorna** e **Dopo**.
4. **Aggiorna** ricarica l’app con la versione nuova. **Dopo** la lascia com’è: l’aggiornamento verrà riproposto alla prossima apertura.

I dati (clienti, appuntamenti, spese) **non vengono toccati** dall’aggiornamento: se cambia il formato dei dati l’app lo converte da sola.
Senza internet continui a usare la versione che hai; l’aggiornamento arriverà la prima volta che sei online.

---

## 6. Per chi sviluppa

Requisiti: Node.js 22.12 o superiore.

```bash
npm install
```

```bash
npm run dev
```

```bash
npm test
```

```bash
npm run lint
```

```bash
npm run build
```

| Comando | Cosa fa |
|---|---|
| `npm run dev` | server di sviluppo su <http://localhost:5173> |
| `npm test` | test Vitest (eseguiti nel fuso Europe/Rome, ora legale inclusa) |
| `npm run lint` | ESLint |
| `npm run build` | controllo dei tipi + build di produzione in `dist/` |
| `npm run preview` | prova la build (anche offline/service worker) su <http://localhost:4173> |
| `npm run icons` | rigenera le icone in `public/` |

**Stack**: React + TypeScript (strict) + Vite, Dexie (IndexedDB), Recharts, date-fns (locale `it`), vite-plugin-pwa, Vitest.

**Struttura**

```
src/
  db/          schema Dexie (versione + migrazioni), tipi, hook e azioni
  lib/         funzioni pure e testate: statistiche, telefono, .ics, backup, CSV, sovrapposizioni, orari
  components/  UI in stile iOS (pagina con titolo grande, sheet, swipe, toast, conferme…)
  features/    agenda, appuntamenti, clienti, statistiche, altro, configurazione iniziale
```

**Modello dati**: importi sempre in **centesimi interi**; gli appuntamenti copiano nome/prezzo/durata dei servizi
così lo storico non cambia se cambia il listino; indici Dexie su `start`, `clientId` e `[clientId+start]`.
Per cambiare lo schema: aggiungi `db.version(n)` in `src/db/db.ts`, incrementa `SCHEMA_VERSION`
e aggiungi il passo corrispondente in `migrateBackup` (`src/lib/backup.ts`).

**Percorso su GitHub Pages**: il workflow imposta `BASE_PATH=/<nome-repo>/`, usato da Vite (`base`),
dal manifest (`start_url`, `scope`) e dal service worker. Il routing usa l’hash (`#/agenda`), quindi non serve un 404.html.

---

## 7. Scelte fatte e limiti noti

**Scelte (default dove il progetto non specificava):**

- *Incasso* = importo dei servizi completati; le *mance* sono separate; **Utile = incassi + mance − spese**.
- *Nuovi clienti* = clienti creati nel periodo.
- *Da ricontattare* = clienti con almeno una visita, ultima visita oltre la soglia e nessun appuntamento futuro.
- La *vista Settimana* è un elenco per giorno (più leggibile su iPhone di una griglia a 7 colonne);
  la striscia dei giorni porta alla vista Giorno.
- Orari predefiniti: lun–ven 9:00–13:00 e 15:00–19:30, sabato 9:00–18:00, domenica chiuso (modificabili nella configurazione).
- Eliminare un cliente elimina anche i suoi appuntamenti (con conferma e “Annulla”).
- I numeri senza prefisso ricevono +39.

**Limiti noti:**

- **Nessuna sincronizzazione automatica**: i dati sono su un solo telefono; il backup va fatto a mano.
- **Nessun accesso diretto al Calendario Apple**: l’app genera un file `.ics` che iOS propone di importare;
  le modifiche successive all’appuntamento non si aggiornano nel Calendario.
- **Nessuna notifica**: i promemoria si inviano a mano via WhatsApp/SMS.
- Se l’iPhone è quasi pieno, iOS potrebbe cancellare i dati dei siti poco usati: l’app chiede la
  “memoria persistente” e, installata sulla Home, è protetta meglio — ma il backup resta indispensabile.
- WhatsApp deve essere installato per il promemoria (altrimenti si apre la pagina web di WhatsApp).
