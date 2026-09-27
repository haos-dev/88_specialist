/**
 * Dal dataset `exercises-dataset` (github.com/hasaneyldrm/exercises-dataset)
 * alle righe della tabella `exercises`. Logica pura: niente rete, niente
 * file system, così è coperta da `tests/seedExercises.test.ts` e lo script
 * `seed-exercises.mjs` resta solo I/O.
 *
 * Forma di un record del dataset (1324 in `data/exercises.json`):
 *   { id: "0001", name: "3/4 sit-up", target: "abs", body_part: "waist",
 *     instructions: { it: "…", en: "…", … },
 *     instruction_steps: { it: ["…", "…"], en: [...], … },
 *     image: "images/0001-2gPfomN.jpg", gif_url: "videos/0001-2gPfomN.gif",
 *     attribution: "© Gym visual — https://gymvisual.com/" }
 */

/**
 * `target` del dataset (il muscolo principale) → gruppo muscolare dell'app,
 * gli stessi nomi di GRUPPI_MUSCOLARI in src/types/domain.ts, così il filtro
 * e il form Esercizio non si ritrovano due liste in lingue diverse.
 *
 * Le righe senza un gruppo ovvio sono una scelta, non un fatto: cambiarle
 * qui e rilanciare con --aggiorna.
 */
export const GRUPPO_DA_TARGET = {
  abs: 'Addome',
  pectorals: 'Petto',
  'serratus anterior': 'Petto',
  lats: 'Dorso',
  'upper back': 'Dorso',
  spine: 'Dorso', // iperestensioni e simili: erettori della colonna
  traps: 'Spalle', // scrollate: in palestra si allenano con le spalle
  delts: 'Spalle',
  'levator scapulae': 'Spalle', // i 2 esercizi per il collo
  biceps: 'Bicipiti',
  triceps: 'Tricipiti',
  forearms: 'Avambracci',
  quads: 'Quadricipiti',
  adductors: 'Quadricipiti', // interno coscia: nessun gruppo dedicato
  hamstrings: 'Femorali',
  glutes: 'Glutei',
  abductors: 'Glutei', // il medio gluteo è l'abduttore principale
  calves: 'Polpacci',
  'cardiovascular system': 'Cardio',
}

export const ATTRIBUZIONE_PREDEFINITA = '© Gym visual — https://gymvisual.com/'

const CONTENT_TYPE = {
  '.gif': 'image/gif',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
}

/** Content-Type dall'estensione; null se non è un'immagine che l'app sa mostrare. */
export function contentTypeDa(file) {
  const punto = file.lastIndexOf('.')
  if (punto < 0) return null
  return CONTENT_TYPE[file.slice(punto).toLowerCase()] ?? null
}

/** Separatori di Windows → `/`: i percorsi diventano chiavi di Storage. */
export function percorsoPosix(file) {
  return file.replace(/\\/g, '/').replace(/^\.?\//, '')
}

/** Istruzioni in italiano, un passo per riga; inglese se l'italiano manca. */
function descrizioneDa(record) {
  const passi = record.instruction_steps?.it ?? record.instruction_steps?.en
  if (Array.isArray(passi) && passi.length > 0) {
    return passi.map((passo, i) => `${i + 1}. ${String(passo).trim()}`).join('\n')
  }
  const testo =
    typeof record.instructions === 'string'
      ? record.instructions
      : (record.instructions?.it ?? record.instructions?.en)
  return typeof testo === 'string' && testo.trim() ? testo.trim() : null
}

/**
 * Un record del dataset → quello che serve per una riga di `exercises`, più
 * il file da caricare. null se il record non ha un nome utilizzabile.
 */
export function normalizzaEsercizio(record) {
  const nome = typeof record?.name === 'string' ? record.name.trim() : ''
  if (!nome) return null

  const target = typeof record.target === 'string' ? record.target.trim().toLowerCase() : null
  // Preferita la GIF animata: è il motivo per cui si usa questo dataset. La
  // miniatura statica solo se la GIF manca.
  const file = record.gif_url ?? record.image ?? null

  return {
    id: record.id ?? null,
    nome,
    target,
    gruppo: target ? (GRUPPO_DA_TARGET[target] ?? null) : null,
    descrizione: descrizioneDa(record),
    fileMedia: file ? percorsoPosix(file) : null,
    attribuzione:
      typeof record.attribution === 'string' && record.attribution.trim()
        ? record.attribution.trim()
        : ATTRIBUZIONE_PREDEFINITA,
  }
}

/**
 * Tiene il primo esercizio per ogni nome (senza distinzione di maiuscole),
 * come l'indice unico su lower(name) di 0001. Il dataset ha 6 nomi ripetuti:
 * varianti dello stesso esercizio con un'altra animazione.
 */
export function deduplica(esercizi) {
  const perNome = new Map()
  const doppioni = []
  for (const esercizio of esercizi) {
    const chiave = esercizio.nome.toLowerCase()
    if (perNome.has(chiave)) doppioni.push(esercizio)
    else perNome.set(chiave, esercizio)
  }
  return { unici: [...perNome.values()], doppioni }
}

/**
 * Cosa fare con ogni esercizio, dati quelli già nel database
 * (`esistenti`: lower(name) → id). Senza `aggiorna` un esercizio che esiste
 * già non si tocca: potrebbe averlo modificato il trainer.
 */
export function pianifica(unici, esistenti, aggiorna) {
  const daInserire = []
  const daAggiornare = []
  const saltati = []
  for (const esercizio of unici) {
    const id = esistenti.get(esercizio.nome.toLowerCase())
    if (id === undefined) daInserire.push(esercizio)
    else if (aggiorna) daAggiornare.push({ ...esercizio, idEsistente: id })
    else saltati.push(esercizio)
  }
  return { daInserire, daAggiornare, saltati }
}

/** La riga per `exercises`. `media` è il risultato dell'upload, o null. */
export function rigaEsercizio(esercizio, media) {
  return {
    name: esercizio.nome,
    muscle_group: esercizio.gruppo,
    description: esercizio.descrizione,
    media_url: media?.url ?? null,
    media_type: media?.contentType ?? null,
    media_attribution: media ? esercizio.attribuzione : null,
  }
}
