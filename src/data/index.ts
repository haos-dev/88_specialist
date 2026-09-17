import { supabaseConfigurato } from "@/lib/supabaseClient";
import { authSupabase } from "./supabase/auth";
import { appuntamentiSupabase } from "./supabase/appuntamenti";
import { dashboardSupabase } from "./supabase/dashboard";
import { clientiSupabase } from "./supabase/clienti";
import { eserciziSupabase } from "./supabase/esercizi";
import { impostazioniSupabase } from "./supabase/impostazioni";
import { schedeSupabase } from "./supabase/schede";
import { dataLayerFixtures } from "./fixtures";
import type { DataLayer } from "./types";

/**
 * L'unico punto in cui l'app decide con chi sta parlando.
 *
 * Pagine e hook importano sempre e solo da `@/data`: sotto può esserci
 * Supabase o i dati finti, e nessuna schermata deve accorgersene. Quando il
 * wiring è finito basta mettere `VITE_USE_FIXTURES=false` in `.env` e
 * cancellare `src/data/fixtures/`.
 */

const richiesteFixtures = import.meta.env.VITE_USE_FIXTURES === "true";

// Se le chiavi mancano si resta comunque sui fixtures: meglio un'app che
// funziona su dati di esempio che una schermata bianca con un errore di
// configurazione.
const usaFixtures = richiesteFixtures || !supabaseConfigurato();

const dataLayerSupabase: DataLayer = {
  auth: authSupabase,
  dashboard: dashboardSupabase,
  appuntamenti: appuntamentiSupabase,
  clienti: clientiSupabase,
  esercizi: eserciziSupabase,
  schede: schedeSupabase,
  impostazioni: impostazioniSupabase,
  fixtures: false,
};

export const dati: DataLayer = usaFixtures
  ? dataLayerFixtures
  : dataLayerSupabase;

export const inModalitaFixtures = usaFixtures;

export * from "./errors";
export type * from "./types";
