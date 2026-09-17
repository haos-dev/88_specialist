import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { Caricamento } from '@/components/ui/Stato'

// Ogni pagina è un chunk a sé: l'app shell precaricata dal service worker
// resta piccola, e chi apre solo l'anteprima di stampa non scarica il builder.
const Login = lazy(() => import('@/pages/Login'))
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Clients = lazy(() => import('@/pages/Clients'))
const ClientDetail = lazy(() => import('@/pages/ClientDetail'))
const Exercises = lazy(() => import('@/pages/Exercises'))
const WorkoutBuilder = lazy(() => import('@/pages/WorkoutBuilder'))
const PrintPlan = lazy(() => import('@/pages/PrintPlan'))
const Settings = lazy(() => import('@/pages/Settings'))
const NotFound = lazy(() => import('@/pages/NotFound'))

export function App() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-column px-6 py-16">
          <Caricamento />
        </div>
      }
    >
      <Routes>
        <Route path="/accedi" element={<Login />} />

        <Route element={<ProtectedRoute />}>
          {/* L'anteprima di stampa vive fuori dal layout: nessuna navigazione
              da nascondere, solo il foglio (PRD §3.4). */}
          <Route path="/schede/:id/stampa" element={<PrintPlan />} />

          <Route element={<AppLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="clienti" element={<Clients />} />
            <Route path="clienti/:id" element={<ClientDetail />} />
            <Route path="esercizi" element={<Exercises />} />
            <Route path="schede/:id" element={<WorkoutBuilder />} />
            <Route path="impostazioni" element={<Settings />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}
