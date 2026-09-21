import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { dati } from "@/data";
import { chiavi } from "@/lib/queryClient";
import type {
  GiornoEspanso,
  GiornoEsercizioInput,
  Riordino,
  SchedaCompleta,
  SchedaInput,
  AppuntamentoInput,
} from "@/types/domain";
import { useSogliaReminder } from "@/features/settings/useSettings";

/* ------------------------------------------------------------------ letture */

export function useSchedeCliente(clientId: string | undefined) {
  return useQuery({
    queryKey: chiavi.schede.perCliente(clientId ?? ""),
    queryFn: () => dati.schede.elencoPerCliente(clientId!),
    enabled: Boolean(clientId),
  });
}

/** Alimenta sia il badge in sidebar sia il widget in dashboard (PRD §3.6). */
export function useSchedeInScadenza() {
  const soglia = useSogliaReminder();
  return useQuery({
    queryKey: [...chiavi.schede.inScadenza, soglia],
    queryFn: () => dati.schede.inScadenza(soglia),
  });
}

export function useDashboardSommario() {
  const soglia = useSogliaReminder();
  return useQuery({
    queryKey: chiavi.dashboard.sommario(soglia),
    queryFn: () => dati.dashboard.sommario(soglia),
  });
}

export function useAppuntamenti(mese: string) {
  return useQuery({
    queryKey: chiavi.appuntamenti.elenco(mese),
    queryFn: () => dati.appuntamenti.elenco(mese),
  });
}

export function useCreaAppuntamento(mese: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: AppuntamentoInput) => dati.appuntamenti.crea(input),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: chiavi.appuntamenti.elenco(mese) }),
  });
}

export function useEliminaAppuntamento(mese: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => dati.appuntamenti.elimina(id),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: chiavi.appuntamenti.elenco(mese) }),
  });
}

export function useScheda(id: string | undefined) {
  return useQuery({
    queryKey: chiavi.schede.dettaglio(id ?? ""),
    queryFn: () => dati.schede.dettaglio(id!),
    enabled: Boolean(id),
  });
}

/* ------------------------------------------------------------- invalidazioni */

function invalidaTutteLeSchede(client: QueryClient, planId?: string) {
  client.invalidateQueries({ queryKey: chiavi.schede.tutte });
  if (planId)
    client.invalidateQueries({ queryKey: chiavi.schede.dettaglio(planId) });
  // Il numero di schede attive compare nella tabella Clienti.
  client.invalidateQueries({ queryKey: chiavi.clienti.tutti });
}

/* ----------------------------------------------------------------- scritture */

export function useCreaScheda() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: SchedaInput) => dati.schede.crea(input),
    onSuccess: () => invalidaTutteLeSchede(client),
  });
}

export function useAggiornaScheda() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: Omit<SchedaInput, "client_id">;
    }) => dati.schede.aggiorna(id, input),
    onSuccess: (_scheda, { id }) => invalidaTutteLeSchede(client, id),
  });
}

/**
 * PRD §3.3 — Archivia è un'azione a sé, indipendente da Rinnova. Il trainer
 * può rinnovare senza archiviare l'originale, e ritrovarsi due schede attive
 * per lo stesso cliente è il comportamento voluto, non un bug.
 */
export function useCambiaStatoScheda() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, stato }: { id: string; stato: "active" | "archived" }) =>
      dati.schede.impostaStato(id, stato),
    onSuccess: (_scheda, { id }) => invalidaTutteLeSchede(client, id),
  });
}

export function useEliminaScheda() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => dati.schede.elimina(id),
    onSuccess: () => invalidaTutteLeSchede(client),
  });
}

export function useRinnovaScheda() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      titolo,
      inizio,
      fine,
    }: {
      id: string;
      titolo: string;
      inizio: string | null;
      fine: string | null;
    }) => dati.schede.rinnova(id, titolo, inizio, fine),
    onSuccess: () => invalidaTutteLeSchede(client),
  });
}

/* -------------------------------------------------------------------- template */
// §3.7bis: un template condivide giorni/esercizi con le schede normali, quindi
// riusa gli hook di quella sezione (useAggiungiGiorno, useRiordinaEsercizi,
// ecc. — prendono un planId, non sanno né gli importa se è un template).
// Questi cinque coprono solo ciò che è specifico dei template.

export function useTemplates() {
  return useQuery({
    queryKey: chiavi.schede.template,
    queryFn: () => dati.schede.elencoTemplate(),
  });
}

export function useCreaTemplate() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { title: string; notes: string | null }) =>
      dati.schede.creaTemplate(input),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: chiavi.schede.template }),
  });
}

export function useAggiornaTemplate() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: { title: string; notes: string | null };
    }) => dati.schede.aggiornaTemplate(id, input),
    onSuccess: (_template, { id }) => {
      client.invalidateQueries({ queryKey: chiavi.schede.template });
      client.invalidateQueries({ queryKey: chiavi.schede.dettaglio(id) });
    },
  });
}

