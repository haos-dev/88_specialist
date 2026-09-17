import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export function supabaseConfigurato(): boolean {
  return Boolean(URL && ANON_KEY)
}

let istanza: SupabaseClient<Database> | null = null

/**
 * Client creato al primo uso, non all'import: in modalità fixtures il modulo
 * viene comunque caricato dal bundler e non deve esplodere solo perché le
 * variabili d'ambiente sono vuote.
 *
 * La anon key è pubblica per progetto: finisce nel bundle del browser e va
 * bene così. È la Row Level Security a decidere cosa può leggere, non la
 * segretezza della chiave. La `service_role key` invece non deve mai entrare
 * in questo file — vive solo in `supabase/seed/`.
 */
export function supabase(): SupabaseClient<Database> {
  if (!istanza) {
    if (!URL || !ANON_KEY) {
      throw new Error(
        'Supabase non è configurato: imposta VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY in .env, ' +
          'oppure lascia VITE_USE_FIXTURES=true per lavorare sui dati di esempio.',
      )
    }
    istanza = createClient<Database>(URL, ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  }
  return istanza
}
