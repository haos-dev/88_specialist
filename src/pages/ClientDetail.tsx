import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Badge, BadgeScadenza } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { Caricamento, Errore, Vuoto } from '@/components/ui/Stato'
import { Table, TD, TH, TR } from '@/components/ui/Table'
import { useToast } from '@/components/ui/Toast'
import { ClientForm } from '@/features/clients/ClientForm'
import { PlanForm } from '@/features/plans/PlanForm'
import {
  useAggiornaCliente,
  useArchiviaCliente,
  useCliente,
  useEliminaCliente,
} from '@/features/clients/useClients'
import { useCreaScheda, useSchedeCliente } from '@/features/plans/usePlans'
import { calcolaScadenza } from '@/features/plans/planExpiry'
import { useSogliaReminder } from '@/features/settings/useSettings'
import { formatData, formatIntervallo } from '@/lib/dates'
import { messaggioErrore } from '@/data'

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const soglia = useSogliaReminder()

  const cliente = useCliente(id)
  const schede = useSchedeCliente(id)

  const aggiorna = useAggiornaCliente()
  const archivia = useArchiviaCliente()
  const elimina = useEliminaCliente()
  const creaScheda = useCreaScheda()

  const [formCliente, setFormCliente] = useState(false)
  const [formScheda, setFormScheda] = useState(false)
  const [confermaEliminazione, setConfermaEliminazione] = useState(false)

  if (cliente.isLoading) return <Caricamento />
  if (cliente.error) return <Errore errore={cliente.error} onRiprova={() => void cliente.refetch()} />
  if (!cliente.data) {
    return (
      <Vuoto
        titolo="Questo cliente non esiste"
        descrizione="Potrebbe essere stato eliminato."
        azione={
          <Link to="/clienti" className="text-sm text-accent underline underline-offset-4">
            Torna ai clienti
          </Link>
        }
      />
    )
  }

  const c = cliente.data
  const nomeCompleto = `${c.first_name} ${c.last_name}`

  return (
    <>
      <p className="mb-4 text-sm">
        <Link to="/clienti" className="text-muted underline-offset-4 hover:text-accent hover:underline">
          Clienti
        </Link>
      </p>

      {/* Intestazione anagrafica: stesso trattamento tipografico del foglio
          stampato, così l'app e il PDF sembrano lo stesso prodotto. */}
      <header className="border-b-2 border-ink pb-3">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <h1 className="display text-3xl leading-none text-ink">{nomeCompleto}</h1>
            <p className="nums mt-2 text-sm text-muted">
              {[
                c.email,
                c.phone,
                c.birth_date ? `nato/a il ${formatData(c.birth_date)}` : null,
              ]
                .filter(Boolean)
                .join(' · ') || 'Nessun contatto indicato'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!c.active && <Badge>Archiviato</Badge>}
            <Button onClick={() => setFormCliente(true)}>Modifica</Button>
            <Button
              onClick={() =>
                archivia.mutate(
                  { id: c.id, attivo: !c.active },
                  {
                    onSuccess: () =>
                      toast.conferma(
                        c.active
                          ? `${nomeCompleto} è stato archiviato.`
                          : `${nomeCompleto} è di nuovo attivo.`,
                      ),
                    onError: (errore) => toast.errore(messaggioErrore(errore)),
                  },
                )
              }
              disabled={archivia.isPending}
            >
              {c.active ? 'Archivia' : 'Riattiva'}
            </Button>
            {/* PRD §3.1: l'eliminazione definitiva esiste solo per gli archiviati. */}
            {!c.active && (
              <Button variante="pericolo" onClick={() => setConfermaEliminazione(true)}>
                Elimina
              </Button>
            )}
          </div>
        </div>
      </header>

      {c.notes && (
        <section className="mt-5 border-l-2 border-line pl-4">
          <h2 className="text-sm font-medium text-ink">Note</h2>
          <p className="prose-column mt-1 whitespace-pre-line text-sm text-muted">{c.notes}</p>
        </section>
      )}

      <section className="mt-8" aria-labelledby="titolo-schede">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h2 id="titolo-schede" className="display-tight text-lg">
            Schede di allenamento
          </h2>
          <Button variante="primario" onClick={() => setFormScheda(true)}>
            Nuova scheda
          </Button>
        </div>

        {schede.isLoading ? (
          <Caricamento />
        ) : schede.error ? (
          <Errore errore={schede.error} onRiprova={() => void schede.refetch()} />
        ) : (schede.data ?? []).length === 0 ? (
          <Vuoto
            titolo="Nessuna scheda per questo cliente"
            descrizione="Crea la prima scheda: potrai aggiungere giorni di allenamento e riempirli con gli esercizi della libreria."
            azione={
              <Button variante="primario" onClick={() => setFormScheda(true)}>
                Nuova scheda
              </Button>
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <TH>Titolo</TH>
                <TH className="hidden sm:table-cell">Periodo</TH>
                <TH className="text-right">Giorni</TH>
                <TH>Stato</TH>
              </tr>
            </thead>
            <tbody>
              {(schede.data ?? []).map((scheda) => {
                const scadenza = calcolaScadenza(
                  { end_date: scheda.end_date, status: scheda.status, clienteAttivo: c.active },
                  soglia,
                )
                return (
                  <TR key={scheda.id}>
                    <TD>
                      <Link
                        to={`/schede/${scheda.id}`}
                        className="font-medium underline-offset-4 hover:text-accent hover:underline"
                      >
                        {scheda.title}
                      </Link>
                    </TD>
                    <TD className="nums hidden whitespace-nowrap text-sm text-muted sm:table-cell">
                      {formatIntervallo(scheda.start_date, scheda.end_date)}
                    </TD>
                    <TD className="nums text-right">{scheda.giorni_count}</TD>
                    <TD>
                      {scheda.status === 'archived' ? (
                        <Badge>Archiviata</Badge>
                      ) : (
                        <BadgeScadenza
                          stato={scadenza.stato}
                          giorniResidui={scadenza.giorniResidui}
                        />
                      )}
                    </TD>
                  </TR>
                )
              })}
            </tbody>
          </Table>
        )}
      </section>

      <ClientForm
        aperto={formCliente}
        cliente={c}
        inCorso={aggiorna.isPending}
        onChiudi={() => setFormCliente(false)}
        onSalva={(input) =>
          aggiorna.mutate(
            { id: c.id, input },
            {
              onSuccess: () => {
                setFormCliente(false)
                toast.conferma('Modifiche salvate.')
              },
              onError: (errore) => toast.errore(messaggioErrore(errore)),
            },
          )
        }
      />

      <PlanForm
        aperto={formScheda}
        inCorso={creaScheda.isPending}
        onChiudi={() => setFormScheda(false)}
        onSalva={(input) =>
          creaScheda.mutate(
            { ...input, client_id: c.id },
            {
              onSuccess: (scheda) => {
                setFormScheda(false)
                toast.conferma('Scheda creata.')
                navigate(`/schede/${scheda.id}`)
              },
              onError: (errore) => toast.errore(messaggioErrore(errore)),
            },
          )
        }
      />

      <ConfirmDialog
        aperto={confermaEliminazione}
        titolo={`Eliminare ${nomeCompleto}?`}
        descrizione="Spariscono anche tutte le sue schede di allenamento, e non si possono recuperare."
        etichettaConferma="Elimina definitivamente"
        distruttivo
        inCorso={elimina.isPending}
        onAnnulla={() => setConfermaEliminazione(false)}
        onConferma={() =>
          elimina.mutate(c.id, {
            onSuccess: () => {
              setConfermaEliminazione(false)
              toast.conferma(`${nomeCompleto} è stato eliminato.`)
              navigate('/clienti')
            },
            onError: (errore) => {
              setConfermaEliminazione(false)
              toast.errore(messaggioErrore(errore))
            },
          })
        }
      />
    </>
  )
}
