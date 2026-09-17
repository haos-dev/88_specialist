# STATO.md – Stato attuale del progetto PT Manager (Webapp/PWA)

> Questo file è la **memoria viva** del progetto: va aggiornato alla fine di ogni fase,
> aggiungendo una voce in fondo a "Log fasi completate" e tenendo allineate le sezioni 1–7.
> Va incollato in chat ogni volta che serve aiuto o debug. Riferimento: `PRD.md` — §1–8 per cosa
> costruire, **§9 per le correzioni decise durante l'audit** (contraddizioni dello schema, buchi
> di comportamento, scelte tecniche).

**Stato generale: l'app c'è e gira, ma non è ancora collegata a Supabase.**

Tutta l'interfaccia è costruita e funzionante sui dati di esempio: `npm install && npm run dev`
apre un'app cliccabile in ogni sua schermata, senza bisogno di alcun backend. Il codice che parla
con Supabase è scritto per intero — query, mutation, riordino batch, rinnovo — ma non è mai stato
eseguito contro un database vero, perché il progetto Supabase non esiste ancora.

**Quello che manca è il wiring: vedi §9 in fondo.**

---

## 1. Stack e architettura

| | |
|---|---|
| Frontend | React 19 + Vite 7, **TypeScript** |
| Stili | Tailwind v4, token in `src/index.css` (`@theme`) |
| Routing | `react-router-dom` |
| Stato server | TanStack Query |
| Form | `react-hook-form` + `zod` |
| Drag & drop | `@dnd-kit` (riordino anche da tastiera) |
| Date | `date-fns`, locale `it` |
| PWA | `vite-plugin-pwa`, manifest + service worker, **solo app shell in cache** |
| Backend | Supabase (Postgres + Auth + Storage) — **non ancora creato** |
| Test | Vitest, solo logica pura — **nessun test contro database** |
| Deploy | hosting statico, `vercel.json` già scritto — **non ancora collegato** |

Niente Electron, niente SQLite, niente sync via git, niente protocollo `media://`: tutti problemi
della v2, non applicabili qui.

**Scelta chiave: TypeScript** invece del JavaScript previsto in PRD §6.2. Con un'app che parla
direttamente a PostgREST, un nome di colonna sbagliato non dà nessun errore fino al runtime: i
tipi in `src/types/database.ts` lo trasformano in un errore di compilazione. Vanno tenuti
allineati alle migrazioni (o rigenerati, vedi §9).

---

## 2. Mappa dei file

```
PRD.md  STATO.md            documenti (alla radice, non in docs/)
index.html  vite.config.ts  tsconfig*.json  eslint.config.js  vercel.json
.env.example                → copiare in .env

public/
  favicon.svg  robots.txt
  icons/                    pwa-192, pwa-512, maskable-512, apple-touch-icon

src/
  main.tsx                  provider: Query → Auth → Toast → Router
  App.tsx                   rotte, tutte le pagine in lazy import
  index.css                 TOKEN E SISTEMA VISIVO + tutto il CSS di stampa

  lib/
    supabaseClient.ts       client creato al primo uso, non all'import
    queryClient.ts          configurazione TanStack + chiavi di cache
    dates.ts                formattazione it-IT + aritmetica date LOCALI
    filename.ts             nome file valido per "Salva come PDF"
    cn.ts

  types/
    database.ts             forma delle tabelle Postgres (rigenerabile)
    domain.ts               tipi di dominio e view model

  data/                     ── L'UNICO CONFINE VERSO IL BACKEND ──
    index.ts                sceglie fixtures o Supabase, esporta `dati`
    types.ts                il contratto che entrambi rispettano
    errors.ts               traduzione errori Postgres → italiano
    supabase/               auth.ts clienti.ts esercizi.ts schede.ts impostazioni.ts
    fixtures/               dati.ts + index.ts (cancellabili in un commit)

  features/
    clients/                useClients.ts  ClientForm.tsx
    exercises/              useExercises.ts  ExerciseForm.tsx  ExercisePicker.tsx
    plans/                  usePlans.ts  PlanForm.tsx  RenewDialog.tsx  PlanHeading.tsx
                            DayCard.tsx  ExerciseRow.tsx  DragHandle.tsx
                            planExpiry.ts  renewPlan.ts  reorder.ts   ← logica pura, testata
    settings/               useSettings.ts
    pdf/                    printSheet.ts

  components/
    layout/                 AppLayout  Sidebar  PageHeader  OfflineBanner
    auth/                   AuthProvider  ProtectedRoute
    ui/                     Button  buttonStyles  Field(+Input/Select/Textarea)
                            Table  Badge  Dialog(+ConfirmDialog)  SearchInput
                            Stato(caricamento/vuoto/errore)  Toast

  pages/
    Login  Dashboard  Clients  ClientDetail  Exercises
    WorkoutBuilder  PrintPlan  Settings  NotFound

supabase/
  migrations/               0001_schema  0002_rls  0003_triggers_indexes  0004_functions
  seed/seed-exercises.mjs   script locale, service_role key

tests/                      planExpiry  renewPlan  reorder  dates  filename
```

