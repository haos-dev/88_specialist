import { supabase } from '@/lib/supabaseClient'
import type { Cliente } from '@/types/domain'
import { ErroreDati, traduciErrore } from '../errors'
import type { ClientiApi } from '../types'

/** PostgREST restituisce i conteggi annidati come `[{ count: n }]`. */
type ConConteggio = { workout_plans: { count: number }[] | null }

const CAMPI =
  'id, owner_id, first_name, last_name, email, phone, birth_date, height_cm, weight_kg, goal, notes, training_days, training_until, active, created_at, updated_at'

export const clientiSupabase: ClientiApi = {
  async elenco(filtro) {
    // Il filtro su `workout_plans.status` è su una risorsa annidata *senza*
    // `!inner`: restringe le righe contate, non i clienti restituiti — così un
    // cliente senza schede attive compare comunque, con conteggio 0.
    let q = supabase()
      .from('clients')
      .select(`${CAMPI}, workout_plans(count)`)
      .eq('workout_plans.status', 'active')
      .order('last_name', { ascending: true })
      .order('first_name', { ascending: true })

    if (filtro.stato === 'attivi') q = q.eq('active', true)
    if (filtro.stato === 'archiviati') q = q.eq('active', false)

    const { data, error } = await q
    if (error) throw traduciErrore(error, "caricare i clienti")

    return ((data ?? []) as unknown as (Cliente & ConConteggio)[]).map((riga) => {
      const { workout_plans, ...cliente } = riga
      return { ...cliente, schede_attive: workout_plans?.[0]?.count ?? 0 }
    })
  },

  async dettaglio(id) {
    const { data, error } = await supabase()
      .from('clients')
      .select(CAMPI)
      .eq('id', id)
      .maybeSingle()
    if (error) throw traduciErrore(error, 'caricare il cliente')
    return (data as Cliente) ?? null
  },

  async crea(input, lezioni = []) {
    if (lezioni.length > 0) {
      // Cliente e lezioni in un'unica transazione Postgres: con due chiamate
      // separate un errore sulla seconda lascerebbe il cliente senza lezioni.
      const { data, error } = await supabase().rpc('crea_cliente_con_lezioni', {
        p_cliente: { ...input },
        p_lezioni: lezioni.map((l) => ({ ...l })),
      })
      if (error) throw traduciErrore(error, 'creare il cliente e le sue lezioni')
      return data as unknown as Cliente
    }

    // `owner_id` non si passa mai dal client: in Postgres ha
    // `default auth.uid()` e la policy RLS lo verifica in `with check`.
    const { data, error } = await supabase()
      .from('clients')
      .insert(input)
      .select(CAMPI)
      .single()
    if (error) throw traduciErrore(error, 'creare il cliente')
    return data as Cliente
  },

  async aggiorna(id, input) {
    const { data, error } = await supabase()
      .from('clients')
      .update(input)
      .eq('id', id)
      .select(CAMPI)
      .single()
    if (error) throw traduciErrore(error, 'salvare il cliente')
    return data as Cliente
  },

  async aggiornaPreferenzeAllenamento(id, preferenze) {
    const { error } = await supabase().rpc("sostituisci_lezioni_cliente", {
      p_client_id: id,
      p_lezioni: preferenze.lezioni,
      p_training_days: preferenze.giorni,
      p_training_until: preferenze.fine,
    });
    if (error) throw traduciErrore(error, "aggiornare le preferenze di allenamento");
  },

  async impostaAttivo(id, attivo) {
    const { data, error } = await supabase()
      .from('clients')
      .update({ active: attivo })
      .eq('id', id)
      .select(CAMPI)
      .single()
    if (error) throw traduciErrore(error, attivo ? 'riattivare il cliente' : 'archiviare il cliente')
    return data as Cliente
  },

  async elimina(id) {
    // PRD §3.1: si elimina definitivamente solo ciò che è già archiviato.
    // Il vincolo è espresso nella query stessa (`.eq('active', false)`): se il
    // cliente è ancora attivo la delete non trova righe e non cancella nulla.
    const { data, error } = await supabase()
      .from('clients')
      .delete()
      .eq('id', id)
      .eq('active', false)
      .select('id')
    if (error) throw traduciErrore(error, 'eliminare il cliente')
    if (!data || data.length === 0) {
      throw new ErroreDati(
        'vincolo',
        'Puoi eliminare definitivamente solo un cliente già archiviato.',
      )
    }
  },
}
