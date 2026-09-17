import { durataGiorni, oggi, parseDataISO, spostaData, toDataISO } from '@/lib/dates'
import type { GiornoEspanso, SchedaCompleta } from '@/types/domain'

export interface DateRinnovo {
  start_date: string | null
  end_date: string | null
}

/**
 * PRD §3.3 — "Rinnova scheda: duplica con nuove date". Il PRD non dice *quali*
 * date, quindi la scelta è: riparti dal giorno dopo la fine della scheda
 * precedente, conservando la stessa durata. Se quella scheda è già scaduta da
 * un pezzo il rinnovo partirebbe nel passato, quindi in quel caso si parte da
 * oggi. Sono comunque valori preimpostati in un dialog: il trainer li corregge.
 */
export function calcolaDateRinnovo(
  scheda: Pick<SchedaCompleta, 'start_date' | 'end_date'>,
  now: Date = new Date(),
): DateRinnovo {
  const oggiISO = toDataISO(oggi(now))

  if (!scheda.end_date) {
    // Senza fine non c'è durata da conservare: si riparte da oggi, aperta.
    return { start_date: oggiISO, end_date: null }
  }

  const dopoLaFine = spostaData(scheda.end_date, 1)
  const inizio =
    parseDataISO(dopoLaFine)! > oggi(now) ? dopoLaFine : oggiISO

  const durata = scheda.start_date
    ? durataGiorni(scheda.start_date, scheda.end_date)
    : null

  return {
    start_date: inizio,
    end_date: durata === null ? null : spostaData(inizio, durata),
  }
}

/** Titolo proposto: identico. Il PRD non chiede suffissi automatici. */
export function titoloRinnovo(titolo: string): string {
  return titolo
}

export interface StrutturaDuplicata {
  giorni: Array<{
    day_order: number
    day_name: string
    esercizi: Array<{
      exercise_id: string
      order_index: number
      sets: string | null
      reps: string | null
      rest_seconds: number | null
      tempo: string | null
      notes: string | null
    }>
  }>
}

/**
 * Il rinnovo è una copia **profonda**: giorni *e* esercizi dentro ai giorni,
 * ordine conservato. Il PRD dice solo "duplica", ma una scheda rinnovata senza
 * i suoi esercizi è una scheda vuota.
 */
export function duplicaStruttura(giorni: GiornoEspanso[]): StrutturaDuplicata {
  return {
    giorni: [...giorni]
      .sort((a, b) => a.day_order - b.day_order)
      .map((giorno, indiceGiorno) => ({
        day_order: indiceGiorno,
        day_name: giorno.day_name,
        esercizi: [...giorno.esercizi]
          .sort((a, b) => a.order_index - b.order_index)
          .map((riga, indice) => ({
            exercise_id: riga.exercise_id,
            order_index: indice,
            sets: riga.sets,
            reps: riga.reps,
            rest_seconds: riga.rest_seconds,
            tempo: riga.tempo,
            notes: riga.notes,
          })),
      })),
  }
}
