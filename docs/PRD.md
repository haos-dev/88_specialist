# PRD – Gestionale per Personal Trainer (v3 — Webapp/PWA)

> **v3 sostituisce integralmente v2.** Cambio di architettura: da app desktop Electron con
> SQLite locale e sync via git, a **webapp (PWA)** con backend condiviso su **Supabase**
> (Postgres + Auth + Storage). Il pivot nasce da un requisito concreto: l'app deve poter essere
> deployata come webapp, idealmente prima ancora di una eventuale versione desktop. Con un
> backend condiviso, il problema della sincronizzazione multi-PC **smette di esistere** (un solo
> database, non due copie locali da riconciliare) — gran parte della complessità discussa in v2
> (§3.7 Sync, migrazione UUID per conflitti, git/token) non serve più.
>
> Il lavoro Electron già fatto (Fasi 0-2: scaffold, Clienti, Esercizi) non è sprecato nelle
> **decisioni di prodotto** che contiene (flussi, validazioni, copy), ma la sua **base tecnica
> viene accantonata**: si riparte da uno scaffold React/PWA nuovo. Electron resta un'opzione
> esplicita per il futuro (stesso codice React, wrapper attorno alla webapp), non nel piano
> attuale.

## 1. Obiettivo

Applicazione web (PWA, installabile, nessuna installazione tradizionale richiesta) per un
personal trainer, per:

1. Gestire l'anagrafica dei propri **clienti**.
2. Costruire e organizzare una **libreria di esercizi** riutilizzabile (immagini/gif
   dimostrative), popolata da un dataset esterno open source.
3. Creare **schede di allenamento** personalizzate per cliente.
4. **Esportare le schede in PDF**, con branding del trainer.
5. Ricevere **reminder in-app** per le schede in scadenza.
6. Lavorare da **qualunque dispositivo con un browser**, dati sempre allineati perché vivono in
   un unico backend condiviso — nessuna sincronizzazione da gestire.

Vincoli chiave:
- **Un solo trainer, un solo account**: autenticazione minima (email+password), nessun sistema
  multi-tenant nell'MVP (ma schema dati progettato in modo da non escluderlo in futuro, vedi §7).
- **Richiede connessione internet** per leggere/scrivere dati (confermato accettabile: il
  trainer lavora sempre da postazioni con connessione). L'app installata come PWA resta
  raggiungibile/apribile anche offline, ma le operazioni sui dati richiedono rete, con un avviso
  chiaro se assente.
- **Backend gestito (Supabase)**, non costruito da zero: Postgres + Auth + Storage inclusi,
  riduce il codice custom da scrivere e mantenere.
- Nessuna installazione richiesta al trainer: si apre un URL, opzionalmente la "installa" come
  PWA (icona su desktop/home screen, si apre in una finestra propria).

## 2. Utente target

- Un singolo personal trainer, utente non tecnico, che vuole accedere ai propri dati da
  qualunque computer (o eventualmente tablet/telefono) senza pensare a sincronizzazioni.
- Accede con email+password fornite dallo sviluppatore in fase di setup iniziale.

## 3. Funzionalità principali

*(Le funzionalità di prodotto restano concettualmente quelle già definite in v2 — cambia come
sono costruite sotto, non cosa fanno per il trainer.)*

### 3.1 Gestione Clienti
- Pagina "Clienti": elenco con ricerca live, filtro attivi/archiviati.
- Pagina dedicata per cliente: anagrafica, note, elenco di tutti i piani di allenamento di
  quel cliente.
- CRUD completo: creazione, modifica, archiviazione/riattivazione, eliminazione definitiva
  (solo su clienti già archiviati, con conferma).

### 3.2 Libreria Esercizi
- Elenco con ricerca e filtro per gruppo muscolare; ogni esercizio ha nome, gruppo muscolare,
  descrizione, immagine/gif.