export function useApplicaTemplate() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      templateId,
      clientId,
      titolo,
      inizio,
      fine,
    }: {
      templateId: string;
      clientId: string;
      titolo: string;
      inizio: string | null;
      fine: string | null;
    }) => dati.schede.applicaTemplate(templateId, clientId, titolo, inizio, fine),
    // La nuova scheda finisce sotto un cliente: invalida come una creazione
    // normale (compare nell'elenco schede di quel cliente e nel conteggio).
    onSuccess: () => invalidaTutteLeSchede(client),
  });
}

export function useEliminaTemplate() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => dati.schede.eliminaTemplate(id),
    onSuccess: (_void, id) => {
      client.removeQueries({ queryKey: chiavi.schede.dettaglio(id) });
      client.invalidateQueries({ queryKey: chiavi.schede.template });
    },
  });
}

/* -------------------------------------------------------------------- giorni */

export function useAggiungiGiorno(planId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (nome: string) => dati.schede.aggiungiGiorno(planId, nome),
    onSuccess: () => invalidaTutteLeSchede(client, planId),
  });
}

export function useRinominaGiorno(planId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ dayId, nome }: { dayId: string; nome: string }) =>
      dati.schede.rinominaGiorno(dayId, nome),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: chiavi.schede.dettaglio(planId) }),
  });
}

export function useEliminaGiorno(planId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (dayId: string) => dati.schede.eliminaGiorno(dayId),
    onSuccess: () => invalidaTutteLeSchede(client, planId),
  });
}

/* ------------------------------------------------------------------ esercizi */

export function useAggiungiEsercizio(planId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      dayId,
      exerciseId,
    }: {
      dayId: string;
      exerciseId: string;
    }) => dati.schede.aggiungiEsercizio(dayId, exerciseId),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: chiavi.schede.dettaglio(planId) }),
  });
}

export function useAggiornaRigaEsercizio(planId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      rowId,
      input,
    }: {
      rowId: string;
      input: GiornoEsercizioInput;
    }) => dati.schede.aggiornaEsercizio(rowId, input),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: chiavi.schede.dettaglio(planId) }),
  });
}

export function useRimuoviEsercizio(planId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (rowId: string) => dati.schede.rimuoviEsercizio(rowId),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: chiavi.schede.dettaglio(planId) }),
  });
}

/* ----------------------------------------------------------------- riordino */

/**
 * Audit B2 — il drag&drop deve sembrare istantaneo, quindi la cache si
 * aggiorna subito e la scrittura parte dietro. Se la scrittura fallisce si
 * torna esattamente allo stato di prima: nessun ordine "quasi giusto" che
 * sopravvive a un errore.
 */
export function useRiordinaGiorni(planId: string) {
  const client = useQueryClient();
  const chiave = chiavi.schede.dettaglio(planId);

  return useMutation({
    mutationFn: ({
      posizioni,
    }: {
      nuovoOrdine: GiornoEspanso[];
      posizioni: Riordino[];
    }) => dati.schede.riordinaGiorni(planId, posizioni),

    onMutate: async ({ nuovoOrdine }) => {
      await client.cancelQueries({ queryKey: chiave });
      const precedente = client.getQueryData<SchedaCompleta>(chiave);
      if (precedente) {
        client.setQueryData<SchedaCompleta>(chiave, {
          ...precedente,
          giorni: nuovoOrdine.map((giorno, indice) => ({
            ...giorno,
            day_order: indice,
          })),
        });
      }
      return { precedente };
    },

    onError: (_errore, _variabili, contesto) => {
      if (contesto?.precedente)
        client.setQueryData(chiave, contesto.precedente);
    },

    onSettled: () => client.invalidateQueries({ queryKey: chiave }),
  });
}

export function useRiordinaEsercizi(planId: string) {
  const client = useQueryClient();
  const chiave = chiavi.schede.dettaglio(planId);

  return useMutation({
    mutationFn: ({
      dayId,
      posizioni,
    }: {
      dayId: string;
      nuovoOrdine: GiornoEspanso["esercizi"];
      posizioni: Riordino[];
    }) => dati.schede.riordinaEsercizi(dayId, posizioni),

    onMutate: async ({ dayId, nuovoOrdine }) => {
      await client.cancelQueries({ queryKey: chiave });
      const precedente = client.getQueryData<SchedaCompleta>(chiave);
      if (precedente) {
        client.setQueryData<SchedaCompleta>(chiave, {
          ...precedente,
          giorni: precedente.giorni.map((giorno) =>
            giorno.id === dayId
              ? {
                  ...giorno,
                  esercizi: nuovoOrdine.map((riga, indice) => ({
                    ...riga,
                    order_index: indice,
                  })),
                }
              : giorno,
          ),
        });
      }
      return { precedente };
    },

    onError: (_errore, _variabili, contesto) => {
      if (contesto?.precedente)
        client.setQueryData(chiave, contesto.precedente);
    },

    onSettled: () => client.invalidateQueries({ queryKey: chiave }),
  });
}
