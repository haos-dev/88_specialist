import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { dati, type ImpostazioniInput } from "@/data";
import { chiavi } from "@/lib/queryClient";
import { SOGLIA_REMINDER_DEFAULT } from "@/features/plans/planExpiry";

export function useImpostazioni() {
  return useQuery({
    queryKey: chiavi.impostazioni,
    queryFn: () => dati.impostazioni.leggi(),
    // Cambiano di rado e servono ovunque per il badge delle scadenze.
    staleTime: 10 * 60_000,
  });
}

/**
 * Audit A7 — la soglia va letta con un default anche quando la riga
 * `trainer_settings` non esiste ancora o ha il campo a null, altrimenti il
 * badge scadenze sparisce al primo accesso di un account nuovo.
 */
export function useSogliaReminder(): number {
  const { data } = useImpostazioni();
  const valore = data?.reminder_days_before;
  return typeof valore === "number" && valore >= 0
    ? valore
    : SOGLIA_REMINDER_DEFAULT;
}

export function useSalvaImpostazioni() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: ImpostazioniInput) => dati.impostazioni.salva(input),
    onSuccess: (salvate) => {
      client.setQueryData(chiavi.impostazioni, salvate);
      // La soglia entra nel calcolo delle scadenze: il badge va ricalcolato.
      client.invalidateQueries({ queryKey: chiavi.schede.inScadenza });
    },
  });
}

export function useRigeneraTokenCalendario() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => dati.impostazioni.rigeneraTokenCalendario(),
    onSuccess: (nuovoToken) => {
      client.setQueryData(
        chiavi.impostazioni,
        (
          precedenti:
            | Awaited<ReturnType<typeof dati.impostazioni.leggi>>
            | undefined,
        ) => precedenti && { ...precedenti, calendar_feed_token: nuovoToken },
      );
    },
  });
}