- CRUD completo, con avviso se l'esercizio è in uso in una o più schede prima di eliminarlo.
- **Popolamento iniziale**: a differenza della versione desktop (dove ogni PC importava
  autonomamente da una cartella locale), con un backend condiviso il popolamento avviene **una
  sola volta, fuori dall'app**: uno script Node eseguito localmente dallo sviluppatore (mai nel
  browser, mai nell'app deployata) legge `data/exercises.json` dal dataset scaricato da GitHub,
  carica ogni immagine/gif su un bucket di Supabase Storage e inserisce una riga nella tabella
  `exercises` con l'URL pubblico del media. Usa la `service_role key` di Supabase (permessi di
  admin, presente solo in questo script locale — mai nel codice dell'app, mai committata, mai
  esposta al browser). La logica di deduplica per nome e la gestione dell'attribuzione (© Gym
  visual) restano identiche a quelle già scritte per la versione Electron, solo retargettate da
  filesystem+SQLite a Storage+Postgres. Da quel momento la webapp legge la libreria con una
  query Supabase normale, come qualunque altra tabella — nessun fetch da GitHub, nessun
  protocollo custom per i media, un `<img src={media_url}>` con URL pubblico è sufficiente.
- La libreria è condivisa (un solo trainer, quindi non c'è più distinzione "locale per
  dispositivo" — è semplicemente parte dello stesso database).

### 3.3 Creazione e Gestione Schede di Allenamento
- Scheda collegata a un cliente: titolo, periodo di validità, note, stato (`active`/
  `archived`).
- Giorni di allenamento riordinabili via drag&drop; esercizi riordinabili via drag&drop
  **all'interno del proprio giorno** (spostare un esercizio tra giorni diversi non è richiesto
  nell'MVP).
- **Rinnova scheda**: duplica con nuove date. **Archivia scheda**: azione distinta e
  indipendente da Rinnova (il trainer può rinnovare senza archiviare l'originale, se lo desidera
  restano entrambe visibili/attive).
- Eliminazione definitiva permessa solo su schede già archiviate, con conferma (stessa
  convenzione già usata per i Clienti).

### 3.4 Esportazione PDF
- Genera un PDF con branding del trainer (logo, colori), stesso contenuto già definito in v2
  (intestazione trainer+cliente, giorni con tabella esercizi, immagine dove disponibile).
- **Meccanismo scelto**: cliccando "Esporta", si apre una nuova scheda del browser con
  un'**anteprima HTML** della scheda (lo stesso template già progettato, renderizzato come
  componente React con i dati reali). Il trainer la rivede e, se soddisfatto, la stampa/salva
  come PDF con la funzione nativa di stampa del browser (`window.print()` + foglio di stile
  `@media print` che nasconde eventuali elementi di navigazione). Preferito rispetto a una
  libreria HTML→PDF client-side (es. `html2pdf.js`) perché usa il motore di stampa reale del
  browser invece di un'approssimazione via canvas — più fedele, zero dipendenze aggiuntive, e
  offre di serie un passaggio di anteprima/conferma che prima non c'era.
- Prima di invocare la stampa, l'app imposta `document.title` con un nome descrittivo (es.
  "Scheda - Mario Rossi - Ipertrofia Gennaio") così il browser lo suggerisce come nome file
  predefinito in "Salva come PDF".
- Gestione robusta dei casi limite: scheda senza giorni, esercizio senza media, note lunghe,
  schede con molti giorni (interruzioni di pagina corrette via CSS `@media print`).

### 3.5 Impostazioni Trainer
- Nome attività, logo, colori, contatti — usati nel PDF.
- Soglia reminder (giorni di preavviso, default 7).
- Nessuna configurazione di sync da gestire (non esiste più quel concetto).

### 3.6 Reminder Scadenze Schede
- Badge in Sidebar + widget in Dashboard per schede in scadenza/scadute (solo schede `active`,
  esclusi i clienti archiviati).
- `end_date < oggi` → scaduta; `oggi ≤ end_date ≤ oggi + soglia` → in scadenza. Schede senza
  `end_date` escluse dal calcolo.
- Nessuna notifica nativa del sistema operativo — solo in-app.

### 3.7 Calendario Appuntamenti
> Implementata in sviluppo senza passare da questo documento — sezione aggiunta a posteriori
> per allinearlo al codice reale (tabella `appointments`, componente
> `AppointmentCalendar.tsx`), non il contrario.

- Widget calendario mensile in Dashboard: crea/elimina appuntamenti (titolo, data, orario,
  durata, cliente opzionale, note), navigazione tra i mesi.
- Indipendente dalle Schede di allenamento: un appuntamento è un impegno puntuale (data+ora),
  non ha una `status` né entra nel reminder di scadenza.
