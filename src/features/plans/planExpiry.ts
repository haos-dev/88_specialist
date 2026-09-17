import { giorniDaOggi } from '@/lib/dates'
import type { Scadenza, StatoScadenza } from '@/types/domain'

export const SOGLIA_REMINDER_DEFAULT = 7

interface ArgomentiScadenza {
  end_date: string | null
  /** Solo le schede `active` entrano nel conteggio (PRD §3.6). */
  status: string
  /** Le schede di clienti archiviati sono escluse (PRD §3.6). */
  clienteAttivo: boolean
}

/**
 * PRD §3.6 — regole complete:
 *   end_date < oggi                    -> scaduta
 *   oggi <= end_date <= oggi + soglia  -> in scadenza
 *   tutto il resto, incluse le schede senza end_date, quelle archiviate e
 *   quelle di clienti archiviati       -> nessuna
 *
 * Il confronto usa i giorni di calendario locali, non i millisecondi UTC:
 * vedi la nota in `lib/dates.ts`.
 */
export function calcolaScadenza(
  scheda: ArgomentiScadenza,
  sogliaGiorni: number = SOGLIA_REMINDER_DEFAULT,
  now: Date = new Date(),
): Scadenza {
  const nessuna: Scadenza = { stato: 'nessuna', giorniResidui: null }

  if (scheda.status !== 'active') return nessuna
  if (!scheda.clienteAttivo) return nessuna

  const giorni = giorniDaOggi(scheda.end_date, now)
  if (giorni === null) return nessuna

  const soglia = Number.isFinite(sogliaGiorni) && sogliaGiorni >= 0
    ? sogliaGiorni
    : SOGLIA_REMINDER_DEFAULT

  let stato: StatoScadenza = 'nessuna'
  if (giorni < 0) stato = 'scaduta'
  else if (giorni <= soglia) stato = 'in-scadenza'

  return { stato, giorniResidui: stato === 'nessuna' ? null : giorni }
}

/** Ordina le schede segnalate: prima le più scadute, poi le più imminenti. */
export function ordinaPerUrgenza<T extends { scadenza: Scadenza }>(righe: T[]): T[] {
  return [...righe].sort(
    (a, b) => (a.scadenza.giorniResidui ?? 0) - (b.scadenza.giorniResidui ?? 0),
  )
}

export const ETICHETTA_SCADENZA: Record<Exclude<StatoScadenza, 'nessuna'>, string> = {
  scaduta: 'Scaduta',
  'in-scadenza': 'In scadenza',
}
