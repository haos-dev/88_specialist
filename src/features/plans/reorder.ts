import type { Riordino } from '@/types/domain'

/** Sposta un elemento da un indice all'altro, senza mutare l'array di partenza. */
export function spostaElemento<T>(items: readonly T[], da: number, a: number): T[] {
  if (da === a || da < 0 || a < 0 || da >= items.length || a >= items.length) {
    return [...items]
  }
  const copia = [...items]
  const [preso] = copia.splice(da, 1)
  copia.splice(a, 0, preso)
  return copia
}

/**
 * Audit B2 — dopo un drag&drop le posizioni degli elementi *fratelli* vanno
 * riscritte. Emettiamo solo le righe che hanno davvero cambiato posizione, così
 * l'upsert batch resta piccolo: spostare l'ultimo elemento di dieci in fondo
 * non deve produrre dieci update.
 */
export function riordinoMinimo(
  ordineAttuale: ReadonlyArray<{ id: string; position: number }>,
  nuovoOrdine: ReadonlyArray<{ id: string }>,
): Riordino[] {
  const posizionePrecedente = new Map(ordineAttuale.map((r) => [r.id, r.position]))
  const cambiate: Riordino[] = []

  nuovoOrdine.forEach((riga, indice) => {
    if (posizionePrecedente.get(riga.id) !== indice) {
      cambiate.push({ id: riga.id, position: indice })
    }
  })

  return cambiate
}

/** Rinumera 0..n-1 in memoria, per l'aggiornamento ottimistico della UI. */
export function rinumera<T extends { id: string }>(
  items: readonly T[],
  campo: 'day_order' | 'order_index',
): T[] {
  return items.map((item, indice) => ({ ...item, [campo]: indice }))
}
