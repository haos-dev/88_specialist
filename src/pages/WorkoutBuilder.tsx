import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Caricamento, Errore, Vuoto } from "@/components/ui/Stato";
import { useToast } from "@/components/ui/Toast";
import { ExercisePicker } from "@/features/exercises/ExercisePicker";
import { DayCard } from "@/features/plans/DayCard";
import { PlanForm } from "@/features/plans/PlanForm";
import { TemplateForm } from "@/features/plans/TemplateForm";
import { ApplyTemplateDialog } from "@/features/plans/ApplyTemplateDialog";
import { PlanHeading } from "@/features/plans/PlanHeading";
import { RenewDialog } from "@/features/plans/RenewDialog";
import { calcolaScadenza } from "@/features/plans/planExpiry";
import { riordinoMinimo, spostaElemento } from "@/features/plans/reorder";
import { useClienti } from "@/features/clients/useClients";
import {
  useAggiornaRigaEsercizio,
  useAggiornaScheda,
  useAggiornaTemplate,
  useAggiungiEsercizio,
  useAggiungiGiorno,
  useApplicaTemplate,
  useCambiaStatoScheda,
  useEliminaGiorno,
  useEliminaScheda,
  useEliminaTemplate,
  useRimuoviEsercizio,
  useRinnovaScheda,
  useRinominaGiorno,
  useRiordinaEsercizi,
  useRiordinaGiorni,
  useScheda,
} from "@/features/plans/usePlans";
import { useSogliaReminder } from "@/features/settings/useSettings";
import { messaggioErrore } from "@/data";
import type { GiornoEspanso } from "@/types/domain";
import {
  ArrowLeft,
  SquareArrowUp,
  UserRoundArrowLeft,
  Trash,
  Pen,
  RefreshCw,
  ArchiveRestore,
  Archive,
  Plus,
} from "lucide-react";
import { BadgeScadenza } from "@/components/ui/Badge";

