import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input, Select } from '@/components/ui/Field'
import type { Cliente, TemplateSintesi } from '@/types/domain'

const opzionale = z
  .string()
  .trim()
  .transform((v) => (v.length === 0 ? null : v))

const schema = z
  .object({
    client_id: z.string().trim().min(1, 'Scegli il cliente a cui destinare la scheda.'),
    titolo: z.string().trim().min(1, 'Dai un titolo alla scheda.'),
    inizio: opzionale,
    fine: opzionale,
  })
  .refine((v) => !v.inizio || !v.fine || v.inizio <= v.fine, {
    message: 'La data di fine viene prima di quella di inizio.',
    path: ['fine'],
  })

type Campi = z.input<typeof schema>
type CampiPuliti = z.output<typeof schema>

interface ApplyTemplateDialogProps {
  aperto: boolean
  template: TemplateSintesi
  clienti: Pick<Cliente, 'id' | 'first_name' | 'last_name'>[]
  inCorso?: boolean
  onConferma: (clientId: string, titolo: string, inizio: string | null, fine: string | null) => void
  onChiudi: () => void
}

/**
 * §3.7bis: copia il template su un cliente specifico. Stessa forma di
 * RenewDialog (di cui questo è concettualmente il gemello), con in più la
 * scelta del cliente — qui non c'è "un" cliente di partenza da cui proporre
 * le date, quindi i campi data restano vuoti finché il trainer non li
 * compila (a differenza del rinnovo, che le propone già).
 */
export function ApplyTemplateDialog({
  aperto,
  template,
  clienti,
  inCorso,
  onConferma,
  onChiudi,
}: ApplyTemplateDialogProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Campi, unknown, CampiPuliti>({
    resolver: zodResolver(schema),
    values: {
      client_id: '',
      titolo: template.title,
      inizio: '',
      fine: '',
    },
  })

  const invia = handleSubmit((campi) =>
    onConferma(campi.client_id, campi.titolo, campi.inizio, campi.fine),
  )

  return (
    <Dialog
      aperto={aperto}
      titolo="Applica a un cliente"
      descrizione={`Crea una copia di "${template.title}" (${template.giorni_count} ${template.giorni_count === 1 ? 'giorno' : 'giorni'}, ${template.esercizi_count} ${template.esercizi_count === 1 ? 'esercizio' : 'esercizi'}) per il cliente scelto. Il template resta invariato: puoi riapplicarlo quante volte vuoi.`}
      onChiudi={onChiudi}
      azioni={
        <>
          <Button onClick={onChiudi} disabled={inCorso}>
            Annulla
          </Button>
          <Button variante="primario" onClick={() => void invia()} disabled={inCorso}>
            {inCorso ? 'Applico…' : 'Applica template'}
          </Button>
        </>
      }
    >
      <form onSubmit={invia} className="flex flex-col gap-4" noValidate>
        <Field label="Cliente" obbligatorio errore={errors.client_id?.message}>
          {(props) => (
            <Select {...props} {...register('client_id')} aria-invalid={Boolean(errors.client_id)}>
              <option value="">Scegli un cliente…</option>
              {clienti.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.last_name} {c.first_name}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="Titolo della nuova scheda" obbligatorio errore={errors.titolo?.message}>
          {(props) => (
            <Input {...props} {...register('titolo')} aria-invalid={Boolean(errors.titolo)} />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Inizio" errore={errors.inizio?.message}>
            {(props) => <Input {...props} {...register('inizio')} type="date" />}
          </Field>
          <Field
            label="Fine"
            aiuto="Senza data di fine la scheda non entra nei promemoria di scadenza."
            errore={errors.fine?.message}
          >
            {(props) => (
              <Input {...props} {...register('fine')} type="date" aria-invalid={Boolean(errors.fine)} />
            )}
          </Field>
        </div>

        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
          Applica
        </button>
      </form>
    </Dialog>
  )
}
