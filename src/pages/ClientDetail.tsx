import { useState } from "react";
import {
  Archive,
  ArrowLeft,
  CalendarDays,
  ClipboardList,
  Edit3,
  Mail,
  Phone,
  Plus,
  RotateCcw,
  Ruler,
  Target,
  Trash2,
  UserRound,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Badge, BadgeGiorniResidui } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Caricamento, Errore, Vuoto } from "@/components/ui/Stato";
import { useToast } from "@/components/ui/Toast";
import { ClientForm } from "@/features/clients/ClientForm";
import {
  useAggiornaCliente,
  useArchiviaCliente,
  useCliente,
  useEliminaCliente,
} from "@/features/clients/useClients";
import { PlanForm } from "@/features/plans/PlanForm";
import { useCreaScheda, useSchedeCliente } from "@/features/plans/usePlans";
import { formatData, giorniDaOggi } from "@/lib/dates";
import { messaggioErrore } from "@/data";

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const cliente = useCliente(id);
  const schede = useSchedeCliente(id);
  const aggiorna = useAggiornaCliente();
  const archivia = useArchiviaCliente();
  const elimina = useEliminaCliente();
  const creaScheda = useCreaScheda();
  const [formCliente, setFormCliente] = useState(false);
  const [formScheda, setFormScheda] = useState(false);
  const [confermaEliminazione, setConfermaEliminazione] = useState(false);

  if (cliente.isLoading) return <Caricamento />;
  if (cliente.error)
    return (
      <Errore errore={cliente.error} onRiprova={() => void cliente.refetch()} />
    );
  if (!cliente.data) {
    return (
      <Vuoto
        titolo="Questo cliente non esiste"
        descrizione="Potrebbe essere stato eliminato."
        azione={
          <Link
            to="/clienti"
            className="text-sm text-accent underline underline-offset-4"
          >
            Torna ai clienti
          </Link>
        }
      />
    );
  }

  const c = cliente.data;
  const nomeCompleto = `${c.first_name} ${c.last_name}`;
  const elencoSchede = schede.data ?? [];

  const cambiaStato = () => {
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
    );
  };

  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <Link
        to="/clienti"
        aria-label="Torna ai clienti"
        title="Torna ai clienti"
        className="mb-6 flex h-8 w-8 items-center justify-center rounded-[10px] border border-line text-muted transition-[background-color,border-color,color,transform] duration-100 hover:border-accent/45 hover:text-accent active:scale-[0.98]"
      >
        <ArrowLeft aria-hidden="true" size={18} />
      </Link>

      <div className="client-detail-grid grid items-start gap-5">
        <aside className="rounded-[22px] border border-accent/35 bg-surface p-6 xl:sticky xl:top-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-accent text-[#0b0d0e]">
              <UserRound aria-hidden="true" size={23} strokeWidth={1.8} />
            </div>
            <h1 className="mr-auto display mt-3 text-3xl leading-none text-ink">
              {nomeCompleto}
            </h1>
            {!c.active && (
              <Badge className="mr-auto display mt-4">Archiviato</Badge>
            )}
          </div>

          <div className="mt-6 space-y-3 border-t border-line pt-5 text-sm text-muted">
            {c.email ? (
              <p className="flex items-start gap-3 break-all">
                <Mail
                  aria-hidden="true"
                  className="mt-0.5 shrink-0 text-accent"
                  size={16}
                />
                {c.email}
              </p>
            ) : null}
            {c.phone ? (
              <p className="flex items-center gap-3">
                <Phone
                  aria-hidden="true"
                  className="shrink-0 text-accent"
                  size={16}
                />
                {c.phone}
              </p>
            ) : null}
            {c.birth_date ? (
              <p className="flex items-center gap-3">
                <CalendarDays
                  aria-hidden="true"
                  className="shrink-0 text-accent"
                  size={16}
                />
                Nato/a il {formatData(c.birth_date)}
              </p>
            ) : null}
            {!c.email && !c.phone && !c.birth_date ? (
              <p>Nessun contatto indicato</p>
            ) : null}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-2 border-t border-line pt-5">
            <div className="flex min-h-16 items-center rounded-[12px] border border-line px-3 py-3">
              {c.height_cm != null || c.weight_kg != null ? (
                <div className="flex items-center gap-3 text-sm font-semibold text-ink">
                  <Ruler
                    aria-hidden="true"
                    className="shrink-0 text-accent"
                    size={23}
                  />
                  {[
                    c.height_cm != null ? `${c.height_cm} cm` : null,
                    c.weight_kg != null ? `${c.weight_kg} kg` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              ) : null}
            </div>
            <div className="flex min-h-16 items-center rounded-[12px] border border-line px-3 py-3">
              {c.goal ? (
                <div className="flex items-center gap-3 text-sm font-semibold text-ink">
                  <Target
                    aria-hidden="true"
                    className="shrink-0 text-accent"
                    size={23}
                  />
                  {c.goal}
                </div>
              ) : null}
            </div>
          </div>

          {c.notes ? (
            <div className="mt-6 border-l-2 border-accent/60 pl-4">
              <p className="text-xs font-medium text-muted">Note</p>
              <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink">
                {c.notes}
              </p>
            </div>
          ) : null}

          <div className="mt-6 flex items-center gap-2 border-t border-line pt-5">
            <div className="ml-auto flex items-center gap-2">
              <Button
                aria-label="Modifica cliente"
                title="Modifica cliente"
                className="h-10 w-10 !p-0"
                onClick={() => setFormCliente(true)}
              >
                <Edit3 aria-hidden="true" size={17} />
              </Button>
              <Button
                aria-label={c.active ? "Archivia cliente" : "Riattiva cliente"}
                title={c.active ? "Archivia cliente" : "Riattiva cliente"}
                className="h-10 w-10 !p-0"
                onClick={cambiaStato}
                disabled={archivia.isPending}
              >
                {c.active ? (
                  <Archive aria-hidden="true" size={17} />
                ) : (
                  <RotateCcw aria-hidden="true" size={17} />
                )}
              </Button>
              {!c.active ? (
                <Button
                  variante="pericolo"
                  aria-label="Elimina cliente"
                  title="Elimina cliente"
                  className="h-10 w-10 !p-0"
                  onClick={() => setConfermaEliminazione(true)}
                >
                  <Trash2 aria-hidden="true" size={17} />
                </Button>
              ) : null}
            </div>
          </div>
        </aside>

        <section aria-labelledby="titolo-schede">
          <header className="mb-5 flex items-center justify-between gap-4 border-b border-line pb-4">
            <div>
              <p className="text-sm font-medium text-accent">Programmazione</p>
              <h2
                id="titolo-schede"
                className="display-tight mt-1 text-2xl text-ink"
              >
                Schede di allenamento
              </h2>
            </div>
            <Button
              variante="primario"
              aria-label="Nuova scheda"
              title="Nuova scheda"
              className="h-10 w-10 !p-0"
              onClick={() => setFormScheda(true)}
            >
              <Plus aria-hidden="true" size={19} />
            </Button>
          </header>

          {schede.isLoading ? <Caricamento /> : null}
          {schede.error ? (
            <Errore
              errore={schede.error}
              onRiprova={() => void schede.refetch()}
            />
          ) : null}
          {!schede.isLoading && !schede.error && elencoSchede.length === 0 ? (
            <Vuoto
              titolo="Nessuna scheda per questo cliente"
              descrizione="Crea la prima scheda: potrai aggiungere giorni ed esercizi."
            />
          ) : null}
          {!schede.isLoading && !schede.error && elencoSchede.length > 0 ? (
            <ul className="grid gap-3 md:grid-cols-1">
              {elencoSchede.map((scheda) => {
                const giorniResidui = giorniDaOggi(scheda.end_date);
                return (
                  <li key={scheda.id}>
                    <Link
                      to={`/schede/${scheda.id}`}
                      className="group block rounded-[18px] border border-line bg-surface p-5 transition-[background-color,border-color,transform] duration-150 hover:-translate-y-0.5 hover:border-accent/50 hover:bg-[#202527] focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <ClipboardList
                            aria-hidden="true"
                            className="mt-0.5 shrink-0 text-accent"
                            size={19}
                          />
                          <h3 className="display-tight truncate text-lg text-ink group-hover:text-accent">
                            {scheda.title}
                          </h3>
                        </div>
                        {scheda.status === "archived" ? (
                          <Badge>Archiviata</Badge>
                        ) : giorniResidui !== null ? (
                          <BadgeGiorniResidui giorni={giorniResidui} />
                        ) : null}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </section>
      </div>

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
                setFormCliente(false);
                toast.conferma("Modifiche salvate.");
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
                setFormScheda(false);
                toast.conferma("Scheda creata.");
                navigate(`/schede/${scheda.id}`);
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
              setConfermaEliminazione(false);
              toast.conferma(`${nomeCompleto} è stato eliminato.`);
              navigate("/clienti");
            },
            onError: (errore) => {
              setConfermaEliminazione(false);
              toast.errore(messaggioErrore(errore));
            },
          })
        }
      />
    </div>
  );
}
