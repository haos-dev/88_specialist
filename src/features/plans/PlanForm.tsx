import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input, Textarea } from '@/components/ui/Field'
import type { Scheda } from '@/types/domain'

const opzionale = z
  .string()
  .trim()
  .transform((v) => (v.length === 0 ? null : v))

const schema = z
  .object({
    title: z.string().trim().min(1, 'Dai un titolo alla scheda: ti servirà per riconoscerla.'),
    start_date: opzionale,
    end_date: opzionale,
    notes: opzionale,
  })
  .refine((v) => !v.start_date || !v.end_date || v.start_date <= v.end_date, {
    message: 'La data di fine viene prima di quella di inizio.',
    path: ['end_date'],
  })

type Campi = z.input<typeof schema>
export type DatiScheda = z.output<typeof schema>

interface PlanFormProps {
  aperto: boolean
  scheda?: Pick<Scheda, 'title' | 'start_date' | 'end_date' | 'notes'> | null
  inCorso?: boolean
  onSalva: (input: DatiScheda) => void
  onChiudi: () => void
}

export function PlanForm({ aperto, scheda, inCorso, onSalva, onChiudi }: PlanFormProps) {
  const modifica = Boolean(scheda)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Campi, unknown, DatiScheda>({
    resolver: zodResolver(schema),
    values: {
      title: scheda?.title ?? '',
      start_date: scheda?.start_date ?? '',
      end_date: scheda?.end_date ?? '',
      notes: scheda?.notes ?? '',
    },
  })

  const invia = handleSubmit((campi) => onSalva(campi))

  return (
    <Dialog
      aperto={aperto}
      titolo={modifica ? 'Modifica scheda' : 'Nuova scheda'}
      onChiudi={onChiudi}
      azioni={
        <>
          <Button onClick={onChiudi} disabled={inCorso}>
            Annulla
          </Button>
          <Button variante="primario" onClick={() => void invia()} disabled={inCorso}>
            {inCorso ? 'Salvataggio…' : modifica ? 'Salva modifiche' : 'Crea scheda'}
          </Button>
        </>
      }
    >
      <form onSubmit={invia} className="flex flex-col gap-4" noValidate>
        <Field label="Titolo" obbligatorio errore={errors.title?.message}>
          {(props) => (
            <Input
              {...props}
              {...register('title')}
              autoFocus
              placeholder="Es. Ipertrofia — blocco 1"
              aria-invalid={Boolean(errors.title)}
            />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Inizio" errore={errors.start_date?.message}>
            {(props) => <Input {...props} {...register('start_date')} type="date" />}
          </Field>
          <Field
            label="Fine"
            aiuto="Senza data di fine la scheda non entra nei promemoria di scadenza."
            errore={errors.end_date?.message}
          >
            {(props) => (
              <Input
                {...props}
                {...register('end_date')}
                type="date"
                aria-invalid={Boolean(errors.end_date)}
              />
            )}
          </Field>
        </div>

        <Field label="Note" aiuto="Compaiono anche sul foglio stampato.">
          {(props) => <Textarea {...props} {...register('notes')} rows={3} />}
        </Field>

        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
          Salva
        </button>
      </form>
    </Dialog>
  )
}
