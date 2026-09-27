import { describe, expect, it } from 'vitest'
import {
  ATTRIBUZIONE_PREDEFINITA,
  GRUPPO_DA_TARGET,
  contentTypeDa,
  deduplica,
  normalizzaEsercizio,
  percorsoPosix,
  pianifica,
  rigaEsercizio,
} from '../supabase/seed/exerciseDataset.mjs'
import { GRUPPI_MUSCOLARI } from '@/types/domain'

/** Un record con la stessa forma di data/exercises.json del dataset. */
const RECORD = {
  id: '0001',
  name: '3/4 sit-up',
  category: 'waist',
  body_part: 'waist',
  equipment: 'body weight',
  instructions: { it: 'Sdraiati sulla schiena. Solleva il busto.', en: 'Lie flat. Lift.' },
  instruction_steps: {
    it: ['Sdraiati sulla schiena.', 'Solleva il busto.'],
    en: ['Lie flat.', 'Lift.'],
  },
  muscle_group: 'hip flexors',
  secondary_muscles: ['hip flexors', 'lower back'],
  target: 'abs',
  image: 'images/0001-2gPfomN.jpg',
  gif_url: 'videos/0001-2gPfomN.gif',
  media_id: '2gPfomN',
  attribution: '© Gym visual — https://gymvisual.com/',
}

describe('normalizzaEsercizio', () => {
  it('prende gruppo dal target, istruzioni italiane a passi e la GIF', () => {
    expect(normalizzaEsercizio(RECORD)).toEqual({
      id: '0001',
      nome: '3/4 sit-up',
      target: 'abs',
      gruppo: 'Addome',
      descrizione: '1. Sdraiati sulla schiena.\n2. Solleva il busto.',
      fileMedia: 'videos/0001-2gPfomN.gif',
      attribuzione: '© Gym visual — https://gymvisual.com/',
    })
  })

  it('usa il testo unico se mancano i passi, e l\'inglese se manca l\'italiano', () => {
    const senzaPassi = { ...RECORD, instruction_steps: undefined }
    expect(normalizzaEsercizio(senzaPassi)?.descrizione).toBe(
      'Sdraiati sulla schiena. Solleva il busto.',
    )
    expect(
      normalizzaEsercizio({ ...senzaPassi, instructions: { en: 'Lie flat.' } })?.descrizione,
    ).toBe('Lie flat.')
  })

  it('ripiega sulla miniatura senza GIF, e normalizza i percorsi di Windows', () => {
    expect(normalizzaEsercizio({ ...RECORD, gif_url: undefined })?.fileMedia).toBe('images/0001-2gPfomN.jpg')
    expect(percorsoPosix('.\\videos\\0001.gif')).toBe('videos/0001.gif')
  })

  it('un target sconosciuto lascia il gruppo vuoto, senza inventarlo', () => {
    expect(normalizzaEsercizio({ ...RECORD, target: 'tibialis' })?.gruppo).toBeNull()
  })

  it('scarta i record senza nome, e usa l\'attribuzione predefinita se manca', () => {
    expect(normalizzaEsercizio({ ...RECORD, name: '  ' })).toBeNull()
    expect(normalizzaEsercizio(null)).toBeNull()
    expect(normalizzaEsercizio({ ...RECORD, attribution: undefined })?.attribuzione).toBe(
      ATTRIBUZIONE_PREDEFINITA,
    )
  })
})

describe('GRUPPO_DA_TARGET', () => {
  it('copre tutti i 19 target del dataset', () => {
    const target = [
      'abs', 'quads', 'lats', 'calves', 'pectorals', 'glutes', 'hamstrings', 'adductors',
      'triceps', 'cardiovascular system', 'spine', 'upper back', 'biceps', 'delts',
      'forearms', 'traps', 'serratus anterior', 'abductors', 'levator scapulae',
    ]
    for (const t of target) expect(GRUPPO_DA_TARGET[t], t).toBeTruthy()
  })

  it('usa solo i gruppi muscolari che l\'app conosce', () => {
    const noti = new Set<string>(GRUPPI_MUSCOLARI)
    for (const gruppo of Object.values(GRUPPO_DA_TARGET)) expect(noti.has(gruppo), gruppo).toBe(true)
  })
})

describe('deduplica e pianifica', () => {
  const a = normalizzaEsercizio(RECORD)!
  const b = normalizzaEsercizio({ ...RECORD, id: '0002', name: 'Push-up' })!
  const aBis = normalizzaEsercizio({ ...RECORD, id: '1371', name: '3/4 SIT-UP' })!

  it('tiene il primo di ogni nome, senza distinguere maiuscole', () => {
    const { unici, doppioni } = deduplica([a, b, aBis])
    expect(unici.map((e) => e.id)).toEqual(['0001', '0002'])
    expect(doppioni.map((e) => e.id)).toEqual(['1371'])
  })

  it('salta chi esiste già, o lo aggiorna con --aggiorna', () => {
    const esistenti = new Map([['3/4 sit-up', 'uuid-1']])
    const senza = pianifica([a, b], esistenti, false)
    expect(senza.daInserire.map((e) => e.nome)).toEqual(['Push-up'])
    expect(senza.saltati.map((e) => e.nome)).toEqual(['3/4 sit-up'])
    expect(senza.daAggiornare).toEqual([])

    const con = pianifica([a, b], esistenti, true)
    expect(con.daAggiornare.map((e) => e.idEsistente)).toEqual(['uuid-1'])
    expect(con.saltati).toEqual([])
  })
})

describe('rigaEsercizio', () => {
  const esercizio = normalizzaEsercizio(RECORD)!

  it('produce le colonne di exercises, con attribuzione solo se c\'è il media', () => {
    expect(rigaEsercizio(esercizio, { url: 'https://x/v.gif', contentType: 'image/gif' })).toEqual({
      name: '3/4 sit-up',
      muscle_group: 'Addome',
      description: '1. Sdraiati sulla schiena.\n2. Solleva il busto.',
      media_url: 'https://x/v.gif',
      media_type: 'image/gif',
      media_attribution: '© Gym visual — https://gymvisual.com/',
    })
    expect(rigaEsercizio(esercizio, null).media_attribution).toBeNull()
  })

  it('riconosce i formati immagine dall\'estensione', () => {
    expect(contentTypeDa('videos/a.GIF')).toBe('image/gif')
    expect(contentTypeDa('images/a.jpg')).toBe('image/jpeg')
    expect(contentTypeDa('clip.mp4')).toBeNull()
  })
})
