import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { Select } from '@/components/ui/Field'
import { SearchInput } from '@/components/ui/SearchInput'
import { Caricamento, Errore, Vuoto } from '@/components/ui/Stato'
import { useToast } from '@/components/ui/Toast'
import { ExerciseForm } from '@/features/exercises/ExerciseForm'
import {
  ESERCIZI_PER_PAGINA,
  useAggiornaEsercizio,
  useArchiviaEsercizio,
  useCreaEsercizio,
  useEliminaEsercizio,
  useEsercizi,
  useGruppiMuscolari,
  useUtilizziEsercizio,
} from '@/features/exercises/useExercises'
import { messaggioErrore } from '@/data'
import type { Esercizio } from '@/types/domain'

export default function Exercises() {
  const [ricerca, setRicerca] = useState('')
  const [gruppo, setGruppo] = useState<string>('')
  const [includiArchiviati, setIncludiArchiviati] = useState(false)
  const [pagina, setPagina] = useState(0)

  const [inModifica, setInModifica] = useState<Esercizio | null>(null)
  const [formAperto, setFormAperto] = useState(false)
  const [daEliminare, setDaEliminare] = useState<Esercizio | null>(null)

  const toast = useToast()
  const gruppi = useGruppiMuscolari()
  const elenco = useEsercizi({
    ricerca,
    gruppoMuscolare: gruppo || null,
    includiArchiviati,
    pagina,
    perPagina: ESERCIZI_PER_PAGINA,
  })

  const crea = useCreaEsercizio()
  const aggiorna = useAggiornaEsercizio()
  const archivia = useArchiviaEsercizio()
  const elimina = useEliminaEsercizio()
  const utilizzi = useUtilizziEsercizio(daEliminare?.id)

  // Cambiare filtro con la pagina 5 aperta lascerebbe una griglia vuota.
  useEffect(() => setPagina(0), [ricerca, gruppo, includiArchiviati])

  const totale = elenco.data?.totale ?? 0
  const pagine = Math.max(1, Math.ceil(totale / ESERCIZI_PER_PAGINA))
  const righe = elenco.data?.righe ?? []

  const apriNuovo = () => {
    setInModifica(null)
    setFormAperto(true)
  }

  return (
    <>
      <PageHeader
        titolo="Esercizi"
        descrizione="La libreria condivisa da cui peschi quando costruisci una scheda."
        azioni={
          <Button variante="primario" onClick={apriNuovo}>
            Nuovo esercizio
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <SearchInput
          etichetta="Cerca fra gli esercizi"
          placeholder="Cerca per nome"
          valore={ricerca}
          onChange={setRicerca}
          className="w-full sm:max-w-72"
        />

        <Select
          value={gruppo}
          onChange={(e) => setGruppo(e.target.value)}
          aria-label="Filtra per gruppo muscolare"
          className="sm:max-w-52"
        >
          <option value="">Tutti i gruppi</option>
          {(gruppi.data ?? []).map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </Select>

        <label className="flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={includiArchiviati}
            onChange={(e) => setIncludiArchiviati(e.target.checked)}
            className="h-3.5 w-3.5 accent-[var(--color-accent)]"
          />
          Mostra archiviati
        </label>

        {totale > 0 && (
          <p className="nums ml-auto text-sm text-muted">
            {totale} {totale === 1 ? 'esercizio' : 'esercizi'}
          </p>
        )}
      </div>

      {elenco.isLoading ? (
        <Caricamento />
      ) : elenco.error ? (
        <Errore errore={elenco.error} onRiprova={() => void elenco.refetch()} />
      ) : righe.length === 0 ? (
        <Vuoto
          titolo={ricerca || gruppo ? 'Nessun esercizio con questi filtri' : 'La libreria è vuota'}
          descrizione={
            ricerca || gruppo
              ? 'Prova con un altro nome o togli il filtro per gruppo muscolare.'
              : 'Aggiungi un esercizio a mano, oppure importa il dataset con lo script di seed.'
          }
          azione={
            !ricerca && !gruppo ? (
              <Button variante="primario" onClick={apriNuovo}>
                Nuovo esercizio
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-3">
          {righe.map((esercizio) => (
            <li key={esercizio.id} className="flex gap-3 border-t border-line pt-3">
              {esercizio.media_url ? (
                <img
                  src={esercizio.media_url}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-16 w-20 shrink-0 border border-line object-cover"
                />
              ) : (
                <div className="h-16 w-20 shrink-0 border border-dashed border-line" aria-hidden="true" />
              )}

              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink" title={esercizio.name}>
                  {esercizio.name}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {esercizio.muscle_group ?? 'Gruppo non indicato'}
                </p>
                {esercizio.archived && (
                  <Badge className="mt-1.5">Archiviato</Badge>
                )}

                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                  <button
                    type="button"
                    className="text-muted underline-offset-4 hover:text-accent hover:underline"
                    onClick={() => {
                      setInModifica(esercizio)
                      setFormAperto(true)
                    }}
                  >
                    Modifica
                  </button>
                  <button
                    type="button"
                    className="text-muted underline-offset-4 hover:text-accent hover:underline"
                    onClick={() =>
                      archivia.mutate(
                        { id: esercizio.id, archiviato: !esercizio.archived },
                        {
                          onSuccess: () =>
                            toast.conferma(
                              esercizio.archived
                                ? `${esercizio.name} è di nuovo in libreria.`
                                : `${esercizio.name} è stato archiviato.`,
                            ),
                          onError: (errore) => toast.errore(messaggioErrore(errore)),
                        },
                      )
                    }
                  >
                    {esercizio.archived ? 'Ripristina' : 'Archivia'}
                  </button>
                  <button
                    type="button"
                    className="text-muted underline-offset-4 hover:text-scaduta hover:underline"
                    onClick={() => setDaEliminare(esercizio)}
                  >
                    Elimina
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {pagine > 1 && (
        <nav
          className="mt-8 flex items-center justify-between border-t border-line pt-4"
          aria-label="Paginazione esercizi"
        >
          <Button dimensione="sm" disabled={pagina === 0} onClick={() => setPagina((p) => p - 1)}>
            Precedenti
          </Button>
          <p className="nums text-sm text-muted">
            Pagina {pagina + 1} di {pagine}
          </p>
          <Button
            dimensione="sm"
            disabled={pagina >= pagine - 1}
            onClick={() => setPagina((p) => p + 1)}
          >
            Successivi
          </Button>
        </nav>
      )}

      <ExerciseForm
        aperto={formAperto}
        esercizio={inModifica}
        gruppi={gruppi.data ?? []}
        inCorso={crea.isPending || aggiorna.isPending}
        onChiudi={() => setFormAperto(false)}
        onSalva={(input) => {
          const opzioni = {
            onSuccess: () => {
              setFormAperto(false)
              toast.conferma(inModifica ? 'Modifiche salvate.' : `${input.name} è stato aggiunto.`)
            },
            onError: (errore: unknown) => toast.errore(messaggioErrore(errore)),
          }
          if (inModifica) aggiorna.mutate({ id: inModifica.id, input }, opzioni)
          else crea.mutate(input, opzioni)
        }}
      />

      {/* PRD §3.2: prima di eliminare, l'app dice se e dove l'esercizio è usato. */}
      <ConfirmDialog
        aperto={daEliminare !== null}
        titolo={daEliminare ? `Eliminare ${daEliminare.name}?` : ''}
        descrizione={
          utilizzi.isLoading
            ? 'Controllo in quante schede è usato…'
            : (utilizzi.data ?? 0) > 0
              ? `È usato in ${utilizzi.data} ${utilizzi.data === 1 ? 'riga di scheda' : 'righe di scheda'}, quindi non può essere eliminato: le schede esistenti smetterebbero di avere senso. Archivialo per toglierlo dalla libreria lasciando intatto lo storico.`
              : 'Non è usato in nessuna scheda. L’eliminazione è definitiva.'
        }
        etichettaConferma={(utilizzi.data ?? 0) > 0 ? 'Archivia invece' : 'Elimina definitivamente'}
        distruttivo={(utilizzi.data ?? 0) === 0}
        inCorso={elimina.isPending || archivia.isPending || utilizzi.isLoading}
        onAnnulla={() => setDaEliminare(null)}
        onConferma={() => {
          if (!daEliminare) return
          const nome = daEliminare.name
          const opzioni = {
            onSuccess: () => {
              setDaEliminare(null)
              toast.conferma(`${nome} è stato ${(utilizzi.data ?? 0) > 0 ? 'archiviato' : 'eliminato'}.`)
            },
            onError: (errore: unknown) => {
              setDaEliminare(null)
              toast.errore(messaggioErrore(errore))
            },
          }
          if ((utilizzi.data ?? 0) > 0) {
            archivia.mutate({ id: daEliminare.id, archiviato: true }, opzioni)
          } else {
            elimina.mutate(daEliminare.id, opzioni)
          }
        }}
      />
    </>
  )
}
