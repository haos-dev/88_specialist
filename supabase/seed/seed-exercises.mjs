#!/usr/bin/env node
/**
 * PRD §3.2 — popolamento della libreria esercizi dal dataset
 * `exercises-dataset` (github.com/hasaneyldrm/exercises-dataset) scaricato
 * in locale: 1324 esercizi, una GIF animata ciascuno, istruzioni in italiano.
 *
 * Gira in locale, lanciato a mano. Mai nel browser, mai nell'app deployata:
 * usa la secret key (`sb_secret_…`, o la vecchia `service_role`), che bypassa
 * completamente la Row Level Security. Quella chiave non va scritta in nessun file del repository e non
 * va messa in una variabile `VITE_*` (finirebbe nel bundle pubblico).
 *
 * Cosa fa:
 *   1. legge `data/exercises.json` dalla cartella del dataset
 *   2. carica la GIF di ogni esercizio nel bucket pubblico `exercise-media`
 *   3. inserisce una riga in `exercises`: nome, gruppo muscolare in italiano,
 *      istruzioni in italiano (un passo per riga), URL della GIF, attribuzione
 *
 * Rieseguibile: un esercizio già presente (stesso nome, senza distinzione di
 * maiuscole) viene saltato, a meno di `--aggiorna`. Così si può rilanciare
 * dopo un'interruzione senza creare doppioni e senza toccare le modifiche
 * fatte dal trainer nell'app.
 *
 * Uso (da PowerShell, nella cartella del progetto):
 *   npm run seed:exercises -- --cartella "C:\percorso\exercises-dataset-main" --dry-run
 *   $env:SUPABASE_URL = "https://xxxx.supabase.co"
 *   $env:SUPABASE_SECRET_KEY = "sb_secret_..."   (o SUPABASE_SERVICE_ROLE_KEY = "eyJ...")
 *   npm run seed:exercises -- --cartella "C:\percorso\exercises-dataset-main" --limit 20
 *   npm run seed:exercises -- --cartella "C:\percorso\exercises-dataset-main"
 *
 * Opzioni:
 *   --cartella <percorso>  cartella del dataset (default: supabase/seed/data)
 *   --dry-run              controlla dataset e file, non scrive niente e non
 *                          richiede le chiavi
 *   --limit <n>            solo i primi n esercizi (per una prova)
 *   --aggiorna             riscrive anche gli esercizi che esistono già
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  contentTypeDa,
  deduplica,
  normalizzaEsercizio,
  pianifica,
  rigaEsercizio,
} from './exerciseDataset.mjs'

const QUI = path.dirname(fileURLToPath(import.meta.url))
const BUCKET = 'exercise-media'
const LOTTO_INSERT = 100
const UPLOAD_IN_PARALLELO = 6
const PAGINA_LETTURA = 1000 // il massimo di righe che PostgREST restituisce per richiesta

/* ------------------------------------------------------------- argomenti */

const argomenti = process.argv.slice(2)
const flag = (nome) => argomenti.includes(nome)
function valore(nome) {
  const i = argomenti.indexOf(nome)
  return i >= 0 ? argomenti[i + 1] : undefined
}

