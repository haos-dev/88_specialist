import { supabase } from '@/lib/supabaseClient'
import { oggi, spostaData, toDataISO } from '@/lib/dates'
import type { GiornoEspanso, Scheda, SchedaCompleta, SchedaSintesi } from '@/types/domain'
import { ErroreDati, traduciErrore } from '../errors'
import type { SchedeApi } from '../types'

const CAMPI_SCHEDA =
  'id, owner_id, client_id, title, start_date, end_date, notes, status, created_at, updated_at'

type RigaSintesi = Scheda & {
  clients: { first_name: string; last_name: string; active: boolean } | null
  workout_days: { count: number }[] | null
}

function aSintesi(riga: RigaSintesi): SchedaSintesi {
  const { clients, workout_days, ...scheda } = riga
  return {
    ...scheda,
    cliente_nome: clients ? `${clients.first_name} ${clients.last_name}`.trim() : '—',
    giorni_count: workout_days?.[0]?.count ?? 0,
  }
}

export const schedeSupabase: SchedeApi = {
  async elencoPerCliente(clientId) {
    const { data, error } = await supabase()
      .from('workout_plans')
      .select(`${CAMPI_SCHEDA}, clients(first_name, last_name, active), workout_days(count)`)
      .eq('client_id', clientId)
      .order('status', { ascending: true })
      .order('end_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
    if (error) throw traduciErrore(error, 'caricare le schede del cliente')
    return ((data ?? []) as unknown as RigaSintesi[]).map(aSintesi)
  },

  async inScadenza(sogliaGiorni) {
    // PRD §3.6: solo schede `active`, di clienti `active`, con `end_date`.
    // Il limite superiore è oggi + soglia; non c'è limite inferiore, perché le
    // schede già scadute devono continuare a comparire finché non si agisce.
    // `clients!inner` è deliberato: qui il filtro sul cliente deve *escludere*
    // la scheda, non solo svuotare la relazione annidata.
    const limite = spostaData(toDataISO(oggi()), Math.max(0, sogliaGiorni))

    const { data, error } = await supabase()
      .from('workout_plans')
      .select(
        `${CAMPI_SCHEDA}, clients!inner(first_name, last_name, active), workout_days(count)`,
      )
      .eq('status', 'active')
      .eq('clients.active', true)
      .not('end_date', 'is', null)
      .lte('end_date', limite)
      .order('end_date', { ascending: true })
    if (error) throw traduciErrore(error, 'caricare le schede in scadenza')
    return ((data ?? []) as unknown as RigaSintesi[]).map(aSintesi)
  },

  async dettaglio(id) {
    const select = [
      CAMPI_SCHEDA,
      'cliente:clients(id, first_name, last_name, email, phone, active)',
      'giorni:workout_days(id, plan_id, day_order, day_name,' +
        ' esercizi:workout_day_exercises(id, day_id, exercise_id, order_index, sets, reps,' +
        ' rest_seconds, tempo, notes, esercizio:exercises(*)))',
    ].join(', ')

    const { data, error } = await supabase()
      .from('workout_plans')
      .select(select)
      .eq('id', id)
      .maybeSingle()
    if (error) throw traduciErrore(error, 'caricare la scheda')
    if (!data) return null

    const scheda = data as unknown as SchedaCompleta
    // PostgREST non garantisce l'ordine delle risorse annidate su due livelli,
    // e qui l'ordine *è* la scheda: lo imponiamo noi.
    const giorni: GiornoEspanso[] = [...(scheda.giorni ?? [])]
      .sort((a, b) => a.day_order - b.day_order)
      .map((g) => ({
        ...g,
        esercizi: [...(g.esercizi ?? [])].sort((a, b) => a.order_index - b.order_index),
      }))

    return { ...scheda, giorni }
  },

  async crea(input) {
    const { data, error } = await supabase()
      .from('workout_plans')
      .insert(input)
      .select(CAMPI_SCHEDA)
      .single()
    if (error) throw traduciErrore(error, 'creare la scheda')
    return data as Scheda
  },

  async aggiorna(id, input) {
    const { data, error } = await supabase()
      .from('workout_plans')
      .update(input)
      .eq('id', id)
      .select(CAMPI_SCHEDA)
      .single()
    if (error) throw traduciErrore(error, 'salvare la scheda')
    return data as Scheda
  },

  async impostaStato(id, stato) {
    const { data, error } = await supabase()
      .from('workout_plans')
      .update({ status: stato })
      .eq('id', id)
      .select(CAMPI_SCHEDA)
      .single()
    if (error) {
      throw traduciErrore(
        error,
        stato === 'archived' ? 'archiviare la scheda' : 'riattivare la scheda',
      )
    }
    return data as Scheda
  },

  async elimina(id) {
    // PRD §3.3, stessa convenzione dei Clienti: hard delete solo se archiviata.
    // Il vincolo sta nella query: se la scheda è attiva, non trova righe.
    const { data, error } = await supabase()
      .from('workout_plans')
      .delete()
      .eq('id', id)
      .eq('status', 'archived')
      .select('id')
    if (error) throw traduciErrore(error, 'eliminare la scheda')
    if (!data || data.length === 0) {
      throw new ErroreDati(
        'vincolo',
        'Puoi eliminare definitivamente solo una scheda già archiviata.',
      )
    }
  },

  async rinnova(id, titolo, inizio, fine) {
    // Audit B1: copia profonda in una sola transazione lato Postgres. Farla
    // client-side vorrebbe dire 3+ round-trip non transazionali, e un errore a
    // metà lascerebbe una scheda senza esercizi.
    const { data, error } = await supabase().rpc('rinnova_scheda', {
      p_plan_id: id,
      p_titolo: titolo,
      p_inizio: inizio,
      p_fine: fine,
    })
    if (error) throw traduciErrore(error, 'rinnovare la scheda')
    return data as unknown as Scheda
  },

  /* --------------------------------------------------------------- giorni */

  async aggiungiGiorno(planId, nome) {
    const { data: ultimo, error: erroreLettura } = await supabase()
      .from('workout_days')
      .select('day_order')
      .eq('plan_id', planId)
      .order('day_order', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (erroreLettura) throw traduciErrore(erroreLettura, 'aggiungere il giorno')

    const { error } = await supabase()
      .from('workout_days')
      .insert({ plan_id: planId, day_name: nome, day_order: (ultimo?.day_order ?? -1) + 1 })
    if (error) throw traduciErrore(error, 'aggiungere il giorno')
  },

  async rinominaGiorno(dayId, nome) {
    const { error } = await supabase()
      .from('workout_days')
      .update({ day_name: nome })
      .eq('id', dayId)
    if (error) throw traduciErrore(error, 'rinominare il giorno')
  },

  async eliminaGiorno(dayId) {
    const { error } = await supabase().from('workout_days').delete().eq('id', dayId)
    if (error) throw traduciErrore(error, 'eliminare il giorno')
  },

  async riordinaGiorni(planId, posizioni) {
    if (posizioni.length === 0) return
    const { error } = await supabase().rpc('riordina_giorni', {
      p_plan_id: planId,
      p_ids: posizioni.map((p) => p.id),
      p_posizioni: posizioni.map((p) => p.position),
    })
    if (error) throw traduciErrore(error, 'riordinare i giorni')
  },

  /* ------------------------------------------------------------- esercizi */

  async aggiungiEsercizio(dayId, exerciseId) {
    const { data: ultimo, error: erroreLettura } = await supabase()
      .from('workout_day_exercises')
      .select('order_index')
      .eq('day_id', dayId)
      .order('order_index', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (erroreLettura) throw traduciErrore(erroreLettura, "aggiungere l'esercizio")

    const { error } = await supabase().from('workout_day_exercises').insert({
      day_id: dayId,
      exercise_id: exerciseId,
      order_index: (ultimo?.order_index ?? -1) + 1,
    })
    if (error) throw traduciErrore(error, "aggiungere l'esercizio")
  },

  async aggiornaEsercizio(rowId, input) {
    const { error } = await supabase()
      .from('workout_day_exercises')
      .update(input)
      .eq('id', rowId)
    if (error) throw traduciErrore(error, "salvare l'esercizio")
  },

  async rimuoviEsercizio(rowId) {
    const { error } = await supabase().from('workout_day_exercises').delete().eq('id', rowId)
    if (error) throw traduciErrore(error, "rimuovere l'esercizio")
  },

  async riordinaEsercizi(dayId, posizioni) {
    if (posizioni.length === 0) return
    const { error } = await supabase().rpc('riordina_esercizi', {
      p_day_id: dayId,
      p_ids: posizioni.map((p) => p.id),
      p_posizioni: posizioni.map((p) => p.position),
    })
    if (error) throw traduciErrore(error, 'riordinare gli esercizi')
  },
}
