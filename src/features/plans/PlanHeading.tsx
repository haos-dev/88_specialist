import { BadgeScadenza } from '@/components/ui/Badge'
import { formatIntervallo } from '@/lib/dates'
import type { Scadenza } from '@/types/domain'

interface PlanHeadingProps {
  clienteNome: string
  titolo: string
  inizio: string | null
  fine: string | null
  scadenza?: Scadenza
  archiviata?: boolean
}

/**
 * L'unico punto in cui il sistema visivo alza la voce: nome del cliente grande
 * e allargato, titolo sotto, periodo e stato su una riga a cifre tabulari
 * sotto un filetto pesante.
 *
 * È lo stesso componente usato dal builder e dal foglio di stampa: schermo e
 * PDF devono sembrare due viste dello stesso documento, non due prodotti.
 */
export function PlanHeading({
  clienteNome,
  titolo,
  inizio,
  fine,
  scadenza,
  archiviata,
}: PlanHeadingProps) {
  return (
    <div>
      <p className="display text-3xl leading-none text-ink sm:text-4xl">{clienteNome}</p>
      <p className="display-tight mt-1.5 text-xl text-muted">{titolo}</p>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t-2 border-ink pt-2">
        <p className="nums text-sm text-ink">{formatIntervallo(inizio, fine)}</p>
        {archiviata ? (
          <span className="border border-line px-1.5 py-0.5 text-xs font-medium text-muted">
            Archiviata
          </span>
        ) : scadenza ? (
          <BadgeScadenza stato={scadenza.stato} giorniResidui={scadenza.giorniResidui} />
        ) : null}
      </div>
    </div>
  )
}
