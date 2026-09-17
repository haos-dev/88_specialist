import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { useAuth } from '@/components/auth/AuthProvider'
import { messaggioErrore, inModalitaFixtures } from '@/data'
import { Caricamento } from '@/components/ui/Stato'

const schema = z.object({
  email: z.string().min(1, 'Inserisci la tua email.').email('Questo non è un indirizzo email valido.'),
  password: z.string().min(1, 'Inserisci la password.'),
})

type Campi = z.infer<typeof schema>

export default function Login() {
  const { sessione, inVerifica, accedi } = useAuth()
  const posizione = useLocation()
  const [erroreAccesso, setErroreAccesso] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Campi>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })

  if (inVerifica) {
    return (
      <div className="mx-auto max-w-sm px-6 py-16">
        <Caricamento testo="Un attimo…" />
      </div>
    )
  }

  if (sessione) {
    const da = (posizione.state as { da?: string } | null)?.da
    return <Navigate to={da && da !== '/accedi' ? da : '/'} replace />
  }

  const invia = handleSubmit(async ({ email, password }) => {
    setErroreAccesso(null)
    try {
      await accedi(email, password)
    } catch (errore) {
      setErroreAccesso(messaggioErrore(errore))
    }
  })

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="border-b-2 border-ink pb-3">
          <p className="display text-3xl leading-none text-ink">PT Manager</p>
          <p className="mt-2 text-sm text-muted">Schede di allenamento, clienti, libreria esercizi.</p>
        </div>

        <form onSubmit={invia} className="mt-7 flex flex-col gap-4" noValidate>
          <Field label="Email" errore={errors.email?.message}>
            {(props) => (
              <Input
                {...props}
                {...register('email')}
                type="email"
                autoComplete="username"
                autoFocus
                aria-invalid={Boolean(errors.email)}
              />
            )}
          </Field>

          <Field label="Password" errore={errors.password?.message}>
            {(props) => (
              <Input
                {...props}
                {...register('password')}
                type="password"
                autoComplete="current-password"
                aria-invalid={Boolean(errors.password)}
              />
            )}
          </Field>

          {erroreAccesso && (
            <p className="border-l-2 border-scaduta bg-scaduta-soft px-3 py-2 text-sm text-scaduta" role="alert">
              {erroreAccesso}
            </p>
          )}

          <Button type="submit" variante="primario" disabled={isSubmitting} className="mt-1 w-full">
            {isSubmitting ? 'Accesso in corso…' : 'Accedi'}
          </Button>
        </form>

        {/* Audit B6: con un solo account creato a mano, "password dimenticata"
            non può essere un vicolo cieco silenzioso. */}
        <p className="mt-6 border-t border-line pt-4 text-xs leading-relaxed text-muted">
          {inModalitaFixtures
            ? 'Modalità dati di esempio: entra con una qualsiasi email e una password di almeno 4 caratteri. Niente viene salvato su un server.'
            : 'Le credenziali te le fornisce chi ha configurato l’app. Se hai perso la password, contattalo: da qui non è possibile reimpostarla.'}
        </p>
      </div>
    </div>
  )
}