const dryRun = flag('--dry-run')
const aggiorna = flag('--aggiorna')
const limite = valore('--limit') ? Number.parseInt(valore('--limit'), 10) : Infinity
// PowerShell passa `"C:\cartella\"` come `C:\cartella"`: via le virgolette finali.
const cartella = path.resolve(
  (valore('--cartella') ?? path.join(QUI, 'data')).replace(/["']+$/, ''),
)

function esci(messaggio) {
  console.error(`\n  ${messaggio}\n`)
  process.exit(1)
}

if (Number.isNaN(limite) || limite < 1) esci('--limit vuole un numero maggiore di zero.')

/* --------------------------------------------------------------- dataset */

function trovaJson() {
  const candidati = [
    path.join(cartella, 'data', 'exercises.json'),
    path.join(cartella, 'exercises.json'),
  ]
  const trovato = candidati.find((p) => existsSync(p))
  if (!trovato) {
    esci(
      `Non trovo exercises.json in ${cartella}\n` +
        '  Mi aspetto la cartella del dataset così com\'è scaricata da GitHub,\n' +
        '  con dentro data/exercises.json, videos/ e images/.\n' +
        '  Indicala con --cartella "C:\\percorso\\exercises-dataset-main".',
    )
  }
  return trovato
}

async function leggiDataset() {
  const file = trovaJson()
  let grezzi
  try {
    grezzi = JSON.parse(await readFile(file, 'utf8'))
  } catch (errore) {
    esci(`${file} non è un JSON valido: ${errore.message}`)
  }
  if (!Array.isArray(grezzi)) esci(`${file} non contiene un array di esercizi.`)

  const normalizzati = grezzi.map(normalizzaEsercizio).filter(Boolean)
  const { unici, doppioni } = deduplica(normalizzati)
  const selezionati = unici.slice(0, limite)

  const senzaGruppo = selezionati.filter((e) => !e.gruppo)
  const senzaFile = selezionati.filter(
    (e) => !e.fileMedia || !existsSync(path.join(cartella, e.fileMedia)),
  )
  const formatoNonSupportato = selezionati.filter(
    (e) => e.fileMedia && !contentTypeDa(e.fileMedia),
  )

  return { grezzi, selezionati, doppioni, senzaGruppo, senzaFile, formatoNonSupportato }
}

function riepilogoDataset(d) {
  console.log(`  Dataset: ${cartella}`)
  console.log(`  ${d.grezzi.length} record → ${d.selezionati.length} esercizi da elaborare`)
  if (d.doppioni.length) {
    console.log(
      `  ${d.doppioni.length} nomi ripetuti nel dataset, tengo il primo: ` +
        d.doppioni.map((e) => `"${e.nome}"`).join(', '),
    )
  }
  if (d.senzaGruppo.length) {
    const target = [...new Set(d.senzaGruppo.map((e) => e.target ?? '(nessuno)'))]
    console.log(
      `  ! ${d.senzaGruppo.length} senza gruppo muscolare (target non mappato: ${target.join(', ')})` +
        '\n    → aggiungili a GRUPPO_DA_TARGET in supabase/seed/exerciseDataset.mjs',
    )
  }
  if (d.senzaFile.length) {
    console.log(
      `  ! ${d.senzaFile.length} senza file media nella cartella (verranno creati senza GIF), es.: ` +
        d.senzaFile.slice(0, 3).map((e) => e.fileMedia ?? e.nome).join(', '),
    )
  }
  if (d.formatoNonSupportato.length) {
    console.log(`  ! ${d.formatoNonSupportato.length} file con un formato che l'app non mostra`)
  }

  const perGruppo = new Map()
  for (const e of d.selezionati) {
    const g = e.gruppo ?? '(nessuno)'
    perGruppo.set(g, (perGruppo.get(g) ?? 0) + 1)
  }
  console.log(
    '  Per gruppo: ' +
      [...perGruppo.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([g, n]) => `${g} ${n}`)
        .join(' · '),
  )
}

/* -------------------------------------------------------------- supabase */

/**
 * Che chiave è? Serve quella che bypassa la RLS e può creare bucket: la
 * `secret` (sb_secret_…, progetti da fine 2025) o la vecchia `service_role`
 * (un JWT eyJ… con role "service_role"). La publishable/anon no: con quella
 * lo script fallirebbe a metà con errori di permessi poco chiari.
 */
function controllaChiave(chiave) {
  if (chiave.startsWith('sb_secret_')) return null
  if (chiave.startsWith('sb_publishable_')) {
    return 'Questa è la publishable key (sb_publishable_…): serve la secret key (sb_secret_…).'
  }
  if (chiave.startsWith('eyJ')) {
    try {
      const payload = JSON.parse(Buffer.from(chiave.split('.')[1], 'base64url').toString('utf8'))
      if (payload.role === 'service_role') return null
      return `Questa è la chiave "${payload.role}": serve la service_role (o la secret key sb_secret_…).`
    } catch {
      return 'La chiave sembra un JWT ma non si legge: ricopiala per intero.'
    }
  }
  return 'Chiave non riconosciuta: serve la secret key (sb_secret_…) o la service_role (eyJ…).'
}

function creaClient() {
  const url = process.env.SUPABASE_URL
  const chiave = (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim()
  if (!url || !chiave) {
    esci(
      'Servono SUPABASE_URL e SUPABASE_SECRET_KEY nell\'ambiente.\n' +
        '  Dashboard Supabase → Project Settings → API Keys: la "secret key" (sb_secret_…).\n' +
        '  Sui progetti con le chiavi vecchie va bene la service_role (eyJ…).\n' +
        '  In PowerShell:\n' +
        '    $env:SUPABASE_URL = "https://xxxx.supabase.co"\n' +
        '    $env:SUPABASE_SECRET_KEY = "sb_secret_..."\n' +
        '  Valgono solo per quella finestra: non scriverle in un file del progetto.',
    )
  }
  const problema = controllaChiave(chiave)
  if (problema) esci(problema)
  return createClient(url.replace(/\/+$/, ''), chiave, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function assicuraBucket(supabase) {
  const { data: bucket, error } = await supabase.storage.listBuckets()
  if (error) {
    esci(
      `Non riesco a elencare i bucket di Storage: ${error.message}\n` +
        '  Controlla SUPABASE_URL e la secret key.',
    )
  }
  const esistente = bucket.find((b) => b.name === BUCKET)
  if (esistente) {
    if (!esistente.public) {
      esci(
        `Il bucket "${BUCKET}" esiste ma è privato: le GIF non si vedrebbero nell'app.\n` +
          '  Rendilo pubblico da Storage → bucket → Edit bucket, poi rilancia.',
      )
    }
    return
  }
  console.log(`  Creo il bucket pubblico "${BUCKET}"…`)
  const { error: erroreCreazione } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: '10MB',
  })
  if (erroreCreazione) esci(`Non riesco a creare il bucket: ${erroreCreazione.message}`)
}

/** lower(name) → id di tutti gli esercizi già nel database, pagina per pagina. */
async function eserciziEsistenti(supabase) {
  const esistenti = new Map()
  for (let da = 0; ; da += PAGINA_LETTURA) {
    const { data, error } = await supabase
      .from('exercises')
      .select('id, name')
      .order('id')
      .range(da, da + PAGINA_LETTURA - 1)
    if (error) {
      esci(
        `Non riesco a leggere la tabella exercises: ${error.message}\n` +
          '  Le migrazioni sono applicate, 0010 compresa? (STATO.md §9.2)',
      )
    }
    for (const riga of data) esistenti.set(riga.name.toLowerCase(), riga.id)
    if (data.length < PAGINA_LETTURA) return esistenti
  }
}

async function caricaMedia(supabase, esercizio) {
  if (!esercizio.fileMedia) return null
  const contentType = contentTypeDa(esercizio.fileMedia)
  const percorso = path.join(cartella, esercizio.fileMedia)
  if (!contentType || !existsSync(percorso)) return null

  const contenuto = await readFile(percorso)
  for (let tentativo = 1; tentativo <= 2; tentativo += 1) {
    const { error } = await supabase.storage
      .from(BUCKET)
      // Stessa chiave del percorso nel dataset (videos/0001-xxxx.gif): upsert,
      // così una seconda esecuzione sovrascrive invece di fallire.
      .upload(esercizio.fileMedia, contenuto, { contentType, upsert: true })
    if (!error) {
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(esercizio.fileMedia)
      return { url: data.publicUrl, contentType }
    }
    if (tentativo === 2) {
      console.warn(`  ! upload fallito per ${esercizio.fileMedia}: ${error.message}`)
    }
  }
  return null
}

/** Esegue `lavoro` su tutti gli elementi, al massimo `n` alla volta, in ordine. */
async function inParallelo(elementi, n, lavoro) {
  const risultati = new Array(elementi.length)
  let prossimo = 0
  const operai = Array.from({ length: Math.min(n, elementi.length) }, async () => {
    while (prossimo < elementi.length) {
      const i = prossimo++
      risultati[i] = await lavoro(elementi[i], i)
    }
  })
  await Promise.all(operai)
  return risultati
}

/* ------------------------------------------------------------------ main */

async function main() {
  console.log(`\n  Seed libreria esercizi${dryRun ? ' — prova a vuoto' : ''}\n`)

  const dataset = await leggiDataset()
  riepilogoDataset(dataset)

  if (dryRun) {
    console.log('\n  Primi esercizi:')
    for (const e of dataset.selezionati.slice(0, 5)) {
      console.log(`   · ${e.nome} — ${e.gruppo ?? 'senza gruppo'} — ${e.fileMedia ?? 'senza media'}`)
    }
    console.log('\n  Prova a vuoto: non ho scritto niente.\n')
    return
  }

  const supabase = creaClient()
  await assicuraBucket(supabase)

  const esistenti = await eserciziEsistenti(supabase)
  const { daInserire, daAggiornare, saltati } = pianifica(dataset.selezionati, esistenti, aggiorna)
  console.log(
    `\n  Nel database ci sono già ${esistenti.size} esercizi.` +
      ` Da inserire: ${daInserire.length}` +
      (aggiorna ? `, da aggiornare: ${daAggiornare.length}` : `, già presenti e saltati: ${saltati.length}`) +
      '\n',
  )

  const daScrivere = [...daInserire, ...daAggiornare]
  let senzaMedia = 0
  let fatti = 0
  const media = await inParallelo(daScrivere, UPLOAD_IN_PARALLELO, async (esercizio) => {
    const risultato = await caricaMedia(supabase, esercizio)
    if (!risultato) senzaMedia += 1
    fatti += 1
    if (fatti % 50 === 0 || fatti === daScrivere.length) {
      console.log(`  media ${fatti}/${daScrivere.length}`)
    }
    return risultato
  })
  const mediaDi = new Map(daScrivere.map((e, i) => [e, media[i]]))

  let inseriti = 0
  let aggiornati = 0
  // Inseriti da qualcun altro fra la lettura iniziale e l'insert: già presenti anche loro.
  let comparsiNelFrattempo = 0
  const falliti = []

  for (let i = 0; i < daInserire.length; i += LOTTO_INSERT) {
    const lotto = daInserire.slice(i, i + LOTTO_INSERT)
    const righe = lotto.map((e) => rigaEsercizio(e, mediaDi.get(e)))
    const { error } = await supabase.from('exercises').insert(righe)
    if (!error) {
      inseriti += righe.length
    } else {
      // Un lotto è tutto o niente: si ripiega riga per riga per salvare il
      // resto e sapere quali falliscono davvero.
      for (const riga of righe) {
        const { error: erroreRiga } = await supabase.from('exercises').insert(riga)
        if (!erroreRiga) inseriti += 1
        else if (erroreRiga.code === '23505') comparsiNelFrattempo += 1
        else falliti.push(`${riga.name}: ${erroreRiga.message}`)
      }
    }
    console.log(`  righe ${Math.min(i + LOTTO_INSERT, daInserire.length)}/${daInserire.length}`)
  }

  for (const esercizio of daAggiornare) {
    const { error } = await supabase
      .from('exercises')
      .update(rigaEsercizio(esercizio, mediaDi.get(esercizio)))
      .eq('id', esercizio.idEsistente)
    if (error) falliti.push(`${esercizio.nome}: ${error.message}`)
    else aggiornati += 1
  }

  console.log(
    `\n  Fatto: ${inseriti} inseriti` +
      (aggiorna ? `, ${aggiornati} aggiornati` : '') +
      (saltati.length + comparsiNelFrattempo ? `, ${saltati.length + comparsiNelFrattempo} già presenti` : '') +
      (senzaMedia ? `, ${senzaMedia} senza GIF` : '') +
      '.',
  )
  if (falliti.length) {
    console.log(`\n  ${falliti.length} non riusciti:`)
    falliti.slice(0, 20).forEach((f) => console.log(`   · ${f}`))
    if (falliti.length > 20) console.log(`   … e altri ${falliti.length - 20}`)
    console.log('\n  Rilancia lo stesso comando: gli esercizi già inseriti vengono saltati.\n')
    process.exit(1)
  }
  console.log('  Media © Gym visual (https://gymvisual.com/): l\'attribuzione è salvata su ogni esercizio.\n')
}

main().catch((errore) => {
  console.error(errore)
  process.exit(1)
})
