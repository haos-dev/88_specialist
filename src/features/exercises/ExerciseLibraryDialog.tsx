import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { Select } from "@/components/ui/Field";
import { SearchInput } from "@/components/ui/SearchInput";
import { Caricamento, Errore, Vuoto } from "@/components/ui/Stato";
import { useToast } from "@/components/ui/Toast";
import { ExerciseForm } from "@/features/exercises/ExerciseForm";
import {
  ESERCIZI_PER_PAGINA,
  useAggiornaEsercizio,
  useCreaEsercizio,
  useEliminaEsercizio,
  useEsercizi,
  useGruppiMuscolari,
  useUtilizziEsercizio,
} from "@/features/exercises/useExercises";
import { messaggioErrore } from "@/data";
import type { Esercizio } from "@/types/domain";
import { FileEdit, FilePlus, X, Trash } from "lucide-react";

interface ExerciseLibraryDialogProps {
  aperto: boolean;
  onChiudi: () => void;
}

/**
 * Libreria esercizi in un modal. Va montato solo quando serve: lo stato dei
 * filtri e le query nascono con lui e spariscono alla chiusura.
 */
export function ExerciseLibraryDialog({
  aperto,
  onChiudi,
}: ExerciseLibraryDialogProps) {
  const [ricerca, setRicerca] = useState("");
  const [gruppo, setGruppo] = useState<string>("");
  const [pagina, setPagina] = useState(0);

  const [inModifica, setInModifica] = useState<Esercizio | null>(null);
  const [formAperto, setFormAperto] = useState(false);
  const [daEliminare, setDaEliminare] = useState<Esercizio | null>(null);

  const toast = useToast();
  const gruppi = useGruppiMuscolari();
  const elenco = useEsercizi({
    ricerca,
    gruppoMuscolare: gruppo || null,
    pagina,
    perPagina: ESERCIZI_PER_PAGINA,
  });

  const crea = useCreaEsercizio();
  const aggiorna = useAggiornaEsercizio();
  const elimina = useEliminaEsercizio();
  const utilizzi = useUtilizziEsercizio(daEliminare?.id);
  const eUsato = (utilizzi.data ?? 0) > 0;

  // Cambiare filtro con la pagina 5 aperta lascerebbe una griglia vuota.
  const cambiaRicerca = (valore: string) => {
    setRicerca(valore);
    setPagina(0);
  };
  const cambiaGruppo = (valore: string) => {
    setGruppo(valore);
    setPagina(0);
  };

  const totale = elenco.data?.totale ?? 0;
  const pagine = Math.max(1, Math.ceil(totale / ESERCIZI_PER_PAGINA));
  const righe = elenco.data?.righe ?? [];

  const apriNuovo = () => {
    setInModifica(null);
    setFormAperto(true);
  };

  return (
    <>
      <Dialog
        aperto={aperto}
        titolo="Libreria esercizi"
        larghezza="lg"
        onChiudi={onChiudi}
        azioni={
          <>
            <Button
              onClick={onChiudi}
              aria-label="Chiudi"
              title="Chiudi"
            >
              <X aria-hidden="true" size={19} strokeWidth={2.2} />
            </Button>
            <Button
              variante="primario"
              onClick={apriNuovo}
              aria-label="Nuovo esercizio"
              title="Nuovo esercizio"
            >
              <FilePlus aria-hidden="true" size={19} strokeWidth={2.2} />
            </Button>
          </>
        }
      >
        <div className="mb-4 flex flex-wrap gap-2">
          <SearchInput
            etichetta="Cerca esercizio"
            placeholder="Cerca esercizio…"
            valore={ricerca}
            onChange={cambiaRicerca}
            className="min-w-48 flex-1"
          />
          <Select
            aria-label="Filtra per gruppo muscolare"
            value={gruppo}
            onChange={(e) => cambiaGruppo(e.target.value)}
            className="sm:max-w-56"
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
          <Errore
            errore={elenco.error}
            onRiprova={() => void elenco.refetch()}
          />
        ) : righe.length === 0 ? (
          <Vuoto
            titolo={
              ricerca || gruppo
                ? "Nessun esercizio con questi filtri"
                : "La libreria è vuota"
            }
            descrizione={
              ricerca || gruppo
                ? "Prova con un altro nome o togli il filtro per gruppo muscolare."
                : "Aggiungi un esercizio a mano, oppure importa il dataset con lo script di seed."
            }
            azione={
              !ricerca && !gruppo ? (
                <Button
                  variante="primario"
                  onClick={apriNuovo}
                  aria-label="Nuovo esercizio"
                  title="Nuovo esercizio"
                >
                  <FilePlus aria-hidden="true" size={19} strokeWidth={2.2} />
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
            {righe.map((esercizio) => (
              <li
                key={esercizio.id}
                className="flex gap-3 border-t border-line pt-3"
              >
                {esercizio.media_url ? (
                  <img
                    src={esercizio.media_url}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="h-16 w-20 shrink-0 border border-line object-cover"
                  />
                ) : (
                  <div
                    className="h-16 w-20 shrink-0 border border-dashed border-line"
                    aria-hidden="true"
                  />
                )}

                <div className="min-w-0 flex-1">
                  <p
                    className="truncate font-medium text-ink"
                    title={esercizio.name}
                  >
                    {esercizio.name}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {esercizio.muscle_group ?? "Gruppo non indicato"}
                  </p>
                </div>
                <div className="flex shrink-0 items-start gap-2">
                  <button
                    type="button"
                    aria-label={`Modifica ${esercizio.name}`}
                    title="Modifica"
                    className="rounded-[8px] p-1.5 text-muted transition-colors hover:text-accent"
                    onClick={() => {
                      setInModifica(esercizio);
                      setFormAperto(true);
                    }}
                  >
                    <FileEdit aria-hidden="true" size={18} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Elimina ${esercizio.name}`}
                    title="Elimina"
                    className="rounded-[8px] p-1.5 text-muted transition-colors hover:text-scaduta"
                    onClick={() => setDaEliminare(esercizio)}
                  >
                    <Trash aria-hidden="true" size={18} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {pagine > 1 && (
          <nav
            className="mt-6 flex items-center justify-between border-t border-line pt-4"
            aria-label="Paginazione esercizi"
          >
            <Button
              dimensione="sm"
              disabled={pagina === 0}
              onClick={() => setPagina((p) => p - 1)}
            >
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
      </Dialog>

      <ExerciseForm
        aperto={formAperto}
        esercizio={inModifica}
        gruppi={gruppi.data ?? []}
        inCorso={crea.isPending || aggiorna.isPending}
        onChiudi={() => setFormAperto(false)}
        onSalva={(input) => {
          const opzioni = {
            onSuccess: () => {
              setFormAperto(false);
              toast.conferma(
                inModifica
                  ? "Modifiche salvate."
                  : `${input.name} è stato aggiunto.`,
              );
            },
            onError: (errore: unknown) => toast.errore(messaggioErrore(errore)),
          };
          if (inModifica)
            aggiorna.mutate({ id: inModifica.id, input }, opzioni);
          else crea.mutate(input, opzioni);
        }}
      />

      {/* PRD §3.2: prima di eliminare, l'app dice se e dove l'esercizio è usato. */}
      <ConfirmDialog
        aperto={daEliminare !== null}
        titolo={daEliminare ? `Eliminare ${daEliminare.name}?` : ""}
        descrizione={
          utilizzi.isLoading
            ? "Controllo in quante schede è usato…"
            : eUsato
              ? `È usato in ${utilizzi.data} ${utilizzi.data === 1 ? "riga di scheda" : "righe di scheda"}, quindi non può essere eliminato: le schede esistenti smetterebbero di avere senso. Toglilo prima dalle schede che lo usano.`
              : "Non è usato in nessuna scheda. L’eliminazione è definitiva."
        }
        etichettaConferma="Elimina definitivamente"
        etichettaAnnulla={eUsato ? "Chiudi" : "Annulla"}
        soloAnnulla={eUsato}
        distruttivo
        inCorso={elimina.isPending || utilizzi.isLoading}
        onAnnulla={() => setDaEliminare(null)}
        onConferma={() => {
          if (!daEliminare || eUsato) return;
          const nome = daEliminare.name;
          elimina.mutate(daEliminare.id, {
            onSuccess: () => {
              setDaEliminare(null);
              toast.conferma(`${nome} è stato eliminato.`);
            },
            onError: (errore) => {
              setDaEliminare(null);
              toast.errore(messaggioErrore(errore));
            },
          });
        }}
      />
    </>
  );
}
