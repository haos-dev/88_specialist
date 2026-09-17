# PT Manager

Gestionale per personal trainer: clienti, libreria esercizi, schede di allenamento ed
esportazione in PDF. Webapp installabile come PWA.

## Partire in trenta secondi

```bash
npm install
npm run dev
```

Si apre su <http://localhost:5173> con **dati di esempio in memoria**: nessun backend, nessuna
chiave, nessuna configurazione. Entra con una qualsiasi email e una password di almeno quattro
caratteri.

## Comandi

| | |
|---|---|
| `npm run dev` | server di sviluppo |
| `npm run build` | build di produzione in `dist/` (con manifest e service worker) |
| `npm run preview` | serve il build, per provare la PWA davvero |
| `npm test` | test (logica pura, nessun database richiesto) |
| `npm run typecheck` | controllo dei tipi |
| `npm run lint` | ESLint |
| `npm run seed:exercises` | popola la libreria esercizi — richiede Supabase, vedi STATO.md §9.5 |

## Collegare Supabase

L'app è scritta per Supabase ma non è ancora collegata a un progetto. La procedura completa —
progetto, chiavi, migrazioni, account, Storage, seed, deploy — sta in **[STATO.md §9](STATO.md)**.

In breve: `cp .env.example .env`, compila URL e anon key, metti `VITE_USE_FIXTURES=false`,
applica le quattro migrazioni in `supabase/migrations/`.

## Come è fatto

- **`src/data/` è l'unico confine verso il backend.** Espone un contratto (`data/types.ts`) che
  hanno due implementazioni: `data/supabase/` e `data/fixtures/`. Pagine e hook importano da
  `@/data` e non sanno quale delle due stanno usando. A wiring finito, `fixtures/` si cancella.
- **`src/features/<dominio>/`** tiene insieme hook di query, form e logica di dominio. Le parti
  pure — scadenze, rinnovo, riordino — stanno in moduli senza React, ed è quello che i test
  coprono.
- **`src/components/ui/`** è la libreria di primitive. In particolare `Stato` copre caricamento,
  vuoto ed errore in un posto solo, perché nove schermate non ne inventino nove versioni.
- **`src/index.css`** contiene tutto il sistema visivo: token di colore, scala tipografica,
  utility, e il foglio di stile di stampa.

Documenti: **`PRD.md`** per cosa costruire (§9 raccoglie le correzioni emerse dall'audit),
**`STATO.md`** per dove siamo e cosa manca.