**La regola che tiene su tutto**: nessuna pagina e nessun hook importa da `data/supabase/` o da
`data/fixtures/`. Importano da `@/data`, e basta.

---

## 3. Schema database

Sei tabelle: `clients`, `exercises`, `workout_plans`, `workout_days`, `workout_day_exercises`,
`trainer_settings`. Tutte con RLS attiva; tutte filtrate per `owner_id` tranne `exercises`, che è
la libreria condivisa e ha una policy "tutto agli autenticati, niente agli anonimi".

**Fonte di verità: `supabase/migrations/`.** PRD §7 è stato aggiornato per corrispondervi.
Nessuna migrazione è stata ancora applicata: non esiste un database.

Le migrazioni contengono anche tre funzioni Postgres chiamate dall'app via `rpc()`:

| Funzione | Perché esiste |
|---|---|
| `rinnova_scheda(plan_id, titolo, inizio, fine)` | Copia scheda + giorni + esercizi in **una** transazione. Dal client sarebbero 3+ round-trip: un errore a metà lascerebbe una scheda senza esercizi. |
| `riordina_giorni(plan_id, ids[], posizioni[])` | Un solo UPDATE dopo un drag&drop, invece di N. |
| `riordina_esercizi(day_id, ids[], posizioni[])` | Idem, e il vincolo su `day_id` rende impossibile spostare un esercizio in un altro giorno (PRD §3.3). |

Tutte `security invoker`: le policy RLS continuano ad applicarsi.

---

## 4. Accesso ai dati

Ogni funzione esiste in due versioni con la stessa firma — `data/supabase/` e `data/fixtures/` —
e rispetta gli stessi vincoli, inclusi "si elimina solo ciò che è archiviato" e il riordino
batch. Quello che si vede in modalità fixtures è quello che si otterrà una volta collegato il
backend.

| Dominio | Operazioni | File |
|---|---|---|
| auth | `sessioneCorrente` `accedi` `esci` `osservaSessione` | `data/supabase/auth.ts` |
| clienti | `elenco` `dettaglio` `crea` `aggiorna` `impostaAttivo` `elimina` | `data/supabase/clienti.ts` |
| esercizi | `elenco`(paginato) `dettaglio` `crea` `aggiorna` `impostaArchiviato` `utilizzi` `elimina` `gruppiMuscolari` | `data/supabase/esercizi.ts` |
| schede | `elencoPerCliente` `inScadenza` `dettaglio` `crea` `aggiorna` `impostaStato` `elimina` `rinnova` | `data/supabase/schede.ts` |
| schede → giorni | `aggiungiGiorno` `rinominaGiorno` `eliminaGiorno` `riordinaGiorni` | idem |
| schede → esercizi | `aggiungiEsercizio` `aggiornaEsercizio` `rimuoviEsercizio` `riordinaEsercizi` | idem |
| impostazioni | `leggi` `salva` | `data/supabase/impostazioni.ts` |