export default function WorkoutBuilder() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const soglia = useSogliaReminder();

  const scheda = useScheda(id);

  const aggiorna = useAggiornaScheda();
  const aggiornaTemplate = useAggiornaTemplate();
  const cambiaStato = useCambiaStatoScheda();
  const elimina = useEliminaScheda();
  const eliminaTemplate = useEliminaTemplate();
  const rinnova = useRinnovaScheda();
  const applicaTemplate = useApplicaTemplate();
  const clienti = useClienti({ stato: "attivi" });
  const aggiungiGiorno = useAggiungiGiorno(id);
  const rinominaGiorno = useRinominaGiorno(id);
  const eliminaGiorno = useEliminaGiorno(id);
  const aggiungiEsercizio = useAggiungiEsercizio(id);
  const aggiornaRiga = useAggiornaRigaEsercizio(id);
  const rimuoviRiga = useRimuoviEsercizio(id);
  const riordinaGiorni = useRiordinaGiorni(id);
  const riordinaEsercizi = useRiordinaEsercizi(id);

  const [formAperto, setFormAperto] = useState(false);
  const [rinnovoAperto, setRinnovoAperto] = useState(false);
  const [applicaAperto, setApplicaAperto] = useState(false);
  const [giornoDaEliminare, setGiornoDaEliminare] =
    useState<GiornoEspanso | null>(null);
  const [confermaEliminazione, setConfermaEliminazione] = useState(false);
  const [giornoPerPicker, setGiornoPerPicker] = useState<GiornoEspanso | null>(
    null,
  );

  const sensori = useSensors(
    // 5px di soglia: un clic dentro un campo non deve diventare un trascinamento.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  if (scheda.isLoading) return <Caricamento />;
  if (scheda.error)
    return (
      <Errore errore={scheda.error} onRiprova={() => void scheda.refetch()} />
    );
  if (!scheda.data) {
    return (
      <Vuoto
        titolo="Questa scheda non esiste"
        descrizione="Potrebbe essere stata eliminata."
        azione={
          <Link
            to="/templates"
            aria-label="Torna ai templates"
            title="Torna ai templates"
            className="mb-6 flex h-8 w-8 items-center justify-center rounded-[10px] border border-line text-muted transition-[background-color,border-color,color,transform] duration-100 hover:border-accent/45 hover:text-accent active:scale-[0.98]"
          >
            <ArrowLeft aria-hidden="true" size={18} />
          </Link>
        }
      />
    );
  }

  const s = scheda.data;
  const isTemplate = s.is_template;
  const clienteNome = s.cliente
    ? `${s.cliente.first_name} ${s.cliente.last_name}`.trim()
    : isTemplate
      ? "Template"
      : "Cliente non disponibile";
  const scadenza =
    isTemplate || !s.cliente
      ? undefined
      : calcolaScadenza(
          {
            end_date: s.end_date,
            status: s.status,
            clienteAttivo: s.cliente.active,
          },
          soglia,
        );
  const erroreToast = (errore: unknown) =>
    toast.errore(messaggioErrore(errore));

  /**
   * PRD §3.3: si riordina solo dentro il proprio contenitore — i giorni fra
   * loro, gli esercizi dentro il proprio giorno. Un trascinamento che
   * attraversa i confini viene semplicemente ignorato.
   */
  function alTermineDelDrag(evento: DragEndEvent) {
    const { active, over } = evento;
    if (!over || active.id === over.id) return;

    const tipo = active.data.current?.tipo;

    if (tipo === "giorno" && over.data.current?.tipo === "giorno") {
      const da = s.giorni.findIndex((g) => g.id === active.id);
      const a = s.giorni.findIndex((g) => g.id === over.id);
      if (da < 0 || a < 0) return;
      const nuovoOrdine = spostaElemento(s.giorni, da, a);
      const posizioni = riordinoMinimo(
        s.giorni.map((g) => ({ id: g.id, position: g.day_order })),
        nuovoOrdine,
      );
      riordinaGiorni.mutate(
        { nuovoOrdine, posizioni },
        { onError: erroreToast },
      );
      return;
    }

    if (tipo === "esercizio") {
      const dayId = active.data.current?.dayId as string | undefined;
      if (!dayId || over.data.current?.dayId !== dayId) return;
      const giorno = s.giorni.find((g) => g.id === dayId);
      if (!giorno) return;
      const da = giorno.esercizi.findIndex((e) => e.id === active.id);
      const a = giorno.esercizi.findIndex((e) => e.id === over.id);
      if (da < 0 || a < 0) return;
      const nuovoOrdine = spostaElemento(giorno.esercizi, da, a);
      const posizioni = riordinoMinimo(
        giorno.esercizi.map((e) => ({ id: e.id, position: e.order_index })),
        nuovoOrdine,
      );
      riordinaEsercizi.mutate(
        { dayId, nuovoOrdine, posizioni },
        { onError: erroreToast },
      );
    }
  }

  const archiviata = s.status === "archived";

  return (
    <>
      <p className="mb-4 text-sm">
        {isTemplate ? (
          <Link
            to="/templates"
            aria-label="Torna ai template"
            title="Torna ai template"
            className="mb-6 flex h-8 w-8 items-center justify-center rounded-[10px] border border-line text-muted transition-[background-color,border-color,color,transform] duration-100 hover:border-accent/45 hover:text-accent active:scale-[0.98]"
          >
            <ArrowLeft aria-hidden="true" size={18} />
          </Link>
        ) : (
          <Link
            to={`/clienti/${s.client_id}`}
            aria-label="Torna al cliente"
            title="Torna al cliente"
            className="mb-6 flex h-8 w-8 items-center justify-center rounded-[10px] border border-line text-muted transition-[background-color,border-color,color,transform] duration-100 hover:border-accent/45 hover:text-accent active:scale-[0.98]"
          >
            <ArrowLeft aria-hidden="true" size={18} />
          </Link>
        )}
      </p>

      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0 flex-1">
          <PlanHeading
            clienteNome={isTemplate ? s.title : clienteNome}
            inizio={s.start_date}
            fine={s.end_date}
          />
        </div>

        <div className="flex flex-col items-end gap-3">
          {!isTemplate && archiviata ? (
            <span className="border border-line px-1.5 py-0.5 text-xs font-medium text-muted">
              Archiviata
            </span>
          ) : scadenza ? (
            <BadgeScadenza
              stato={scadenza.stato}
              giorniResidui={scadenza.giorniResidui}
            />
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            {!isTemplate && (
              <Button
                variante="primario"
                aria-label="Esporta scheda"
                title="Esporta scheda"
                className="h-10 w-10 !p-0"
                onClick={() =>
                  window.open(`/schede/${s.id}/stampa`, "_blank", "noopener")
                }
              >
                <SquareArrowUp aria-hidden="true" size={17} />
              </Button>
            )}
            <Button
              aria-label="Modifica"
              title="Modifica"
              className="h-10 w-10 !p-0"
              onClick={() => setFormAperto(true)}
            >
              <Pen aria-hidden="true" size={17} />
            </Button>
            {isTemplate ? (
              <>
                {/* §3.7bis: un template non ha nulla che dipenda da lui, quindi
                  l'eliminazione è diretta — non serve la regola "solo se
                  archiviato" che protegge clienti e schede vere. */}
                <Button
                  variante="primario"
                  aria-label="Applica a un cliente"
                  title="Applica a un cliente"
                  className="h-10 w-10 !p-0"
                  onClick={() => setApplicaAperto(true)}
                >
                  <UserRoundArrowLeft aria-hidden="true" size={17} />
                </Button>
                <Button
                  variante="pericolo"
                  aria-label="Elimina"
                  title="Elimina"
                  className="h-10 w-10 !p-0"
                  onClick={() => setConfermaEliminazione(true)}
                >
                  <Trash aria-hidden="true" size={17} />
                </Button>
              </>
            ) : (
              <>
                {/* PRD §3.3: Rinnova e Archivia sono indipendenti, non l'una dentro l'altra. */}
                <Button
                  aria-label="Rinnova"
                  title="Rinnova"
                  className="h-10 w-10 !p-0"
                  onClick={() => setRinnovoAperto(true)}
                >
                  <RefreshCw aria-hidden="true" size={17} />
                </Button>
                <Button
                  aria-label={archiviata ? "Riattiva" : "Archivia"}
                  title={archiviata ? "Riattiva" : "Archivia"}
                  className="h-10 w-10 !p-0"
                  onClick={() =>
                    cambiaStato.mutate(
                      { id: s.id, stato: archiviata ? "active" : "archived" },
                      {
                        onSuccess: () =>
                          toast.conferma(
                            archiviata
                              ? "Scheda riattivata."
                              : "Scheda archiviata.",
                          ),
                        onError: erroreToast,
                      },
                    )
                  }
                  disabled={cambiaStato.isPending}
                >
                  {archiviata ? (
                    <ArchiveRestore aria-hidden="true" size={17} />
                  ) : (
                    <Archive aria-hidden="true" size={17} />
                  )}
                </Button>
                {archiviata && (
                  <Button
                    variante="pericolo"
                    aria-label="Elimina"
                    title="Elimina"
                    className="h-10 w-10 !p-0"
                    onClick={() => setConfermaEliminazione(true)}
                  >
                    <Trash aria-hidden="true" size={17} />
                  </Button>
                )}
              </>
            )}
          </div>
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
                aria-label="Aggiungi giorno"
                title="Aggiungi giorno"
                className="h-10 px-3"
                onClick={() =>
                  aggiungiGiorno.mutate("Giorno 1", {
                    onSuccess: () => toast.conferma("Giorno aggiunto."),
                    onError: erroreToast,
                  })
                }
              >
                <Plus aria-hidden="true" size={19} />
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
                      rinominaGiorno.mutate(
                        { dayId: giorno.id, nome },
                        { onError: erroreToast },
                      )
                    }
                    onElimina={() => setGiornoDaEliminare(giorno)}
                    onAggiungiEsercizio={() => setGiornoPerPicker(giorno)}
                    onAggiornaRiga={(rowId, input) =>
                      aggiornaRiga.mutate(
                        { rowId, input },
                        { onError: erroreToast },
                      )
                    }
                    onRimuoviRiga={(rowId) =>
                      rimuoviRiga.mutate(rowId, { onError: erroreToast })
                    }
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {s.giorni.length > 0 && (
          <div className="no-print flex justify-center pt-5">
            <Button
              variante="primario"
              aria-label="Aggiungi giorno"
              title="Aggiungi giorno"
              className="min-h-12 px-5 text-base"
              onClick={() =>
                aggiungiGiorno.mutate(`Giorno ${s.giorni.length + 1}`, {
                  onSuccess: () => toast.conferma("Giorno aggiunto."),
                  onError: erroreToast,
                })
              }
              disabled={aggiungiGiorno.isPending}
            >
              <Plus aria-hidden="true" size={19} />
              Aggiungi giorno
            </Button>
          </div>
        )}
      </div>

      <PlanForm
        aperto={formAperto && !isTemplate}
        scheda={s}
        inCorso={aggiorna.isPending}
        onChiudi={() => setFormAperto(false)}
        onSalva={(input) =>
          aggiorna.mutate(
            { id: s.id, input },
            {
              onSuccess: () => {
                setFormAperto(false);
                toast.conferma("Modifiche salvate.");
              },
              onError: erroreToast,
            },
          )
        }
      />

      <TemplateForm
        aperto={formAperto && isTemplate}
        template={s}
        inCorso={aggiornaTemplate.isPending}
        onChiudi={() => setFormAperto(false)}
        onSalva={(input) =>
          aggiornaTemplate.mutate(
            { id: s.id, input },
            {
              onSuccess: () => {
                setFormAperto(false);
                toast.conferma("Modifiche salvate.");
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
                  setRinnovoAperto(false);
                  toast.conferma("Scheda rinnovata.");
                  navigate(`/schede/${nuova.id}`);
                },
                onError: erroreToast,
              },
            )
          }
        />
      )}

      {applicaAperto && (
        <ApplyTemplateDialog
          aperto={applicaAperto}
          template={{
            id: s.id,
            title: s.title,
            notes: s.notes,
            giorni_count: s.giorni.length,
            esercizi_count: s.giorni.reduce(
              (somma, g) => somma + g.esercizi.length,
              0,
            ),
            created_at: s.created_at,
          }}
          clienti={clienti.data ?? []}
          inCorso={applicaTemplate.isPending}
          onChiudi={() => setApplicaAperto(false)}
          onConferma={(clientId, titolo, inizio, fine) =>
            applicaTemplate.mutate(
              { templateId: s.id, clientId, titolo, inizio, fine },
              {
                onSuccess: (nuova) => {
                  setApplicaAperto(false);
                  toast.conferma(
                    "Template applicato: scheda creata per il cliente.",
                  );
                  navigate(`/schede/${nuova.id}`);
                },
                onError: erroreToast,
              },
            )
          }
        />
      )}

      <ExercisePicker
        aperto={giornoPerPicker !== null}
        nomeGiorno={giornoPerPicker?.day_name ?? ""}
        inCorso={aggiungiEsercizio.isPending}
        onChiudi={() => setGiornoPerPicker(null)}
        onScegli={(exerciseId) => {
          if (!giornoPerPicker) return;
          aggiungiEsercizio.mutate(
            { dayId: giornoPerPicker.id, exerciseId },
            { onError: erroreToast },
          );
        }}
      />

      <ConfirmDialog
        aperto={giornoDaEliminare !== null}
        titolo={
          giornoDaEliminare ? `Eliminare "${giornoDaEliminare.day_name}"?` : ""
        }
        descrizione={
          giornoDaEliminare
            ? `Spariscono anche i ${giornoDaEliminare.esercizi.length} esercizi che contiene. Gli esercizi restano nella libreria.`
            : ""
        }
        etichettaConferma="Elimina giorno"
        distruttivo
        inCorso={eliminaGiorno.isPending}
        onAnnulla={() => setGiornoDaEliminare(null)}
        onConferma={() => {
          if (!giornoDaEliminare) return;
          eliminaGiorno.mutate(giornoDaEliminare.id, {
            onSuccess: () => {
              setGiornoDaEliminare(null);
              toast.conferma("Giorno eliminato.");
            },
            onError: (errore) => {
              setGiornoDaEliminare(null);
              erroreToast(errore);
            },
          });
        }}
      />

      <ConfirmDialog
        aperto={confermaEliminazione}
        titolo={`Eliminare "${s.title}"?`}
        descrizione={
          isTemplate
            ? "Spariscono i giorni e gli esercizi del template. Le schede già create da questo template restano intatte: non dipendono da lui."
            : "Spariscono i giorni e gli esercizi della scheda. Non si può recuperare."
        }
        etichettaConferma="Elimina definitivamente"
        distruttivo
        inCorso={isTemplate ? eliminaTemplate.isPending : elimina.isPending}
        onAnnulla={() => setConfermaEliminazione(false)}
        onConferma={() => {
          const onSuccess = () => {
            setConfermaEliminazione(false);
            toast.conferma(
              isTemplate ? "Template eliminato." : "Scheda eliminata.",
            );
            navigate(isTemplate ? "/templates" : `/clienti/${s.client_id}`);
          };
          const onError = (errore: unknown) => {
            setConfermaEliminazione(false);
            erroreToast(errore);
          };
          if (isTemplate) {
            eliminaTemplate.mutate(s.id, { onSuccess, onError });
          } else {
            elimina.mutate(s.id, { onSuccess, onError });
          }
        }}
      />
    </>
  );
}
