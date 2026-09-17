import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { dati, type FiltroClienti } from '@/data'
import { chiavi } from '@/lib/queryClient'
import type { ClienteInput } from '@/types/domain'

export function useClienti(filtro: FiltroClienti) {
  return useQuery({
    queryKey: chiavi.clienti.elenco(filtro.stato),
    queryFn: () => dati.clienti.elenco(filtro),
  })
}

export function useCliente(id: string | undefined) {
  return useQuery({
    queryKey: chiavi.clienti.dettaglio(id ?? ''),
    queryFn: () => dati.clienti.dettaglio(id!),
    enabled: Boolean(id),
  })
}

/** Dopo ogni scrittura su un cliente le liste vanno rilette: i conteggi cambiano. */
function invalidaClienti(client: ReturnType<typeof useQueryClient>, id?: string) {
  client.invalidateQueries({ queryKey: chiavi.clienti.tutti })
  if (id) client.invalidateQueries({ queryKey: chiavi.clienti.dettaglio(id) })
}

export function useCreaCliente() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: ClienteInput) => dati.clienti.crea(input),
    onSuccess: () => invalidaClienti(client),
  })
}

export function useAggiornaCliente() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ClienteInput }) =>
      dati.clienti.aggiorna(id, input),
    onSuccess: (_cliente, { id }) => invalidaClienti(client, id),
  })
}

export function useArchiviaCliente() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, attivo }: { id: string; attivo: boolean }) =>
      dati.clienti.impostaAttivo(id, attivo),
    onSuccess: (_cliente, { id }) => {
      invalidaClienti(client, id)
      // PRD §3.6: le schede di un cliente archiviato escono dal conteggio scadenze.
      client.invalidateQueries({ queryKey: chiavi.schede.inScadenza })
    },
  })
}

export function useEliminaCliente() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => dati.clienti.elimina(id),
    onSuccess: () => {
      invalidaClienti(client)
      // Il cliente si porta via le sue schede (cascade): niente resta valido.
      client.invalidateQueries({ queryKey: chiavi.schede.tutte })
    },
  })
}
