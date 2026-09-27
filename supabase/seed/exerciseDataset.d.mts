// Tipi di exerciseDataset.mjs, per i test TypeScript. Lo script gira con
// Node senza passaggi di build, quindi il modulo resta JavaScript.

export interface EsercizioNormalizzato {
  id: string | null
  nome: string
  target: string | null
  gruppo: string | null
  descrizione: string | null
  fileMedia: string | null
  attribuzione: string
}

export interface Media {
  url: string
  contentType: string
}

export const GRUPPO_DA_TARGET: Record<string, string>
export const ATTRIBUZIONE_PREDEFINITA: string

export function contentTypeDa(file: string): string | null
export function percorsoPosix(file: string): string
export function normalizzaEsercizio(record: unknown): EsercizioNormalizzato | null
export function deduplica(esercizi: EsercizioNormalizzato[]): {
  unici: EsercizioNormalizzato[]
  doppioni: EsercizioNormalizzato[]
}
export function pianifica(
  unici: EsercizioNormalizzato[],
  esistenti: Map<string, string>,
  aggiorna: boolean,
): {
  daInserire: EsercizioNormalizzato[]
  daAggiornare: (EsercizioNormalizzato & { idEsistente: string })[]
  saltati: EsercizioNormalizzato[]
}
export function rigaEsercizio(
  esercizio: EsercizioNormalizzato,
  media: Media | null,
): {
  name: string
  muscle_group: string | null
  description: string | null
  media_url: string | null
  media_type: string | null
  media_attribution: string | null
}