Due dettagli di PostgREST che valgono la pena di ricordare, perché sono facili da sbagliare:

- Nell'elenco clienti il filtro `workout_plans.status = 'active'` è su una risorsa annidata
  **senza** `!inner`: restringe le righe contate, non i clienti restituiti. Un cliente senza
  schede attive compare comunque, con conteggio 0.
- Nelle schede in scadenza `clients!inner` è invece deliberato: lì il filtro sul cliente
  archiviato deve *escludere* la scheda, non solo svuotare la relazione.

---

## 5. Cosa funziona già

Con `VITE_USE_FIXTURES=true` (il default), tutto:

- **Accesso** — qualunque email e una password di almeno 4 caratteri. Guardia di rotta, ritorno
  alla pagina che si stava aprendo, avviso su come recuperare la password.
- **Dashboard** — schede da rinnovare, ordinate dalla più scaduta alla più imminente, con badge
  che dice "scaduta da 3 giorni" / "scade tra 5 giorni".
- **Clienti** — elenco con ricerca live e filtro attivi/archiviati/tutti, creazione, modifica,
  archiviazione, riattivazione, eliminazione definitiva (solo se archiviato, con conferma).
- **Dettaglio cliente** — anagrafica, note, elenco delle sue schede con stato e scadenza.
- **Esercizi** — griglia paginata con ricerca e filtro per gruppo muscolare, CRUD completo, e il
  controllo "in uso in N schede" prima di eliminare, che propone l'archiviazione al suo posto.
- **Builder schede** — giorni e esercizi trascinabili (mouse **e** tastiera), serie/ripetizioni/
  recupero modificabili in linea, aggiunta esercizi dalla libreria senza chiudere il dialog,
  rinnova, archivia, elimina.
- **Stampa** — anteprima in una scheda nuova, immagini attese prima di stampare, nome file
  proposto `Scheda - Mario Rossi - Ipertrofia — blocco 1`.
- **Impostazioni** — intestazione, recapiti, soglia di preavviso, con anteprima del logo.
- **Offline** — avviso persistente, e messaggi che dicono cosa non è stato salvato.

Qualità: `npx tsc -b` pulito · `npx eslint .` 0 errori (2 warning `react-refresh`, innocui:
`AuthProvider` e `Toast` esportano un hook accanto al componente) · `npx vitest run` **67 test
verdi** · `npm run build` produce `dist/` con manifest e service worker.

---

## 6. Roadmap

- [x] Fase 1 — Scaffold webapp + schema SQL *(schema scritto, non applicato)*
- [x] Fase 2 — Autenticazione *(codice completo; account da creare)*
- [x] Fase 3 — Clienti (CRUD completo)
- [x] Fase 4 — Esercizi (CRUD completo + script di seed) *(seed scritto, non eseguito)*
- [x] Fase 5 — Builder schede (drag&drop, rinnova, archivia)
- [x] Fase 6 — Reminder scadenze
- [x] Fase 7 — Export PDF (anteprima HTML + stampa nativa)
- [x] Fase 8 — Impostazioni e branding
- [x] Fase 9 — PWA (manifest, service worker, icone)
- [ ] Fase 10 — **Deploy e wiring** → §9

---

## 7. Decisioni tecniche e problemi noti

Le motivazioni complete stanno in **PRD §9**. Qui il promemoria operativo:

- **RLS attiva su tutte le tabelle**, `exercises` inclusa (con policy diversa: condivisa, non
  per-utente). Con RLS spenta l'API PostgREST è leggibile da chiunque abbia la anon key, che è
  nel bundle del browser per costruzione.
- **La anon key è pubblica, la `service_role key` no.** La prima va in `.env` come `VITE_*` e
  finisce nel bundle: è normale. La seconda esiste solo nell'ambiente in cui gira lo script di
  seed. Tutto ciò che inizia per `VITE_` è pubblico.
