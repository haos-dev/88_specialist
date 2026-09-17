import { supabase } from '@/lib/supabaseClient'
import { ErroreDati, traduciErrore } from '../errors'
import type { AuthApi, Sessione } from '../types'

function mappa(user: { id: string; email?: string | null } | null | undefined): Sessione | null {
  if (!user) return null
  return { userId: user.id, email: user.email ?? '' }
}

export const authSupabase: AuthApi = {
  async sessioneCorrente() {
    const { data } = await supabase().auth.getSession()
    return mappa(data.session?.user)
  },

  async accedi(email, password) {
    const { data, error } = await supabase().auth.signInWithPassword({ email, password })
    if (error) {
      // Supabase risponde sempre "Invalid login credentials", senza distinguere
      // fra email inesistente e password sbagliata. È voluto (non rivela quali
      // account esistono) e il messaggio va riscritto in italiano.
      if (/invalid login credentials/i.test(error.message)) {
        throw new ErroreDati('autenticazione', 'Email o password non corretti.')
      }
      if (/email not confirmed/i.test(error.message)) {
        throw new ErroreDati(
          'autenticazione',
          "L'account non è ancora confermato. Contatta chi ha configurato l'app.",
        )
      }
      throw traduciErrore(error, "accedere")
    }
    const sessione = mappa(data.user)
    if (!sessione) throw new ErroreDati('autenticazione', "L'accesso non è andato a buon fine.")
    return sessione
  },

  async esci() {
    const { error } = await supabase().auth.signOut()
    if (error) throw traduciErrore(error, 'uscire')
  },

  osservaSessione(callback) {
    const { data } = supabase().auth.onAuthStateChange((_evento, session) => {
      callback(mappa(session?.user))
    })
    return () => data.subscription.unsubscribe()
  },
}
