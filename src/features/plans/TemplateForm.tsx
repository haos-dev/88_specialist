import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input, Textarea } from '@/components/ui/Field'
import type { TemplateSintesi } from '@/types/domain'

const opzionale = z
  .string()
  .trim()
  .transform((v) => (v.length === 0 ? null : v))

const schema = z.object({
  title: z.string().trim().min(1, 'Dai un titolo al template: ti servirà per riconoscerlo.'),
  notes: opzionale,
})

type Campi = z.input<typeof schema>
export type DatiTemplate = z.output<typeof schema>

interface TemplateFormProps {
  aperto: boolean
  template?: Pick<TemplateSintesi, 'title' | 'notes'> | null
  inCorso?: boolean
  onSalva: (input: DatiTemplate) => void
  onChiudi: () => void
}

/**
 * Gemello di PlanForm, senza le date: un template non è legato a un periodo
 * (§3.7bis) — le date si decidono al momento di applicarlo a un cliente, in
 * ApplyTemplateDialog.
 */
export function TemplateForm({ aperto, template, inCorso, onSalva, onChiudi }: TemplateFormProps) {
  const modifica = Boolean(template)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Campi, unknown, DatiTemplate>({
    resolver: zodResolver(schema),
    values: {
      title: template?.title ?? '',
      notes: template?.notes ?? '',
    },
  })

  const invia = handleSubmit((campi) => onSalva(campi))

  return (
    <Dialog
      aperto={aperto}
      titolo={modifica ? 'Modifica template' : 'Nuovo template'}
      onChiudi={onChiudi}
      azioni={
        <>
          <Button onClick={onChiudi} disabled={inCorso}>
            Annulla
          </Button>
          <Button variante="primario" onClick={() => void invia()} disabled={inCorso}>
            {inCorso ? 'Salvataggio…' : modifica ? 'Salva modifiche' : 'Crea template'}
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
              placeholder="Es. Full body — 3 giorni"
              aria-invalid={Boolean(errors.title)}
            />
          )}
        </Field>

        <Field label="Note" aiuto="Passano alla scheda quando applichi il template a un cliente.">
          {(props) => <Textarea {...props} {...register('notes')} rows={3} />}
        </Field>

        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
          Salva
        </button>
      </form>
    </Dialog>
  )
}
