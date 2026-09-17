import { supabase } from "@/lib/supabaseClient";
import { getDaysInMonth } from "date-fns";
import type { Appuntamento, AppuntamentoInput } from "@/types/domain";
import { traduciErrore } from "../errors";
import type { AppuntamentiApi } from "../types";

const CAMPI =
  "id, owner_id, client_id, title, appointment_date, start_time, duration_minutes, notes, created_at, updated_at";

export const appuntamentiSupabase: AppuntamentiApi = {
  async elenco(mese) {
    const anno = Number(mese.slice(0, 4));
    const numeroMese = Number(mese.slice(5, 7));
    const inizio = `${mese}-01`;
    const fine = `${mese}-${String(getDaysInMonth(new Date(anno, numeroMese - 1, 1))).padStart(2, "0")}`;
    const { data, error } = await supabase()
      .from("appointments")
      .select(CAMPI)
      .gte("appointment_date", inizio)
      .lte("appointment_date", fine)
      .order("appointment_date")
      .order("start_time");
    if (error) throw traduciErrore(error, "caricare gli appuntamenti");
    return (data ?? []) as Appuntamento[];
  },
  async crea(input: AppuntamentoInput) {
    const { data, error } = await supabase()
      .from("appointments")
      .insert(input)
      .select(CAMPI)
      .single();
    if (error) throw traduciErrore(error, "creare l'appuntamento");
    return data as Appuntamento;
  },
  async elimina(id) {
    const { error } = await supabase()
      .from("appointments")
      .delete()
      .eq("id", id);
    if (error) throw traduciErrore(error, "eliminare l'appuntamento");
  },
};
