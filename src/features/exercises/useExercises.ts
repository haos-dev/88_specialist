import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { dati, type FiltroEsercizi } from '@/data'
import { chiavi } from '@/lib/queryClient'
import type { EsercizioInput } from '@/types/domain'

export const ESERCIZI_PER_PAGINA = 24

export function useEsercizi(filtro: FiltroEsercizi) {
  return useQuery({
    queryKey: chiavi.esercizi.elenco(filtro),
    queryFn: () => dati.esercizi.elenco(filtro),
    // Cambiando pagina o filtro la griglia tiene i risultati precedenti finché
    // arrivano i nuovi: evita che l'elenco sfarfalli a ogni battuta.
    placeholderData: keepPreviousData,
  })
}

export function useGruppiMuscolari() {
  return useQuery({
    queryKey: chiavi.esercizi.gruppi,
    queryFn: () => dati.esercizi.gruppiMuscolari(),
    staleTime: 30 * 60_000,
  })
}

/** PRD §3.2: prima di eliminare, l'app dice in quante schede l'esercizio è usato. */
export function useUtilizziEsercizio(id: string | undefined) {
  return useQuery({
    queryKey: chiavi.esercizi.utilizzi(id ?? ''),
    queryFn: () => dati.esercizi.utilizzi(id!),
    enabled: Boolean(id),
    staleTime: 0,
  })
}

function invalidaEsercizi(client: ReturnType<typeof useQueryClient>) {
  client.invalidateQueries({ queryKey: chiavi.esercizi.tutti })
}

export function useCreaEsercizio() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: EsercizioInput) => dati.esercizi.crea(input),
    onSuccess: () => invalidaEsercizi(client),
  })
}

export function useAggiornaEsercizio() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: EsercizioInput }) =>
      dati.esercizi.aggiorna(id, input),
    onSuccess: () => {
      invalidaEsercizi(client)
      // Il nome e l'immagine compaiono dentro le schede: vanno rilette anche quelle.
      client.invalidateQueries({ queryKey: chiavi.schede.tutte })
    },
  })
}

export function useArchiviaEsercizio() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, archiviato }: { id: string; archiviato: boolean }) =>
      dati.esercizi.impostaArchiviato(id, archiviato),
    onSuccess: () => invalidaEsercizi(client),
  })
}

export function useEliminaEsercizio() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => dati.esercizi.elimina(id),
    onSuccess: () => invalidaEsercizi(client),
  })
}
