#!/usr/bin/env node
/**
 * PRD §3.2 — popolamento iniziale della libreria esercizi.
 *
 * Gira UNA VOLTA, in locale, lanciato a mano. Mai nel browser, mai nell'app
 * deployata: usa la `service_role key`, che bypassa completamente la Row Level
 * Security. Quella chiave non deve entrare in nessun file sotto `src/`, non va
 * committata e non va incollata in una variabile `VITE_*` (tutto ciò che
 * inizia per VITE_ finisce nel bundle pubblico).
 *
 * Cosa fa:
 *   1. legge `data/exercises.json` dal dataset scaricato da GitHub
 *   2. carica ogni immagine/gif su Supabase Storage
 *   3. inserisce una riga in `exercises` con l'URL pubblico
 *
 * È rieseguibile: la deduplica per nome è imposta dall'indice unico su
 * `lower(name)` creato in `0001_schema.sql`, quindi una seconda esecuzione
 * aggiorna invece di duplicare.
 *
 * Uso:
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   node supabase/seed/seed-exercises.mjs [--dry-run] [--limit 50]
 */

import { createClient } from '@supabase/supabase-js'
import { readFile, readdir, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const QUI = path.dirname(fileURLToPath(import.meta.url))
const CARTELLA_DATI = path.join(QUI, 'data')
const FILE_JSON = path.join(CARTELLA_DATI, 'exercises.json')
const BUCKET = 'exercise-media'
const ATTRIBUZIONE = '© Gym visual'

const URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const argomenti = process.argv.slice(2)
const dryRun = argomenti.includes('--dry-run')
const limite = (() => {
  const i = argomenti.indexOf('--limit')
  return i >= 0 ? Number.parseInt(argomenti[i + 1], 10) : Infinity
})()

function esci(messaggio) {
  console.error(`\n  ${messaggio}\n`)
  process.exit(1)
}

if (!URL || !SERVICE_KEY) {
  esci(
    'Servono SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY nell\'ambiente.\n' +
      '  Le trovi in Dashboard Supabase → Project Settings → API.\n' +
      '  Passale sulla riga di comando, non scriverle in un file committato.',
  )
}

if (SERVICE_KEY.length < 40) {
  esci('SUPABASE_SERVICE_ROLE_KEY sembra troncata. Ricopiala per intero.')
}

if (!existsSync(FILE_JSON)) {
  esci(
    `Manca ${path.relative(process.cwd(), FILE_JSON)}.\n` +
      '  Scarica il dataset (es. yuhonas/free-exercise-db) e mettine il\n' +
      '  contenuto in supabase/seed/data/ — la cartella è in .gitignore.',
  )
}

const supabase = createClient(URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

/** I dataset di esercizi non concordano sui nomi dei campi: normalizziamo. */
function normalizza(grezzo) {
  const nome = grezzo.name ?? grezzo.nome ?? grezzo.title
  if (!nome || typeof nome !== 'string') return null

  const gruppo =
    grezzo.muscle_group ??
    grezzo.target ??
    (Array.isArray(grezzo.primaryMuscles) ? grezzo.primaryMuscles[0] : null) ??
    grezzo.bodyPart ??
    null

  const descrizione = Array.isArray(grezzo.instructions)
    ? grezzo.instructions.join(' ')
    : (grezzo.instructions ?? grezzo.description ?? null)

  const immagini = grezzo.images ?? (grezzo.image ? [grezzo.image] : [])

  return {
    nome: nome.trim(),
    gruppo: gruppo ? String(gruppo).trim() : null,
    descrizione: descrizione ? String(descrizione).trim() : null,
    fileImmagine: immagini[0] ?? null,
  }
}

async function assicuraBucket() {
  const { data: esistenti, error } = await supabase.storage.listBuckets()
  if (error) esci(`Non riesco a elencare i bucket: ${error.message}`)
  if (esistenti.some((b) => b.name === BUCKET)) return

  console.log(`  Creo il bucket pubblico "${BUCKET}"…`)
  const { error: erroreCreazione } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: '10MB',
  })
  if (erroreCreazione) esci(`Non riesco a creare il bucket: ${erroreCreazione.message}`)
}

