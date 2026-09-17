import { addDays, differenceInCalendarDays, format, isValid, parse } from 'date-fns'
import { it } from 'date-fns/locale'

/**
 * Tutto il calcolo delle scadenze avviene a mezzanotte **locale**.
 *
 * `new Date('2026-01-31')` viene interpretato da JS come mezzanotte UTC: in
 * Europe/Rome sono le 01:00 o le 02:00 del 31, e il confronto con "oggi"
 * ribalta il badge di qualche ora in anticipo la sera prima. Da qui in poi le
 * date-only passano tutte da `parseDataISO`, mai dal costruttore Date.
 */
export function parseDataISO(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const d = parse(iso.slice(0, 10), 'yyyy-MM-dd', new Date())
  return isValid(d) ? d : null
}

/** Data odierna azzerata a mezzanotte locale. */
export function oggi(now: Date = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

/** Date → 'yyyy-MM-dd', il formato che Postgres si aspetta per una colonna date. */
export function toDataISO(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

/** '2026-01-05' → '5 gen 2026' */
export function formatData(iso: string | null | undefined): string {
  const d = parseDataISO(iso)
  return d ? format(d, 'd MMM yyyy', { locale: it }) : '—'
}

/** '2026-01-05' → '5 gennaio 2026' */
export function formatDataEstesa(iso: string | null | undefined): string {
  const d = parseDataISO(iso)
  return d ? format(d, 'd MMMM yyyy', { locale: it }) : '—'
}

/**
 * Intervallo di validità di una scheda, con l'anno scritto una volta sola
 * quando inizio e fine cadono nello stesso anno.
 */
export function formatIntervallo(
  inizio: string | null | undefined,
  fine: string | null | undefined,
): string {
  const a = parseDataISO(inizio)
  const b = parseDataISO(fine)
  if (!a && !b) return 'Nessun periodo indicato'
  if (a && !b) return `Dal ${format(a, 'd MMM yyyy', { locale: it })}`
  if (!a && b) return `Fino al ${format(b, 'd MMM yyyy', { locale: it })}`
  const stessoAnno = a!.getFullYear() === b!.getFullYear()
  const da = format(a!, stessoAnno ? 'd MMM' : 'd MMM yyyy', { locale: it })
  const al = format(b!, 'd MMM yyyy', { locale: it })
  return `${da} – ${al}`
}

/** Giorni di calendario da oggi a `iso`. Negativo se è già passato. */
export function giorniDaOggi(iso: string | null | undefined, now: Date = new Date()): number | null {
  const d = parseDataISO(iso)
  return d ? differenceInCalendarDays(d, oggi(now)) : null
}

/** '12 giorni' / 'domani' / 'oggi' / '3 giorni fa' — per il badge scadenze. */
export function formatGiorniResidui(giorni: number): string {
  if (giorni === 0) return 'scade oggi'
  if (giorni === 1) return 'scade domani'
  if (giorni === -1) return 'scaduta ieri'
  if (giorni > 0) return `scade tra ${giorni} giorni`
  return `scaduta da ${Math.abs(giorni)} giorni`
}

/** Sposta una data ISO di N giorni, restando in ISO. */
export function spostaData(iso: string, giorni: number): string {
  const d = parseDataISO(iso)
  if (!d) return iso
  return toDataISO(addDays(d, giorni))
}

/** Durata inclusiva in giorni fra due date ISO. */
export function durataGiorni(inizio: string, fine: string): number | null {
  const a = parseDataISO(inizio)
  const b = parseDataISO(fine)
  if (!a || !b) return null
  return differenceInCalendarDays(b, a)
}
