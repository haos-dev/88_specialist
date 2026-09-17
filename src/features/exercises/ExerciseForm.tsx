import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { GRUPPI_MUSCOLARI, type Esercizio, type EsercizioInput } from '@/types/domain'

const opzionale = z
  .string()
  .trim()
  .transform((v) => (v.length === 0 ? null : v))

const schema = z.object({
  name: z.string().trim().min(1, 'Il nome serve per ritrovare l’esercizio nella libreria.'),
  muscle_group: opzionale,
  description: opzionale,
  media_url: opzionale.refine((v) => v === null || /^https?:\/\/|^data:/.test(v), {
    message: 'Serve un indirizzo che inizi con http:// o https://',
  }),
})

type Campi = z.input<typeof schema>
type CampiPuliti = z.output<typeof schema>

interface ExerciseFormProps {
  aperto: boolean
  esercizio?: Esercizio | null
  inCorso?: boolean
  gruppi: string[]
  onSalva: (input: EsercizioInput) => void
  onChiudi: () => void
}

export function ExerciseForm({
  aperto,
  esercizio,
  inCorso,
  gruppi,
  onSalva,
  onChiudi,
}: ExerciseFormProps) {
  const modifica = Boolean(esercizio)

  // I gruppi già presenti nel database più quelli previsti: un dataset
  // importato può portare etichette che non avevamo elencato noi.
  const opzioni = [...new Set([...GRUPPI_MUSCOLARI, ...gruppi])].sort((a, b) =>
    a.localeCompare(b, 'it'),
  )

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<Campi, unknown, CampiPuliti>({
    resolver: zodResolver(schema),
    values: {
      name: esercizio?.name ?? '',
      muscle_group: esercizio?.muscle_group ?? '',
      description: esercizio?.description ?? '',
      media_url: esercizio?.media_url ?? '',
    },
  })

  const anteprima = watch('media_url')

  const invia = handleSubmit((dati) => {
    onSalva({
      ...dati,
      // Il tipo lo deduciamo dall'estensione: serve solo a sapere se è una gif.
      media_type: dati.media_url
        ? /\.gif($|\?)/i.test(dati.media_url)
          ? 'image/gif'
          : 'image'
        : null,
      media_attribution: esercizio?.media_attribution ?? null,
    })
  })

  return (
    <Dialog
      aperto={aperto}
      titolo={modifica ? 'Modifica esercizio' : 'Nuovo esercizio'}
      onChiudi={onChiudi}
      azioni={
        <>
          <Button onClick={onChiudi} disabled={inCorso}>
            Annulla
          </Button>
          <Button variante="primario" onClick={() => void invia()} disabled={inCorso}>
            {inCorso ? 'Salvataggio…' : modifica ? 'Salva modifiche' : 'Crea esercizio'}
          </Button>
        </>
      }
    >
      <form onSubmit={invia} className="flex flex-col gap-4" noValidate>
        <Field label="Nome" obbligatorio errore={errors.name?.message}>
          {(props) => (
            <Input {...props} {...register('name')} autoFocus aria-invalid={Boolean(errors.name)} />
          )}
        </Field>

        <Field label="Gruppo muscolare" errore={errors.muscle_group?.message}>
          {(props) => (
            <Select {...props} {...register('muscle_group')} className="sm:max-w-64">
              <option value="">Non indicato</option>
              {opzioni.map((gruppo) => (
                <option key={gruppo} value={gruppo}>
                  {gruppo}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field
          label="Immagine o gif"
          aiuto="Indirizzo pubblico del file. Le immagini della libreria importata sono già compilate."
          errore={errors.media_url?.message}
        >
          {(props) => (
            <Input
              {...props}
              {...register('media_url')}
              type="url"
              placeholder="https://…"
              aria-invalid={Boolean(errors.media_url)}
            />
          )}
        </Field>

        {anteprima && !errors.media_url && (
          <img
            src={anteprima}
            alt=""
            className="h-28 w-36 border border-line object-cover"
            onError={(e) => {
              e.currentTarget.style.visibility = 'hidden'
            }}
          />
        )}

        <Field label="Descrizione" aiuto="Come si esegue. Compare sul foglio stampato.">
          {(props) => <Textarea {...props} {...register('description')} rows={4} />}
        </Field>

        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
          Salva
        </button>
      </form>
    </Dialog>
  )
}
