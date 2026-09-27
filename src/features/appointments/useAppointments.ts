import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { dati } from "@/data";
import { chiavi } from "@/lib/queryClient";
import type { AppuntamentoInput } from "@/types/domain";

export function useAppuntamenti(mese: string) {
  return useQuery({
    queryKey: chiavi.appuntamenti.elenco(mese),
    queryFn: () => dati.appuntamenti.elenco(mese),
  });
}

/*
 * Dopo una scrittura si invalida ogni mese, non solo quello a schermo: è
 * poco (una query per mese visitato) e resta corretto anche quando una
 * scrittura tocca più mesi, come le lezioni create insieme a un cliente.
 */

export function useCreaAppuntamento() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: AppuntamentoInput) => dati.appuntamenti.crea(input),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: chiavi.appuntamenti.tutti }),
  });
}

export function useEliminaAppuntamento() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => dati.appuntamenti.elimina(id),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: chiavi.appuntamenti.tutti }),
  });
}
