import type { ReactNode } from 'react'
import { messaggioErrore } from '@/data'
import { Button } from './Button'

/**
 * Audit B9 — l'unico posto in cui l'app disegna "sto caricando", "non c'è
 * niente" e "è andata male". Senza questa primitiva ogni schermata inventa la
 * sua versione e l'app smette di sembrare un prodotto solo.
 *
 * Lo schermo vuoto è un invito ad agire, non un cartello di scuse; l'errore
 * dice cosa è successo e cosa fare, senza chiedere perdono.
 */

export function Caricamento({ testo = 'Caricamento…' }: { testo?: string }) {
  return (
    <div className="flex items-center gap-3 py-10 text-sm text-muted" role="status">
      <span
        aria-hidden="true"
        className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-line border-t-accent"
      />
      {testo}
    </div>
  )
}

interface VuotoProps {
  titolo: string
  descrizione?: string
  azione?: ReactNode
}

export function Vuoto({ titolo, descrizione, azione }: VuotoProps) {
  return (
    <div className="border-t border-line py-12">
      <p className="display-tight text-lg text-ink">{titolo}</p>
      {descrizione && <p className="mt-1.5 max-w-[52ch] text-sm text-muted">{descrizione}</p>}
      {azione && <div className="mt-4">{azione}</div>}
    </div>
  )
}

interface ErroreProps {
  errore: unknown
  onRiprova?: () => void
}

export function Errore({ errore, onRiprova }: ErroreProps) {
  return (
    <div className="border-l-2 border-scaduta bg-scaduta-soft py-4 pl-4 pr-4" role="alert">
      <p className="text-sm font-medium text-scaduta">{messaggioErrore(errore)}</p>
      {onRiprova && (
        <Button dimensione="sm" className="mt-3" onClick={onRiprova}>
          Riprova
        </Button>
      )}
    </div>
  )
}

interface StatoProps<T> {
  caricamento: boolean
  errore: unknown
  dati: T | undefined
  onRiprova?: () => void
  /** Mostrato quando la query è andata a buon fine ma non c'è nulla da elencare. */
  vuoto?: ReactNode
  /** True quando `dati` è presente ma non contiene righe. */
  eVuoto?: (dati: T) => boolean
  children: (dati: T) => ReactNode
}

/** Copre i quattro stati di una query in un unico punto. */
export function Stato<T>({
  caricamento,
  errore,
  dati,
  onRiprova,
  vuoto,
  eVuoto,
  children,
}: StatoProps<T>) {
  if (errore) return <Errore errore={errore} onRiprova={onRiprova} />
  if (caricamento || dati === undefined) return <Caricamento />
  if (vuoto && eVuoto?.(dati)) return <>{vuoto}</>
  return <>{children(dati)}</>
}
