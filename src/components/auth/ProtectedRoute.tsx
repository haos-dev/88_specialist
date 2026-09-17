import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Caricamento } from '@/components/ui/Stato'
import { useAuth } from './AuthProvider'

/**
 * Audit B7 — la rotta richiesta viene ricordata in `state.da`, così dopo il
 * login il trainer torna dov'era invece di essere scaricato in dashboard.
 */
export function ProtectedRoute() {
  const { sessione, inVerifica } = useAuth()
  const posizione = useLocation()

  if (inVerifica) {
    return (
      <div className="mx-auto max-w-column px-6 py-16">
        <Caricamento testo="Verifica dell'accesso…" />
      </div>
    )
  }

  if (!sessione) {
    return <Navigate to="/accedi" replace state={{ da: posizione.pathname + posizione.search }} />
  }

  return <Outlet />
}
