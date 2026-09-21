import { QueryClient } from "@tanstack/react-query";
import { ErroreDati } from "@/data";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Il trainer è uno solo: nessuno gli cambia i dati sotto i piedi mentre
      // lavora. Trenta secondi evitano di rifare la stessa query passando da
      // una pagina all'altra, senza mostrare mai roba davvero vecchia.
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (tentativi, errore) => {
        // Offline o sessione scaduta: ritentare non serve, cambia solo il
        // momento in cui l'utente vede il messaggio.
        if (errore instanceof ErroreDati) {
          if (errore.causa === "offline" || errore.causa === "autenticazione")
            return false;
          if (errore.causa === "vincolo") return false;
        }
        return tentativi < 2;
      },
    },
    mutations: {
      retry: false,
    },
  },
});

/**
 * Tutte le chiavi in un posto solo: è quello che rende possibile invalidare
 * con precisione dopo una mutation invece di svuotare l'intera cache.
 */
export const chiavi = {
  dashboard: {
    sommario: (soglia: number) => ["dashboard", "sommario", soglia] as const,
  },
  appuntamenti: {
    elenco: (mese: string) => ["appuntamenti", mese] as const,
  },
  clienti: {
    tutti: ["clienti"] as const,
    elenco: (stato: string) => ["clienti", "elenco", stato] as const,
    dettaglio: (id: string) => ["clienti", "dettaglio", id] as const,
  },
  esercizi: {
    tutti: ["esercizi"] as const,
    elenco: (filtro: unknown) => ["esercizi", "elenco", filtro] as const,
    dettaglio: (id: string) => ["esercizi", "dettaglio", id] as const,
    utilizzi: (id: string) => ["esercizi", "utilizzi", id] as const,
    gruppi: ["esercizi", "gruppi"] as const,
  },
  schede: {
    tutte: ["schede"] as const,
    perCliente: (clientId: string) => ["schede", "cliente", clientId] as const,
    inScadenza: ["schede", "in-scadenza"] as const,
    dettaglio: (id: string) => ["schede", "dettaglio", id] as const,
    template: ["schede", "template"] as const,
  },
  impostazioni: ["impostazioni"] as const,
} as const;
