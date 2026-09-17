import { oggi, spostaData, toDataISO } from "@/lib/dates";
import { supabase } from "@/lib/supabaseClient";
import type { DashboardApi } from "../types";
import { traduciErrore } from "../errors";

const CONTEGGIO = { count: "exact", head: true } as const;

export const dashboardSupabase: DashboardApi = {
  async sommario(sogliaGiorni) {
    const oggiISO = toDataISO(oggi());
    const limite = spostaData(oggiISO, Math.max(0, sogliaGiorni));

    const [clienti, attive, scadute, inScadenza] = await Promise.all([
      supabase().from("clients").select("*", CONTEGGIO).eq("active", true),
      supabase()
        .from("workout_plans")
        .select("*, clients!inner(*)", CONTEGGIO)
        .eq("status", "active")
        .eq("clients.active", true),
      supabase()
        .from("workout_plans")
        .select("*, clients!inner(*)", CONTEGGIO)
        .eq("status", "active")
        .eq("clients.active", true)
        .lt("end_date", oggiISO),
      supabase()
        .from("workout_plans")
        .select("*, clients!inner(*)", CONTEGGIO)
        .eq("status", "active")
        .eq("clients.active", true)
        .gte("end_date", oggiISO)
        .lte("end_date", limite),
    ]);

    const errore =
      clienti.error ?? attive.error ?? scadute.error ?? inScadenza.error;
    if (errore)
      throw traduciErrore(errore, "caricare il riepilogo della dashboard");

    return {
      clientiAttivi: clienti.count ?? 0,
      schedeAttive: attive.count ?? 0,
      schedeScadute: scadute.count ?? 0,
      schedeInScadenza: inScadenza.count ?? 0,
    };
  },
};
