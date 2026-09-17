import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { Caricamento, Errore, Vuoto } from '@/components/ui/Stato'
import { useToast } from '@/components/ui/Toast'
import { ExercisePicker } from '@/features/exercises/ExercisePicker'
import { DayCard } from '@/features/plans/DayCard'
import { PlanForm } from '@/features/plans/PlanForm'
import { PlanHeading } from '@/features/plans/PlanHeading'
import { RenewDialog } from '@/features/plans/RenewDialog'
import { calcolaScadenza } from '@/features/plans/planExpiry'
import { riordinoMinimo, spostaElemento } from '@/features/plans/reorder'
import {
  useAggiornaRigaEsercizio,
  useAggiornaScheda,
  useAggiungiEsercizio,
  useAggiungiGiorno,
  useCambiaStatoScheda,
  useEliminaGiorno,
  useEliminaScheda,
  useRimuoviEsercizio,
  useRinnovaScheda,
  useRinominaGiorno,
  useRiordinaEsercizi,
  useRiordinaGiorni,
  useScheda,
} from '@/features/plans/usePlans'
import { useSogliaReminder } from '@/features/settings/useSettings'
import { messaggioErrore } from '@/data'
import type { GiornoEspanso } from '@/types/domain'

export default function WorkoutBuilder() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const soglia = useSogliaReminder()

  const scheda = useScheda(id)

  const aggiorna = useAggiornaScheda()
  const cambiaStato = useCambiaStatoScheda()
  const elimina = useEliminaScheda()
  const rinnova = useRinnovaScheda()
  const aggiungiGiorno = useAggiungiGiorno(id)
  const rinominaGiorno = useRinominaGiorno(id)
  const eliminaGiorno = useEliminaGiorno(id)
  const aggiungiEsercizio = useAggiungiEsercizio(id)
  const aggiornaRiga = useAggiornaRigaEsercizio(id)
  const rimuoviRiga = useRimuoviEsercizio(id)
  const riordinaGiorni = useRiordinaGiorni(id)
  const riordinaEsercizi = useRiordinaEsercizi(id)

  const [formAperto, setFormAperto] = useState(false)
  const [rinnovoAperto, setRinnovoAperto] = useState(false)
  const [giornoDaEliminare, setGiornoDaEliminare] = useState<GiornoEspanso | null>(null)
  const [confermaEliminazione, setConfermaEliminazione] = useState(false)
  const [giornoPerPicker, setGiornoPerPicker] = useState<GiornoEspanso | null>(null)

  const sensori = useSensors(
    // 5px di soglia: un clic dentro un campo non deve diventare un trascinamento.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  if (scheda.isLoading) return <Caricamento />
  if (scheda.error) return <Errore errore={scheda.error} onRiprova={() => void scheda.refetch()} />
  if (!scheda.data) {
    return (
      <Vuoto
        titolo="Questa scheda non esiste"
        descrizione="Potrebbe essere stata eliminata."
        azione={
          <Link to="/clienti" className="text-sm text-accent underline underline-offset-4">
            Torna ai clienti
          </Link>
        }
      />
    )
  }

  const s = scheda.data
  const clienteNome = `${s.cliente.first_name} ${s.cliente.last_name}`.trim()
  const scadenza = calcolaScadenza(
    { end_date: s.end_date, status: s.status, clienteAttivo: s.cliente.active },
    soglia,
  )
  const erroreToast = (errore: unknown) => toast.errore(messaggioErrore(errore))

  /**
   * PRD §3.3: si riordina solo dentro il proprio contenitore — i giorni fra
   * loro, gli esercizi dentro il proprio giorno. Un trascinamento che
   * attraversa i confini viene semplicemente ignorato.
   */
  function alTermineDelDrag(evento: DragEndEvent) {
    const { active, over } = evento
    if (!over || active.id === over.id) return

    const tipo = active.data.current?.tipo

    if (tipo === 'giorno' && over.data.current?.tipo === 'giorno') {
      const da = s.giorni.findIndex((g) => g.id === active.id)
      const a = s.giorni.findIndex((g) => g.id === over.id)
      if (da < 0 || a < 0) return
      const nuovoOrdine = spostaElemento(s.giorni, da, a)
      const posizioni = riordinoMinimo(
        s.giorni.map((g) => ({ id: g.id, position: g.day_order })),
        nuovoOrdine,
      )
      riordinaGiorni.mutate({ nuovoOrdine, posizioni }, { onError: erroreToast })
      return
    }

    if (tipo === 'esercizio') {
      const dayId = active.data.current?.dayId as string | undefined
      if (!dayId || over.data.current?.dayId !== dayId) return
      const giorno = s.giorni.find((g) => g.id === dayId)
      if (!giorno) return
      const da = giorno.esercizi.findIndex((e) => e.id === active.id)
      const a = giorno.esercizi.findIndex((e) => e.id === over.id)
      if (da < 0 || a < 0) return
      const nuovoOrdine = spostaElemento(giorno.esercizi, da, a)
      const posizioni = riordinoMinimo(
        giorno.esercizi.map((e) => ({ id: e.id, position: e.order_index })),
        nuovoOrdine,
      )
      riordinaEsercizi.mutate({ dayId, nuovoOrdine, posizioni }, { onError: erroreToast })
    }
  }

  const archiviata = s.status === 'archived'

  return (
    <>
      <p className="mb-4 text-sm">
        <Link
          to={`/clienti/${s.client_id}`}
          className="text-muted underline-offset-4 hover:text-accent hover:underline"
        >
          {clienteNome}
        </Link>
      </p>

      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0 flex-1">
          <PlanHeading
            clienteNome={clienteNome}
            titolo={s.title}
            inizio={s.start_date}
            fine={s.end_date}
            scadenza={scadenza}
            archiviata={archiviata}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variante="primario" onClick={() => window.open(`/schede/${s.id}/stampa`, '_blank')}>
            Esporta
          </Button>
          <Button onClick={() => setFormAperto(true)}>Modifica</Button>
          {/* PRD §3.3: Rinnova e Archivia sono indipendenti, non l'una dentro l'altra. */}
          <Button onClick={() => setRinnovoAperto(true)}>Rinnova</Button>
          <Button
            onClick={() =>
              cambiaStato.mutate(
                { id: s.id, stato: archiviata ? 'active' : 'archived' },
                {
                  onSuccess: () =>
                    toast.conferma(archiviata ? 'Scheda riattivata.' : 'Scheda archiviata.'),
                  onError: erroreToast,
                },
              )
            }
            disabled={cambiaStato.isPending}
          >
            {archiviata ? 'Riattiva' : 'Archivia'}
          </Button>
          {archiviata && (
            <Button variante="pericolo" onClick={() => setConfermaEliminazione(true)}>
              Elimina
            </Button>
          )}
        </div>
      </div>

      {s.notes && (
        <p className="prose-column mt-5 whitespace-pre-line border-l-2 border-line pl-4 text-sm text-muted">
          {s.notes}
        </p>
      )}

      <div className="mt-8 flex flex-col gap-7">
        {s.giorni.length === 0 ? (
          <Vuoto
            titolo="Nessun giorno di allenamento"
            descrizione="Aggiungi il primo giorno, poi riempilo con gli esercizi della libreria."
            azione={
              <Button
                variante="primario"
                onClick={() =>
                  aggiungiGiorno.mutate('Giorno 1', {
                    onSuccess: () => toast.conferma('Giorno aggiunto.'),
                    onError: erroreToast,
                  })
                }
              >
                Aggiungi giorno
              </Button>
            }
          />
        ) : (
          <DndContext
            sensors={sensori}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={alTermineDelDrag}
          >
            <SortableContext
              items={s.giorni.map((g) => g.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex flex-col gap-7">
                {s.giorni.map((giorno, indice) => (
                  <DayCard
                    key={giorno.id}
                    giorno={giorno}
                    indice={indice}
                    onRinomina={(nome) =>
                      rinominaGiorno.mutate({ dayId: giorno.id, nome }, { onError: erroreToast })
                    }
                    onElimina={() => setGiornoDaEliminare(giorno)}
                    onAggiungiEsercizio={() => setGiornoPerPicker(giorno)}
                    onAggiornaRiga={(rowId, input) =>
                      aggiornaRiga.mutate({ rowId, input }, { onError: erroreToast })
                    }
                    onRimuoviRiga={(rowId) => rimuoviRiga.mutate(rowId, { onError: erroreToast })}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {s.giorni.length > 0 && (
          <div className="border-t border-line pt-4">
            <Button
              onClick={() =>
                aggiungiGiorno.mutate(`Giorno ${s.giorni.length + 1}`, {
                  onSuccess: () => toast.conferma('Giorno aggiunto.'),
                  onError: erroreToast,
                })
              }
              disabled={aggiungiGiorno.isPending}
            >
              Aggiungi giorno
            </Button>
          </div>
        )}
      </div>

      <PlanForm
        aperto={formAperto}
        scheda={s}
        inCorso={aggiorna.isPending}
        onChiudi={() => setFormAperto(false)}
        onSalva={(input) =>
          aggiorna.mutate(
            { id: s.id, input },
            {
              onSuccess: () => {
                setFormAperto(false)
                toast.conferma('Modifiche salvate.')
              },
              onError: erroreToast,
            },
          )
        }
      />

      {rinnovoAperto && (
        <RenewDialog
          aperto={rinnovoAperto}
          scheda={s}
          inCorso={rinnova.isPending}
          onChiudi={() => setRinnovoAperto(false)}
          onConferma={(titolo, inizio, fine) =>
            rinnova.mutate(
              { id: s.id, titolo, inizio, fine },
              {
                onSuccess: (nuova) => {
                  setRinnovoAperto(false)
                  toast.conferma('Scheda rinnovata.')
                  navigate(`/schede/${nuova.id}`)
                },
                onError: erroreToast,
              },
            )
          }
        />
      )}

      <ExercisePicker
        aperto={giornoPerPicker !== null}
        nomeGiorno={giornoPerPicker?.day_name ?? ''}
        inCorso={aggiungiEsercizio.isPending}
        onChiudi={() => setGiornoPerPicker(null)}
        onScegli={(exerciseId) => {
          if (!giornoPerPicker) return
          aggiungiEsercizio.mutate(
            { dayId: giornoPerPicker.id, exerciseId },
            { onError: erroreToast },
          )
        }}
      />

      <ConfirmDialog
        aperto={giornoDaEliminare !== null}
        titolo={giornoDaEliminare ? `Eliminare "${giornoDaEliminare.day_name}"?` : ''}
        descrizione={
          giornoDaEliminare
            ? `Spariscono anche i ${giornoDaEliminare.esercizi.length} esercizi che contiene. Gli esercizi restano nella libreria.`
            : ''
        }
        etichettaConferma="Elimina giorno"
        distruttivo
        inCorso={eliminaGiorno.isPending}
        onAnnulla={() => setGiornoDaEliminare(null)}
        onConferma={() => {
          if (!giornoDaEliminare) return
          eliminaGiorno.mutate(giornoDaEliminare.id, {
            onSuccess: () => {
              setGiornoDaEliminare(null)
              toast.conferma('Giorno eliminato.')
            },
            onError: (errore) => {
              setGiornoDaEliminare(null)
              erroreToast(errore)
            },
          })
        }}
      />

      <ConfirmDialog
        aperto={confermaEliminazione}
        titolo={`Eliminare "${s.title}"?`}
        descrizione="Spariscono i giorni e gli esercizi della scheda. Non si può recuperare."
        etichettaConferma="Elimina definitivamente"
        distruttivo
        inCorso={elimina.isPending}
        onAnnulla={() => setConfermaEliminazione(false)}
        onConferma={() =>
          elimina.mutate(s.id, {
            onSuccess: () => {
              setConfermaEliminazione(false)
              toast.conferma('Scheda eliminata.')
              navigate(`/clienti/${s.client_id}`)
            },
            onError: (errore) => {
              setConfermaEliminazione(false)
              erroreToast(errore)
            },
          })
        }
      />
    </>
  )
}