- **Le date-only si leggono in fuso locale.** `new Date('2026-04-15')` è mezzanotte UTC, cioè le
  02:00 a Roma: confrontandola con "adesso" il badge scadenze cambia stato la sera prima. Usare
  sempre `parseDataISO` da `lib/dates.ts`, mai il costruttore `Date`. C'è un test apposta.
- **Rinnova e Archivia sono azioni indipendenti.** Due schede attive per lo stesso cliente dopo
  un rinnovo senza archiviazione sono il comportamento voluto, non un bug.
- **Hard-delete solo su ciò che è già archiviato**, sia clienti sia schede. Il vincolo è dentro
  la query (`.eq('active', false)`), non solo nella UI: se la riga non è archiviata la delete non
  trova niente.
- **Un esercizio in uso non si elimina**, la FK è `on delete restrict`. La UI conta gli utilizzi
  e propone l'archiviazione. Cancellarlo davvero riscriverebbe le schede passate dei clienti.
- **Drag&drop solo dentro il proprio contenitore.** Un trascinamento che attraversa i confini
  viene ignorato, e la funzione Postgres lo rende impossibile anche a livello di dati.
- **Nessun offline vero per i dati.** Il service worker mette in cache solo l'app shell:
  deliberatamente **nessun** runtime caching delle risposte Supabase, o il trainer vedrebbe dati
  vecchi credendoli aggiornati.
- **La libreria esercizi va paginata lato server.** Il dataset è di ~1300 righe con una gif
  ciascuna: scaricarlo tutto è incompatibile con la reattività chiesta dal PRD §5.

### Il sistema visivo, in breve

Tutto sta in `src/index.css`. L'idea: il vero output dell'app è un foglio A4 letto a un metro di
distanza in palestra, quindi lo schermo prende in prestito la logica del documento — **righe e
filetti, non card** — e app e stampa condividono lo stesso sistema tipografico.

- **Colore**: `paper #F6F7F5` · `surface #FFF` · `ink #14201D` · `muted #63736E` · `line #DCE2DE`
  · `accent #0E5C52` · `teal #2E9C8A`, più `scaduta #B3261E` e `scadenza #A96A05` come soli
  segnali funzionali.
- **Tipografia**: una sola famiglia, **Archivo** variabile. È l'asse di larghezza a fare il lavoro
  espressivo — i titoli girano allargati (`.display`, `.display-tight`), il testo resta a
  larghezza normale. Cifre sempre tabulari.
- **Forma**: raggio 3px su bottoni e input, **0** sui contenitori — il raggio dice "ci puoi
  interagire". Nessuna ombra, da nessuna parte.
- **Movimento**: solo in risposta a un'azione (trascinare, aprire un dialog). `prefers-reduced-motion`
  rispettato.
- **Stampa**: il blocco `@media print` ridefinisce i *token*, non i singoli bordi — così la
  gerarchia dei filetti regge anche col toner. Un giorno di allenamento non si spezza mai a metà
  pagina.

---

## 8. Log fasi completate

### Fasi 1–9 — Audit del PRD e costruzione dell'app (completate)

- **Audit** di `PRD.md`: nove difetti di schema, dieci comportamenti non specificati, sette
  scelte tecniche lasciate aperte. §7 corretto in loco, motivazioni in §9.
- **Costruito**: scaffold Vite/React/TS/PWA, sistema visivo e libreria di componenti, data layer
  a due implementazioni, nove pagine, quattro migrazioni SQL, script di seed, 67 test.
- **Non fatto di proposito**: creazione del progetto Supabase, applicazione delle migrazioni,
  esecuzione del seed, deploy. Tutto in §9.
- **Da tenere d'occhio**: `src/types/database.ts` è scritto a mano e deve restare allineato alle
  migrazioni. Appena il progetto Supabase esiste, va **rigenerato** (comando in §9) — è quello
  che rende reale la sicurezza di tipo su ogni query.

---

## 9. Da fare da te (wiring)

Tutto ciò che richiede di creare o configurare qualcosa fuori dal codice. In ordine.

### 9.1 Progetto Supabase e chiavi

