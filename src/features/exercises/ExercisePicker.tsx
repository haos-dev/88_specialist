import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Select } from '@/components/ui/Field'
import { SearchInput } from '@/components/ui/SearchInput'
import { Caricamento, Errore, Vuoto } from '@/components/ui/Stato'
import { ESERCIZI_PER_PAGINA, useEsercizi, useGruppiMuscolari } from './useExercises'

interface ExercisePickerProps {
  aperto: boolean
  /** Nome del giorno a cui si sta aggiungendo, per non perdere il contesto. */
  nomeGiorno: string
  inCorso?: boolean
  onScegli: (exerciseId: string) => void
  onChiudi: () => void
}

/**
 * Sceglie un esercizio dalla libreria. Resta aperto dopo la scelta: riempire
 * un giorno significa aggiungere cinque o sei esercizi di fila, e richiudere
 * ogni volta il dialog costringerebbe a rifare ricerca e filtro da capo.
 */
export function ExercisePicker({
  aperto,
  nomeGiorno,
  inCorso,
  onScegli,
  onChiudi,
}: ExercisePickerProps) {
  const [ricerca, setRicerca] = useState('')
  const [gruppo, setGruppo] = useState('')
  const [pagina, setPagina] = useState(0)

  const gruppi = useGruppiMuscolari()
  const elenco = useEsercizi({
    ricerca,
    gruppoMuscolare: gruppo || null,
    pagina,
    perPagina: ESERCIZI_PER_PAGINA,
  })

  useEffect(() => {
    if (!aperto) {
      setRicerca('')
      setGruppo('')
      setPagina(0)
    }
  }, [aperto])

  const righe = elenco.data?.righe ?? []
  const totale = elenco.data?.totale ?? 0
  const pagine = Math.max(1, Math.ceil(totale / ESERCIZI_PER_PAGINA))

  return (
    <Dialog
      aperto={aperto}
      titolo="Aggiungi esercizio"
      descrizione={`Finisce in fondo a "${nomeGiorno}". Puoi aggiungerne più di uno prima di chiudere.`}
      onChiudi={onChiudi}
      larghezza="lg"
      azioni={<Button onClick={onChiudi}>Ho finito</Button>}
    >
      <div className="mb-4 flex flex-wrap gap-3">
        <SearchInput
          etichetta="Cerca un esercizio"
          placeholder="Cerca per nome"
          valore={ricerca}
          onChange={(v) => {
            setRicerca(v)
            setPagina(0)
          }}
          className="w-full sm:max-w-64"
        />
        <Select
          value={gruppo}
          onChange={(e) => {
            setGruppo(e.target.value)
            setPagina(0)
          }}
          aria-label="Filtra per gruppo muscolare"
          className="sm:max-w-48"
        >
          <option value="">Tutti i gruppi</option>
          {(gruppi.data ?? []).map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </Select>
      </div>

      {elenco.isLoading ? (
        <Caricamento />
      ) : elenco.error ? (
        <Errore errore={elenco.error} onRiprova={() => void elenco.refetch()} />
      ) : righe.length === 0 ? (
        <Vuoto
          titolo="Nessun esercizio trovato"
          descrizione="Cambia i filtri, oppure aggiungi l'esercizio alla libreria dalla pagina Templates (icona database)."
        />
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {righe.map((esercizio) => (
            <li key={esercizio.id} className="flex items-center gap-3 py-2">
              {esercizio.media_url ? (
                <img
                  src={esercizio.media_url}
                  alt=""
                  loading="lazy"
                  className="h-10 w-14 shrink-0 border border-line object-cover"
                />
              ) : (
                <div className="h-10 w-14 shrink-0 border border-dashed border-line" aria-hidden="true" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{esercizio.name}</p>
                <p className="text-xs text-muted">{esercizio.muscle_group ?? '—'}</p>
              </div>
              <Button
                dimensione="sm"
                variante="primario"
                disabled={inCorso}
                onClick={() => onScegli(esercizio.id)}
              >
                Aggiungi
              </Button>
            </li>
          ))}
        </ul>
      )}

      {pagine > 1 && (
        <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
          <Button dimensione="sm" disabled={pagina === 0} onClick={() => setPagina((p) => p - 1)}>
            Precedenti
          </Button>
          <p className="nums text-xs text-muted">
            Pagina {pagina + 1} di {pagine}
          </p>
          <Button
            dimensione="sm"
            disabled={pagina >= pagine - 1}
            onClick={() => setPagina((p) => p + 1)}
          >
            Successivi
          </Button>
        </div>
      )}
    </Dialog>
  )
}
