import { supabase } from '@/lib/supabaseClient'
import type { Esercizio } from '@/types/domain'
import { ErroreDati, traduciErrore } from '../errors'
import type { EserciziApi } from '../types'

const CAMPI =
  'id, name, muscle_group, description, media_url, media_type, media_attribution, archived, created_at, updated_at'

/** `%` e `_` sono wildcard in ILIKE: vanno neutralizzati o "50%" cerca altro. */
function escapeLike(valore: string): string {
  return valore.replace(/[\\%_]/g, (carattere) => '\\' + carattere)
}

export const eserciziSupabase: EserciziApi = {
  async elenco(filtro) {
    // Audit B3: il dataset open source è di ~1300 righe con una gif ciascuna.
    // Filtro e paginazione stanno sul server; il client non li scarica mai tutti.
    const da = filtro.pagina * filtro.perPagina
    const a = da + filtro.perPagina - 1

    let q = supabase()
      .from('exercises')
      .select(CAMPI, { count: 'exact' })
      .order('name', { ascending: true })
      .range(da, a)

    if (filtro.gruppoMuscolare) q = q.eq('muscle_group', filtro.gruppoMuscolare)
    if (filtro.ricerca.trim()) q = q.ilike('name', `%${escapeLike(filtro.ricerca.trim())}%`)

    const { data, error, count } = await q
    if (error) throw traduciErrore(error, 'caricare gli esercizi')
    return { righe: (data ?? []) as Esercizio[], totale: count ?? 0 }
  },

  async dettaglio(id) {
    const { data, error } = await supabase()
      .from('exercises')
      .select(CAMPI)
      .eq('id', id)
      .maybeSingle()
    if (error) throw traduciErrore(error, "caricare l'esercizio")
    return (data as Esercizio) ?? null
  },

  async crea(input) {
    const { data, error } = await supabase()
      .from('exercises')
      .insert(input)
      .select(CAMPI)
      .single()
    if (error) throw traduciErrore(error, "creare l'esercizio")
    return data as Esercizio
  },

  async aggiorna(id, input) {
    const { data, error } = await supabase()
      .from('exercises')
      .update(input)
      .eq('id', id)
      .select(CAMPI)
      .single()
    if (error) throw traduciErrore(error, "salvare l'esercizio")
    return data as Esercizio
  },

  async utilizzi(id) {
    const { count, error } = await supabase()
      .from('workout_day_exercises')
      .select('id', { count: 'exact', head: true })
      .eq('exercise_id', id)
    if (error) throw traduciErrore(error, "verificare dove è usato l'esercizio")
    return count ?? 0
  },

  async elimina(id) {
    // Audit A2: la FK è `on delete restrict`, quindi Postgres rifiuta la
    // cancellazione se l'esercizio è in una scheda. La UI avvisa prima e
    // blocca l'eliminazione; qui traduciamo comunque il 23503.
    const { error } = await supabase().from('exercises').delete().eq('id', id)
    if (error) {
      const tradotto = traduciErrore(error, "eliminare l'esercizio")
      if (tradotto.causa === 'vincolo') {
        throw new ErroreDati(
          'vincolo',
          "Questo esercizio è usato in almeno una scheda. Toglilo dalle schede prima di eliminarlo, così restano leggibili.",
        )
      }
      throw tradotto
    }
  },

  async gruppiMuscolari() {
    // PostgREST non ha DISTINCT: si scaricano le sole etichette (stringhe
    // corte) e si deduplica qui. Il risultato viene tenuto in cache a lungo.
    const { data, error } = await supabase()
      .from('exercises')
      .select('muscle_group')
      .not('muscle_group', 'is', null)
    if (error) throw traduciErrore(error, 'caricare i gruppi muscolari')
    const unici = new Set(
      (data ?? []).map((r) => (r as { muscle_group: string }).muscle_group).filter(Boolean),
    )
    return [...unici].sort((a, b) => a.localeCompare(b, 'it'))
  },
}