async function caricaMedia(percorsoRelativo) {
  const percorso = path.join(CARTELLA_DATI, percorsoRelativo)
  if (!existsSync(percorso)) return null

  const info = await stat(percorso)
  if (!info.isFile()) return null

  const contenuto = await readFile(percorso)
  const nomeNelBucket = percorsoRelativo.replace(/\\/g, '/')
  const estensione = path.extname(nomeNelBucket).toLowerCase()
  const contentType =
    estensione === '.gif' ? 'image/gif' : estensione === '.png' ? 'image/png' : 'image/jpeg'

  const { error } = await supabase.storage.from(BUCKET).upload(nomeNelBucket, contenuto, {
    contentType,
    // upsert: lo script deve poter essere rilanciato senza ripulire il bucket.
    upsert: true,
  })
  if (error) {
    console.warn(`  ! upload fallito per ${nomeNelBucket}: ${error.message}`)
    return null
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(nomeNelBucket)
  return { url: data.publicUrl, contentType }
}

async function main() {
  console.log(`\n  Seed libreria esercizi${dryRun ? ' (prova a vuoto)' : ''}\n`)

  const grezzi = JSON.parse(await readFile(FILE_JSON, 'utf8'))
  if (!Array.isArray(grezzi)) esci('exercises.json non contiene un array.')

  const normalizzati = grezzi.map(normalizza).filter(Boolean).slice(0, limite)

  // Deduplica anche in memoria: alcuni dataset hanno doppioni al loro interno,
  // e mandarli tutti farebbe fallire l'upsert su "ON CONFLICT DO UPDATE command
  // cannot affect row a second time".
  const perNome = new Map()
  for (const esercizio of normalizzati) {
    const chiave = esercizio.nome.toLowerCase()
    if (!perNome.has(chiave)) perNome.set(chiave, esercizio)
  }
  const unici = [...perNome.values()]

  console.log(`  ${grezzi.length} righe nel file → ${unici.length} esercizi unici\n`)

  if (dryRun) {
    unici.slice(0, 10).forEach((e) => console.log(`   · ${e.nome} — ${e.gruppo ?? 'senza gruppo'}`))
    console.log(`\n  Prova a vuoto: non ho scritto niente.\n`)
    return
  }

  await assicuraBucket()

  const LOTTO = 100
  let caricate = 0
  let senzaMedia = 0

  for (let i = 0; i < unici.length; i += LOTTO) {
    const lotto = unici.slice(i, i + LOTTO)

    const righe = []
    for (const esercizio of lotto) {
      let media = null
      if (esercizio.fileImmagine) media = await caricaMedia(esercizio.fileImmagine)
      if (!media) senzaMedia += 1

      righe.push({
        name: esercizio.nome,
        muscle_group: esercizio.gruppo,
        description: esercizio.descrizione,
        media_url: media?.url ?? null,
        media_type: media?.contentType ?? null,
        media_attribution: media ? ATTRIBUZIONE : null,
      })
    }

    const { error } = await supabase
      .from('exercises')
      .upsert(righe, { onConflict: 'name', ignoreDuplicates: false })

    if (error) {
      // L'indice unico è su lower(name): PostgREST non lo sa esprimere in
      // `onConflict`, quindi se il vincolo scatta si ripiega su riga per riga.
      console.warn(`  ! upsert in blocco fallito (${error.message}), riprovo singolarmente…`)
      for (const riga of righe) {
        const { error: erroreRiga } = await supabase.from('exercises').insert(riga)
        if (erroreRiga && erroreRiga.code !== '23505') {
          console.warn(`  ! ${riga.name}: ${erroreRiga.message}`)
        }
      }
    }

    caricate += lotto.length
    console.log(`  ${caricate}/${unici.length}`)
  }

  console.log(
    `\n  Fatto: ${caricate} esercizi${senzaMedia ? `, ${senzaMedia} senza immagine` : ''}.\n` +
      `  Attribuzione delle immagini: ${ATTRIBUZIONE}\n`,
  )
}

// La cartella data/ non esiste finché non scarichi il dataset: il messaggio
// sopra lo spiega, questo è solo per non morire con uno stack trace.
readdir(CARTELLA_DATI).catch(() => {})

main().catch((errore) => {
  console.error(errore)
  process.exit(1)
})