1. Crea un progetto su [supabase.com](https://supabase.com). Scegli la regione più vicina
   (Frankfurt, per l'Italia).
2. **Project Settings → API**: copia `Project URL` e `anon public`.
3. `cp .env.example .env` e compila:
   ```
   VITE_USE_FIXTURES=false
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
   `.env` è in `.gitignore`. **Non toccare** `.env.example`.

> Finché `VITE_USE_FIXTURES` è `true`, o finché le due variabili sono vuote, l'app resta sui dati
> di esempio. Non si rompe: si limita a non parlare con nessuno.

### 9.2 Applica le migrazioni

Nell'ordine, dalla dashboard (**SQL Editor**, incolla e lancia) oppure con la CLI:

```
supabase/migrations/0001_schema.sql
supabase/migrations/0002_rls.sql
supabase/migrations/0003_triggers_indexes.sql
supabase/migrations/0004_functions.sql
```

Con la CLI: `npx supabase link --project-ref <ref>` e poi `npx supabase db push`.

### 9.3 Chiudi la registrazione e crea l'account

PRD §5 dice "nessuna registrazione self-service", ma un progetto nuovo accetta `signUp` da
chiunque abbia la anon key — cioè da chiunque apra l'app.

1. **Authentication → Sign In / Providers → Email**: disattiva **Allow new users to sign up**.
2. **Authentication → Users → Add user**: crea l'account del trainer con "Auto Confirm User"
   attivo (senza, il login fallisce con "email non confermata").

Il trigger di `0003` gli crea automaticamente la riga in `trainer_settings`.

### 9.4 Storage

**Storage → New bucket**, due bucket **pubblici**:

| Bucket | Contenuto |
|---|---|
| `exercise-media` | immagini e gif degli esercizi (lo crea anche lo script di seed, se manca) |
| `branding` | il logo del trainer |

Pubblici perché finiscono in `<img src>` sul foglio stampato, e gli URL firmati scadrebbero.

### 9.5 Seed della libreria esercizi

1. Scarica un dataset open source (es. `yuhonas/free-exercise-db`) e mettine il contenuto in
   `supabase/seed/data/` — la cartella è già in `.gitignore`. Deve esserci `exercises.json`.
2. Prova a vuoto, che non scrive niente:
   ```bash
   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node supabase/seed/seed-exercises.mjs --dry-run
   ```
3. Poi sul serio (`--limit 50` per provare su poche righe prima).

La `service_role key` bypassa completamente la RLS: passala sulla riga di comando, non scriverla
in un file, e non metterla **mai** in una variabile `VITE_*`.

Lo script è rieseguibile: l'indice unico su `lower(name)` impedisce i doppioni.

### 9.6 Rigenera i tipi

Appena lo schema è applicato:

```bash
npx supabase gen types typescript --project-id <ref> > src/types/database.ts
```

Poi `npx tsc -b`: se compila, ogni query dell'app corrisponde davvero alle colonne che esistono.
Se non compila, TypeScript ti sta indicando esattamente dove il codice e il database divergono —
è per questo che il progetto è in TypeScript.

### 9.7 Test contro un database vero (opzionale)

I 67 test attuali sono di sola logica e girano ovunque. Per testare le query servono Docker
Desktop e `npx supabase start` (istanza locale), **mai** il progetto di produzione.

### 9.8 Deploy

1. Collega il repository a Vercel. `vercel.json` è già scritto: comando di build, cartella di
   output, e il rewrite SPA senza cui `/schede/<id>/stampa` darebbe 404 se aperta direttamente.
2. **Environment Variables** su Vercel: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
   `VITE_USE_FIXTURES=false`.
3. **Authentication → URL Configuration** su Supabase: aggiungi il dominio Vercel a Site URL e
   Redirect URLs.

### 9.9 Pulizia finale

Quando l'app gira su dati veri, `src/data/fixtures/` non serve più: cancella la cartella e il
ramo `usaFixtures` in `src/data/index.ts`. Un commit, e non resta traccia dei dati di esempio.
