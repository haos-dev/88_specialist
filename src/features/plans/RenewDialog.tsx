import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input } from '@/components/ui/Field'
import { formatIntervallo } from '@/lib/dates'
import type { SchedaCompleta } from '@/types/domain'
import { calcolaDateRinnovo, titoloRinnovo } from './renewPlan'

const opzionale = z
  .string()
  .trim()
  .transform((v) => (v.length === 0 ? null : v))

const schema = z
  .object({
    titolo: z.string().trim().min(1, 'Dai un titolo alla nuova scheda.'),
    inizio: opzionale,
    fine: opzionale,
  })
  .refine((v) => !v.inizio || !v.fine || v.inizio <= v.fine, {
    message: 'La data di fine viene prima di quella di inizio.',
    path: ['fine'],
  })

type Campi = z.input<typeof schema>
type CampiPuliti = z.output<typeof schema>

interface RenewDialogProps {
  aperto: boolean
  scheda: SchedaCompleta
  inCorso?: boolean
  onConferma: (titolo: string, inizio: string | null, fine: string | null) => void
  onChiudi: () => void
}

/**
 * PRD §3.3 + audit B1. Il PRD dice "duplica con nuove date" senza dire quali:
 * qui vengono proposte (giorno dopo la fine, stessa durata) e restano
 * modificabili. Rinnovare **non** archivia l'originale: è un'azione a sé, e
 * ritrovarsi due schede attive è il comportamento voluto.
 */
export function RenewDialog({ aperto, scheda, inCorso, onConferma, onChiudi }: RenewDialogProps) {
  const proposta = calcolaDateRinnovo(scheda)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Campi, unknown, CampiPuliti>({
    resolver: zodResolver(schema),
    values: {
      titolo: titoloRinnovo(scheda.title),
      inizio: proposta.start_date ?? '',
      fine: proposta.end_date ?? '',
    },
  })

  const invia = handleSubmit((campi) => onConferma(campi.titolo, campi.inizio, campi.fine))

  const giorni = scheda.giorni.length
  const esercizi = scheda.giorni.reduce((somma, g) => somma + g.esercizi.length, 0)

  return (
    <Dialog
      aperto={aperto}
      titolo="Rinnova scheda"
      descrizione={`Crea una copia di "${scheda.title}" con ${giorni} ${giorni === 1 ? 'giorno' : 'giorni'} e ${esercizi} ${esercizi === 1 ? 'esercizio' : 'esercizi'}. La scheda attuale resta com'è: archiviala a parte, se vuoi.`}
      onChiudi={onChiudi}
      azioni={
        <>
          <Button onClick={onChiudi} disabled={inCorso}>
            Annulla
          </Button>
          <Button variante="primario" onClick={() => void invia()} disabled={inCorso}>
            {inCorso ? 'Rinnovo…' : 'Rinnova scheda'}
          </Button>
        </>
      }
    >
      <form onSubmit={invia} className="flex flex-col gap-4" noValidate>
        <p className="nums border-l-2 border-line pl-3 text-sm text-muted">
          Periodo attuale: {formatIntervallo(scheda.start_date, scheda.end_date)}
        </p>

        <Field label="Titolo della nuova scheda" obbligatorio errore={errors.titolo?.message}>
          {(props) => (
            <Input {...props} {...register('titolo')} autoFocus aria-invalid={Boolean(errors.titolo)} />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nuovo inizio" errore={errors.inizio?.message}>
            {(props) => <Input {...props} {...register('inizio')} type="date" />}
          </Field>
          <Field label="Nuova fine" errore={errors.fine?.message}>
            {(props) => (
              <Input {...props} {...register('fine')} type="date" aria-invalid={Boolean(errors.fine)} />
            )}
          </Field>
        </div>

        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
          Rinnova
        </button>
      </form>
    </Dialog>
  )
}
