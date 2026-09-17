import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { dati, type Sessione } from '@/data'

interface ContestoAuth {
  sessione: Sessione | null
  /** true finché non sappiamo se esiste una sessione: evita di sbattere fuori chi è già dentro. */
  inVerifica: boolean
  accedi: (email: string, password: string) => Promise<void>
  esci: () => Promise<void>
}

const Contesto = createContext<ContestoAuth | null>(null)

/**
 * Audit B7 — la sessione va osservata, non letta una volta sola all'avvio:
 * quando il token scade Supabase emette `SIGNED_OUT` e l'app deve accorgersene
 * da sola, invece di lasciare il trainer davanti a schermate che falliscono.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessione, setSessione] = useState<Sessione | null>(null)
  const [inVerifica, setInVerifica] = useState(true)
  const queryClient = useQueryClient()

  useEffect(() => {
    let attivo = true

    dati.auth
      .sessioneCorrente()
      .then((s) => {
        if (attivo) setSessione(s)
      })
      .catch(() => {
        if (attivo) setSessione(null)
      })
      .finally(() => {
        if (attivo) setInVerifica(false)
      })

    const annulla = dati.auth.osservaSessione((s) => {
      if (!attivo) return
      setSessione(s)
      // Cambiare identità significa cambiare dati: la cache precedente non vale più.
      if (!s) queryClient.clear()
    })

    return () => {
      attivo = false
      annulla()
    }
  }, [queryClient])

  const accedi = useCallback(async (email: string, password: string) => {
    const s = await dati.auth.accedi(email, password)
    setSessione(s)
  }, [])

  const esci = useCallback(async () => {
    await dati.auth.esci()
    setSessione(null)
    queryClient.clear()
  }, [queryClient])

  const valore = useMemo<ContestoAuth>(
    () => ({ sessione, inVerifica, accedi, esci }),
    [sessione, inVerifica, accedi, esci],
  )

  return <Contesto.Provider value={valore}>{children}</Contesto.Provider>
}

export function useAuth(): ContestoAuth {
  const contesto = useContext(Contesto)
  if (!contesto) throw new Error('useAuth va usato dentro <AuthProvider>')
  return contesto
}
