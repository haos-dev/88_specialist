import { addDays, addMonths, getISODay, isAfter } from 'date-fns'
import { oggi, parseDataISO, toDataISO } from '@/lib/dates'
import type { LezioneInput } from '@/types/domain'

/**
 * Giorni di allenamento scelti alla creazione di un cliente → lezioni in
 * calendario. Logica pura: niente React, niente data layer, così i casi
 * delicati (fine mese, cambio d'ora, "oggi ma l'orario è già passato") sono
 * coperti da `tests/trainingSchedule.test.ts`.
 */

/** Giorno ISO: 1 = lunedì … 7 = domenica, come `getISODay` di date-fns. */
export type GiornoSettimana = 1 | 2 | 3 | 4 | 5 | 6 | 7

export const GIORNI_SETTIMANA: ReadonlyArray<{ giorno: GiornoSettimana; nome: string }> = [
  { giorno: 1, nome: 'Lunedì' },
  { giorno: 2, nome: 'Martedì' },
  { giorno: 3, nome: 'Mercoledì' },
  { giorno: 4, nome: 'Giovedì' },
  { giorno: 5, nome: 'Venerdì' },
  { giorno: 6, nome: 'Sabato' },
  { giorno: 7, nome: 'Domenica' },
]

export interface Allenamento {
  giorno: GiornoSettimana
  /** 'HH:mm', come lo restituisce `<input type="time">`. */
  ora: string
}

export const DURATA_LEZIONE_MINUTI = 60

/**
 * Tetto alla data di fine: con sette giorni su sette sono comunque ~365
 * righe in un colpo solo. Oltre, un errore di battitura sull'anno ("2062")
 * riempirebbe il calendario per decenni.
 */
export const FINE_MASSIMA_MESI = 12

export function titoloLezione(nome: string, cognome: string): string {
  return `Lezione ${nome.trim()} ${cognome.trim()}`
}

/** Data di fine proposta dal form: un mese esatto, ultimo giorno incluso. */
export function fineProposta(now: Date = new Date()): string {
  return toDataISO(addDays(addMonths(oggi(now), 1), -1))
}

export function fineMassima(now: Date = new Date()): string {
  return toDataISO(addMonths(oggi(now), FINE_MASSIMA_MESI))
}

/**
 * Una lezione per ogni data tra oggi e `fine` (inclusa) che cade in uno dei
 * giorni scelti, all'orario di quel giorno.
 *
 * Le date passano da `parseDataISO`/`toDataISO` e l'orario resta una stringa:
 * nessun `Date` con un'ora dentro, quindi il cambio d'ora non sposta niente.
 * Una lezione di oggi il cui orario è già passato non viene creata.
 */
export function generaLezioni(
  allenamenti: Allenamento[],
  fine: string,
  titolo: string,
  now: Date = new Date(),
): LezioneInput[] {
  const ultimo = parseDataISO(fine)
  if (!ultimo || allenamenti.length === 0) return []

  const orari = new Map(allenamenti.map((a) => [a.giorno, a.ora]))
  const inizio = oggi(now)
  const oraAdesso = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  const lezioni: LezioneInput[] = []
  for (let giorno = inizio; !isAfter(giorno, ultimo); giorno = addDays(giorno, 1)) {
    const ora = orari.get(getISODay(giorno) as GiornoSettimana)
    if (!ora) continue
    if (giorno.getTime() === inizio.getTime() && ora <= oraAdesso) continue
    lezioni.push({
      title: titolo,
      appointment_date: toDataISO(giorno),
      start_time: `${ora.slice(0, 5)}:00`,
      duration_minutes: DURATA_LEZIONE_MINUTI,
      notes: null,
    })
  }
  return lezioni
}
