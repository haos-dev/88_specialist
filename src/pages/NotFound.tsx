import { Link } from 'react-router-dom'
import { classiBottone } from '@/components/ui/buttonStyles'

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="max-w-md">
        <p className="display text-3xl leading-none text-ink">Questa pagina non esiste</p>
        <p className="mt-3 text-sm text-muted">
          L’indirizzo è sbagliato, oppure la cosa che cercavi è stata eliminata.
        </p>
        <Link to="/" className={classiBottone('primario', 'md', 'mt-6')}>
          Torna alla dashboard
        </Link>
      </div>
    </div>
  )
}
