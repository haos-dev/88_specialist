import { supabase } from "@/lib/supabaseClient";
import { SOGLIA_REMINDER_DEFAULT } from "@/features/plans/planExpiry";
import type { Impostazioni } from "@/types/domain";
import { ErroreDati, traduciErrore } from "../errors";
import type { ImpostazioniApi } from "../types";

const CAMPI = "owner_id, reminder_days_before, calendar_feed_token";

function vuote(ownerId: string): Impostazioni {
  return {
    owner_id: ownerId,
    reminder_days_before: SOGLIA_REMINDER_DEFAULT,
    calendar_feed_token: null,
  };
}

async function ownerId(): Promise<string> {
  const { data } = await supabase().auth.getUser();
  if (!data.user)
    throw new ErroreDati(
      "autenticazione",
      "La sessione è scaduta. Accedi di nuovo.",
    );
  return data.user.id;
}

export const impostazioniSupabase: ImpostazioniApi = {
  async leggi() {
    const { data, error } = await supabase()
      .from("trainer_settings")
      .select(CAMPI)
      .maybeSingle();
    if (error) throw traduciErrore(error, "caricare le impostazioni");

    // Audit A7: la riga la crea un trigger su auth.users, ma un account creato
    // prima che il trigger esistesse non ce l'ha. Non è un errore da mostrare:
    // si restituiscono i valori vuoti e il primo salvataggio farà l'insert.
    if (!data) return vuote(await ownerId());
    return data as Impostazioni;
  },

  async salva(input) {
    const uid = await ownerId();
    const { data, error } = await supabase()
      .from("trainer_settings")
      .upsert({ ...input, owner_id: uid }, { onConflict: "owner_id" })
      .select(CAMPI)
      .single();
    if (error) throw traduciErrore(error, "salvare le impostazioni");
    return data as Impostazioni;
  },

  async rigeneraTokenCalendario() {
    const { data, error } = await supabase().rpc("rigenera_token_calendario");
    if (error) throw traduciErrore(error, "rigenerare il link del calendario");
    return data;
  },
};
