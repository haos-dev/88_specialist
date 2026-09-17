import type { ReactNode } from 'react'

interface PageHeaderProps {
  titolo: string
  descrizione?: string
  azioni?: ReactNode
}

/**
 * Intestazione di pagina: titolo Expanded, filetto pesante sotto. È il filetto
 * a separare, non un contenitore — nel sistema visivo la struttura è fatta di
 * righe, non di scatole.
 */
export function PageHeader({ titolo, descrizione, azioni }: PageHeaderProps) {
  return (
    <header className="mb-6 border-b-2 border-ink pb-3">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="display text-2xl leading-none text-ink">{titolo}</h1>
          {descrizione && <p className="mt-2 max-w-[62ch] text-sm text-muted">{descrizione}</p>}
        </div>
        {azioni && <div className="flex flex-wrap items-center gap-2">{azioni}</div>}
      </div>
    </header>
  )
}