- **Feed iCalendar (.ics) per iscrizione da Apple/Google/Outlook Calendar** ("aggiungi
  calendario da URL"): un URL con un token segreto rigenerabile dalle Impostazioni, servito da
  una Supabase Edge Function (`supabase/functions/calendar-feed`) che genera il `.ics` al volo.
  - **A senso unico**: quello che il trainer inserisce nell'app compare nel calendario del
    telefono. Il contrario no. Un vero sync bidirezionale richiederebbe CalDAV — non nel piano
    attuale.
  - L'aggiornamento non è immediato: dipende dall'intervallo di polling che l'app di calendario
    (Apple/Google/Outlook) decide per conto suo, non controllabile da qui.
  - Il token, non la sessione Supabase, è l'autenticazione: le app di calendario non sanno fare
    login interattivo per una sottoscrizione. Va quindi trattato come un segreto rigenerabile,
    non come l'anon key (pubblica per definizione).

## 4. Funzionalità future (fuori scope ora)

- Wrapper Electron per una versione desktop installabile (stesso codice React).
- Supporto offline reale per i dati (coda di scritture locali + sync quando torna la rete).
- Multi-trainer / multi-tenant vero (oggi un solo account, schema comunque compatibile con
  un'estensione futura, vedi §7).
- Sync bidirezionale del calendario (CalDAV) — il feed .ics di §3.7 resta a senso unico.
- Notifiche native, statistiche di progresso cliente, invio PDF via email.
- Generazione PDF server-side, se il rendering client-side risultasse insufficiente.

## 5. Requisiti non funzionali

- **Richiede connessione** per leggere/scrivere dati; l'assenza di rete va comunicata in modo
  chiaro (non un errore generico), l'app non deve crashare o bloccarsi.
- **PWA installabile**: manifest, service worker per la cache dell'app shell (l'interfaccia si
  apre anche offline, i dati no), icone, `theme-color` coerente col branding.
- **Backend**: Supabase (Postgres + Auth + Storage), Row Level Security attiva su tutte le
  tabelle fin dal primo giorno (anche con un solo trainer: è la pratica raccomandata da Supabase
  e previene che l'API pubblica esponga dati per un errore di configurazione).
- **Autenticazione**: email+password via Supabase Auth, nessuna registrazione self-service (
  l'account del trainer viene creato dallo sviluppatore).
- **Performance**: interazioni e generazione PDF percepite come istantanee anche con centinaia
  di clienti/esercizi.
- **Deploy**: hosting statico per il build della PWA (es. Vercel/Netlify/Cloudflare Pages),
  variabili d'ambiente per le chiavi Supabase gestite in modo sicuro (mai in chiaro nel
  repository del codice).

## 6. Struttura tecnica del progetto

### 6.1 Stack

- **Frontend**: React + Vite, PWA via `vite-plugin-pwa` (manifest + service worker).
- **Backend**: Supabase — Postgres (dati), Supabase Auth (login trainer), Supabase Storage
  (immagini/gif esercizi, logo).
- **Client Supabase**: `@supabase/supabase-js`, chiamato direttamente dal frontend (niente
  backend custom da scrivere per le operazioni CRUD standard — le policy RLS di Postgres fanno
  da livello di autorizzazione).
- **Test**: Vitest contro un'istanza Supabase locale (Supabase CLI, Postgres in Docker), non
  contro il progetto Supabase di produzione. Niente più `ELECTRON_RUN_AS_NODE` — non serve più,
  non c'è alcun modulo nativo coinvolto.
- **Deploy**: hosting statico (Vercel o equivalente) collegato al progetto Supabase di
  produzione.

### 6.2 Struttura cartelle (indicativa)

```
src/
  main.jsx / App.jsx        entry point, routing
  lib/
    supabaseClient.js       inizializzazione client Supabase
    auth.js                 helper login/logout/sessione
  pages/
    Login.jsx
    Dashboard.jsx            include il widget scadenze
    Clients.jsx
    ClientDetail.jsx
    Exercises.jsx
    WorkoutBuilder.jsx
    Settings.jsx
  components/
    layout/Sidebar.jsx       navigazione + badge reminder
  features/
    clients/                 query/mutation Supabase + logica dominio clienti
    exercises/
    plans/
    pdf/                      generazione PDF (vedi §3.4)
public/
  manifest.json, icone PWA
supabase/
  migrations/                 SQL delle migrazioni schema, versionate
  seed/                        script di seed libreria esercizi (una tantum)
tests/
  *.test.js                   test contro Supabase locale (CLI)
docs/
  PRD.md, PLAN.md, PROJECT_STATE.md, PROMPT_TEMPLATE.md, prompts/
```

### 6.3 Convenzioni

- **RLS ovunque**: ogni tabella ha una policy che limita le righe all'utente autenticato
  (anche con un solo trainer). Le query dal frontend passano sempre per queste policy, mai per
  una `service_role key` lato client.
- **Migrazioni versionate**: le modifiche allo schema vivono in `supabase/migrations/` (SQL),
  applicate con la CLI di Supabase — a differenza della v2, qui **serve davvero** disciplina di
  migrazione fin da subito, perché il database non è più locale/ricreabile a piacere: è
  condiviso e può contenere dati reali molto presto.
- **Interfaccia in italiano**, stile Tailwind coerente con i token già definiti (`ink`, `paper`,
  `surface`, `muted`, `line`, `accent`, `teal`).
- **Media**: immagini/gif e logo su Supabase Storage, referenziati per URL pubblico — non serve
  più nessun protocollo custom (`media://`) né le attenzioni a `file://`/CSP che avevano
  richiesto due fix in v2: un URL pubblico funziona direttamente in un `<img src>`.

## 7. Schema database (Postgres/Supabase)

> **Aggiornato dopo l'audit.** La fonte di verità è ora `supabase/migrations/` (0001 schema,
> 0002 RLS, 0003 trigger e indici, 0004 funzioni). Lo schema qui sotto è quello effettivamente
> applicato; le correzioni rispetto alla prima stesura sono marcate `[Ax]` e motivate in §9.

```sql
-- auth.users di Supabase gestisce già l'account del trainer; le tabelle sotto
-- referenziano auth.uid() nelle policy RLS anche se oggi c'è un solo utente.

clients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  first_name text not null, last_name text not null,
  email text, phone text, birth_date date, notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()   -- [A4] aggiornato da trigger
)

exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null, muscle_group text, description text,
  media_url text, media_type text, media_attribution text,
  archived boolean not null default false,        -- [A2]
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()   -- [A8]
)
-- nessun owner_id: la libreria è condivisa. Ha comunque RLS attiva, con una
-- policy che concede tutto agli autenticati e nulla agli anonimi [A1].
-- unique index su lower(name) [A5]: è quello che rende il seed rieseguibile.

workout_plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  client_id uuid not null references clients(id) on delete cascade,
  title text not null, start_date date, end_date date, notes text,
  status text not null default 'active'
    check (status in ('active','archived')),      -- [A3]
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),  -- [A4]
  check (start_date is null or end_date is null or start_date <= end_date)
)

workout_days (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references workout_plans(id) on delete cascade,
  day_order integer not null default 0, day_name text not null default 'Giorno'
)

workout_day_exercises (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references workout_days(id) on delete cascade,
  exercise_id uuid not null references exercises(id) on delete restrict,  -- [A2]
  order_index integer not null default 0,
  sets text, reps text, rest_seconds integer, tempo text, notes text
)

trainer_settings (
  owner_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  business_name text, logo_url text, primary_color text, secondary_color text,
  address text, phone text, email text,
  reminder_days_before integer default 7,
  calendar_feed_token text unique default encode(gen_random_bytes(24), 'hex')  -- §3.7
)
-- [A7] la riga viene creata da un trigger su auth.users: senza, ogni lettura
-- delle impostazioni doveva gestire "non esiste ancora".

appointments (                       -- §3.7, aggiunta a posteriori (0005/0006)
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  client_id uuid references clients(id) on delete set null,
  title text not null,
  appointment_date date not null, start_time time not null,
  duration_minutes integer not null default 60,
  notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
)
```

Nota: `owner_id` è presente fin da ora (anche con un solo trainer) proprio per non dover
ritoccare lo schema se in futuro si aprisse a più trainer — le policy RLS filtrano già per
`owner_id = auth.uid()`.

Indici previsti [A6]: `clients(owner_id, last_name, first_name)`, `workout_plans(client_id)`,
un indice parziale `workout_plans(owner_id, end_date) where status='active'` per il calcolo
scadenze, `workout_days(plan_id, day_order)`, `workout_day_exercises(day_id, order_index)`,
`workout_day_exercises(exercise_id)` per il controllo "in uso", `exercises(muscle_group)`.

## 8. Flussi principali

1. **Login**: il trainer apre l'URL, effettua login con le credenziali fornite dallo
   sviluppatore.
2. **Lavoro quotidiano**: Dashboard con eventuali schede in scadenza; gestione clienti/schede
   con salvataggio diretto sul backend (nessun concetto di sync o "stato locale non ancora
   inviato").
3. **Multi-dispositivo**: aprendo l'app da un altro computer/browser, dopo il login i dati sono
   identici, perché è lo stesso database — nessuna azione richiesta.
4. **Scheda in scadenza**: il trainer la rinnova (duplica con nuove date) o la archivia.
5. **Esportazione PDF**: dalla scheda, genera il PDF con branding del trainer (meccanismo
   esatto da definire in fase di implementazione, vedi §3.4).

---

## 9. Correzioni post-audit

Sezione aggiunta dopo l'audit del PRD, prima di scrivere il codice. Registra le contraddizioni
trovate, i buchi riempiti e le scelte tecniche che il PRD lasciava aperte. Le sezioni 1–8 sopra
restano la descrizione del prodotto; questa è il verbale di come è stata resa costruibile.

### 9.1 Difetti dello schema (`[Ax]`, corretti in §7 e nelle migrazioni)

| # | Cos'era | Perché era un problema | Cosa si è fatto |
|---|---|---|---|
| A1 | §5 e §6.3 dicono "RLS su tutte le tabelle"; §7 dà a `exercises` nessun `owner_id`. | Contraddizione apparente fra "filtrata per utente" e "libreria condivisa". Lasciata così, `exercises` sarebbe finita senza RLS del tutto — e con la anon key nel bundle, leggibile da chiunque. | Si separa "RLS attiva" da "filtrata per proprietario": `exercises` ha RLS attiva con una policy che concede tutto agli autenticati e nulla agli anonimi. |
| A2 | `workout_day_exercises.exercise_id` non dichiara una regola di cancellazione. | Postgres applica `NO ACTION`: la delete promessa in §3.2 ("avviso se in uso, poi elimina") sarebbe fallita con un errore di vincolo. E cancellare davvero un esercizio in uso riscriverebbe le schede passate dei clienti. | `on delete restrict` esplicito + colonna `archived` su `exercises`. La UI conta gli utilizzi, e se ce ne sono propone l'archiviazione invece dell'eliminazione. |
| A3 | `status text not null default 'active'`, commento `-- 'active' \| 'archived'`. | Il commento non è un vincolo: qualunque stringa sarebbe entrata. | `check (status in ('active','archived'))`. |
| A4 | `updated_at timestamptz not null default now()`. | Il default vale solo all'insert: senza trigger la colonna resta uguale a `created_at` per sempre. | Funzione `set_updated_at()` + trigger su `clients`, `exercises`, `workout_plans`. |
| A5 | §3.2 dice che il seed deduplica per nome. | Niente lo imponeva: due esecuzioni dello script avrebbero creato il doppio delle righe. | `unique index on exercises (lower(name))`. Rende anche il seed rieseguibile. |
| A6 | Nessun indice oltre alle chiavi primarie. | §5 chiede prestazioni "istantanee": l'elenco clienti, il calcolo scadenze e il caricamento di una scheda avrebbero fatto sequential scan. | Sette indici sui percorsi di accesso reali, incluso un indice parziale per le scadenze. |
| A7 | `trainer_settings` è una riga per trainer, che nessuno crea. | Ogni lettura doveva gestire "la riga non c'è", e la soglia reminder sarebbe stata `undefined` al primo accesso — facendo sparire il badge scadenze. | Trigger su `auth.users`, più un fallback difensivo a 7 giorni nel codice dell'app. |
| A8 | `exercises` ha `created_at` ma non `updated_at`. | Incoerente con tutte le altre tabelle. | Aggiunta. |
| A9 | "Archiviato" è `clients.active boolean` ma `workout_plans.status text`. | Due modi di dire la stessa cosa. | **Non corretto**: cambiarlo dopo avrebbe rotto il PRD senza guadagno reale. Il codice lo nasconde dietro un helper per dominio. Annotato perché resti una scelta e non una svista. |

### 9.2 Comportamenti che il PRD dava per scontati (`[Bx]`)

- **B1 — Rinnova.** §3.3 dice "duplica con nuove date" senza dire *quali* date né *cosa* si
  duplica. Deciso: copia profonda (giorni **e** esercizi dentro ai giorni, ordine conservato);
  date proposte in un dialog — si riparte dal giorno dopo la fine precedente conservando la
  durata, o da oggi se quella scheda è già scaduta; nessun suffisso automatico al titolo.
  Implementato come funzione Postgres `rinnova_scheda()`: farlo dal client sarebbero tre
  round-trip non transazionali, e un errore a metà lascerebbe una scheda senza esercizi.
- **B2 — Riordino.** Il drag&drop su `day_order`/`order_index` riscrive le righe fratelle. Deve
  essere **una** scrittura, non N: funzioni `riordina_giorni()` / `riordina_esercizi()` che
  ricevono due array paralleli. L'app manda solo le posizioni davvero cambiate e aggiorna la UI
  in modo ottimistico, con rollback se la scrittura fallisce.
- **B3 — Scala della libreria esercizi.** Il dataset è di ~1300 righe con una gif ciascuna:
  incompatibile con "istantaneo" se scaricato tutto. Ricerca e filtro vanno sul server
  (`ilike` + `muscle_group`), con paginazione e `loading="lazy"` sulle miniature. I clienti
  ("centinaia") restano invece un filtro locale.
- **B4 — Meccanica della stampa.** §3.4 non dice tre cose necessarie: la stampa ha bisogno di una
  rotta propria (`/schede/:id/stampa`) aperta con `window.open`; `window.print()` non aspetta le
  immagini, quindi vanno attese a mano o il PDF esce bucato; `document.title` diventa il nome
  file proposto, quindi va reso valido come nome file (via `\ / : * ? " < > |`) e ripristinato
  dopo.
- **B5 — Registrazione aperta.** §5 dice "nessuna registrazione self-service", ma un progetto
  Supabase nuovo accetta `signUp` dalla anon key. È un'impostazione di dashboard, non codice →
  finita nella checklist di STATO.md.
- **B6 — Password dimenticata.** Con un account solo, creato a mano, il caso non poteva essere un
  vicolo cieco muto: la pagina di accesso dice esplicitamente di contattare chi ha configurato
  l'app.
- **B7 — Guardia di rotta e scadenza sessione.** Non previste. Aggiunte: rotte protette,
  sottoscrizione a `onAuthStateChange`, e ritorno alla pagina che si stava cercando di aprire
  dopo il login.
- **B8 — Offline.** §5 lo dichiara un requisito ma non gli assegna nessuna interfaccia. Aggiunto
  un avviso persistente guidato dagli eventi `online`/`offline`, e messaggi di errore che dicono
  "non è stato salvato, riprova quando torni online" invece di un errore generico.
- **B9 — Stati vuoto / caricamento / errore.** Nessuna convenzione: nove schermate ne avrebbero
  inventate nove. Una primitiva sola, usata ovunque.
- **B10 — Fuso orario delle scadenze.** §3.6 confronta date senza dire in che fuso. In JavaScript
  `new Date('2026-04-15')` è mezzanotte **UTC**, cioè le 02:00 a Roma: confrontandola con "adesso"
  il badge cambia stato la sera prima. Tutte le date-only passano da un parser locale.

### 9.3 Scelte tecniche lasciate aperte dal PRD

| Ambito | Scelta | Perché |
|---|---|---|
| Linguaggio | **TypeScript** (§6.2 diceva `.jsx`) | Con un'app che parla direttamente a PostgREST, un nome di colonna sbagliato è invisibile fino al runtime. I tipi dello schema lo trasformano in un errore di compilazione. |
| Routing | `react-router-dom` | — |
| Stato server | **TanStack Query** | "Istantaneo" (§5) più la freschezza fra pagine (modifichi un cliente, l'intestazione della scheda si aggiorna) è invalidazione di cache. Con `useEffect` a mano non viene. |
| Drag & drop | **`@dnd-kit`** | `react-beautiful-dnd` non è più mantenuto; dnd-kit dà il riordino da tastiera senza scrivere altro codice. |
| Form | `react-hook-form` + `zod` | Uno schema solo fa validazione, messaggi in italiano e normalizzazione stringa-vuota → `NULL`. |
| Date | `date-fns` + locale `it` | — |
| Stili | Tailwind v4, token in `@theme` | I token `ink/paper/surface/muted/line/accent/teal` di §6.3 erano dichiarati "già definiti" ma non esistevano da nessuna parte: sono stati definiti ora. |

### 9.4 Nota sulla continuità con la v2

§6.3 e §3.2 danno per esistente del lavoro della versione Electron (i token Tailwind, il template
PDF, la logica di deduplica del seed). Quel codice **non è presente in questa cartella**: tutto
ciò che vi si riferisce è stato scritto da zero, non portato. Le decisioni di prodotto che il PRD
ne eredita (flussi, validazioni, copy) restano valide e sono state seguite.
