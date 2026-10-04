import { useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isBefore,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { it } from "date-fns/locale";
import {
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Pencil,
} from "lucide-react";
import { messaggioErrore } from "@/data";
import { useClienti } from "@/features/clients/useClients";
import {
  useAppuntamenti,
  useCreaAppuntamento,
  useAggiornaAppuntamento,
  useEliminaAppuntamento,
} from "@/features/appointments/useAppointments";
import { oggi, parseDataISO, toDataISO } from "@/lib/dates";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Errore } from "@/components/ui/Stato";
import { useToast } from "@/components/ui/Toast";
import type { Appuntamento, AppuntamentoInput } from "@/types/domain";

const NOMI_GIORNI = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

function meseISO(data: Date): string {
  return format(data, "yyyy-MM");
}

/** Data e ora locali dell'appuntamento, senza passare dal parsing UTC di `new Date(iso)`. */
function parseISODataOra(appuntamento: Appuntamento): Date {
  const giorno = parseDataISO(appuntamento.appointment_date) ?? oggi();
  const [ore, minuti] = appuntamento.start_time.split(":").map(Number);
  return new Date(
    giorno.getFullYear(),
    giorno.getMonth(),
    giorno.getDate(),
    ore,
    minuti,
  );
}

export function AppointmentCalendar() {
  const [mese, setMese] = useState(() => startOfMonth(oggi()));
  const [giornoSelezionato, setGiornoSelezionato] = useState(() => oggi());
  const [dialogAperto, setDialogAperto] = useState(false);
  // Cambia a ogni apertura: rimonta il dialog, che riparte con i campi vuoti.
  const [aperture, setAperture] = useState(0);
  const [daEliminare, setDaEliminare] = useState<Appuntamento | null>(null);
  const [daModificare, setDaModificare] = useState<Appuntamento | null>(null);
  const toast = useToast();
  const meseCorrente = meseISO(mese);
  const appuntamenti = useAppuntamenti(meseCorrente);
  // Tutti, non solo gli attivi: gli appuntamenti passati di un cliente
  // archiviato restano in calendario e devono ancora mostrarne il nome.
  const clienti = useClienti({ stato: "tutti" });
  const clientiAttivi = (clienti.data ?? []).filter((c) => c.active);
  const clienteEventoModificato = daModificare?.client_id
    ? (clienti.data ?? []).find((c) => c.id === daModificare.client_id)
    : undefined;
  const clientiDialog = clienteEventoModificato && !clienteEventoModificato.active
    ? [...clientiAttivi, clienteEventoModificato]
    : clientiAttivi;
  const nomiClienti = new Map(
    (clienti.data ?? []).map((c) => [c.id, `${c.first_name} ${c.last_name}`]),
  );
  const crea = useCreaAppuntamento();
  const aggiorna = useAggiornaAppuntamento();
  const elimina = useEliminaAppuntamento();
  const giorni = eachDayOfInterval({
    start: startOfWeek(startOfMonth(mese), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(mese), { weekStartsOn: 1 }),
  });
  const isoSelezionato = toDataISO(giornoSelezionato);
  const selezionati = (appuntamenti.data ?? []).filter(
    (appuntamento) => appuntamento.appointment_date === isoSelezionato,
  );
  // I giorni passati si possono aprire per consultarli, non per aggiungervi appuntamenti.
  const selezionatoPassato = isBefore(giornoSelezionato, startOfDay(oggi()));

  const vaiAlMese = (nuovoMese: Date) => {
    setMese(startOfMonth(nuovoMese));
    setGiornoSelezionato(nuovoMese);
  };

  const apriDialog = () => {
    setAperture((n) => n + 1);
    setDialogAperto(true);
  };

  const salva = (input: AppuntamentoInput) => {
    if (daModificare) {
      aggiorna.mutate({ id: daModificare.id, input }, {
        onSuccess: (evento) => {
          const data = parseDataISO(evento.appointment_date) ?? oggi();
          setMese(startOfMonth(data));
          setGiornoSelezionato(data);
          setDaModificare(null);
          toast.conferma("Appuntamento modificato.");
        },
        onError: (errore) => toast.errore(messaggioErrore(errore)),
      });
      return;
    }
    crea.mutate(input, {
      onSuccess: () => {
        setDialogAperto(false);
        toast.conferma("Appuntamento salvato.");
      },
      onError: (errore) => toast.errore(messaggioErrore(errore)),
    });
  };

  const confermaEliminazione = () => {
    if (!daEliminare) return;
    elimina.mutate(daEliminare.id, {
      onSuccess: () => {
        setDaEliminare(null);
        toast.conferma("Appuntamento eliminato.");
      },
      onError: (errore) => {
        setDaEliminare(null);
        toast.errore(messaggioErrore(errore));
      },
    });
  };

  return (
    <section
      className="rounded-[22px] border border-line bg-surface p-5 xl:col-span-8 xl:row-span-3"
      aria-labelledby="titolo-calendario"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-accent/10 text-accent">
            <CalendarDays aria-hidden="true" size={19} />
          </span>
          <div>
            <h2 id="titolo-calendario" className="display-tight text-xl">
              Calendario
            </h2>
            <p className="text-sm text-muted">Appuntamenti dello studio</p>
          </div>
        </div>
        <Button
          variante="primario"
          dimensione="sm"
          aria-label="Nuovo appuntamento"
          title={
            selezionatoPassato
              ? "Seleziona oggi o un giorno futuro per aggiungere un appuntamento"
              : "Nuovo appuntamento"
          }
          className="h-9 w-9 !p-0"
          disabled={selezionatoPassato}
          onClick={apriDialog}
        >
          <CalendarPlus aria-hidden="true" size={16} />
        </Button>
      </header>

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_15rem]">
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Mese precedente"
                title="Mese precedente"
                onClick={() => vaiAlMese(subMonths(mese, 1))}
                className="flex h-9 w-9 items-center justify-center rounded-[10px] text-muted hover:bg-white/[0.05] hover:text-ink"
              >
                <ChevronLeft aria-hidden="true" size={18} />
              </button>
              <button
                type="button"
                aria-label="Mese successivo"
                title="Mese successivo"
                onClick={() => vaiAlMese(addMonths(mese, 1))}
                className="flex h-9 w-9 items-center justify-center rounded-[10px] text-muted hover:bg-white/[0.05] hover:text-ink"
              >
                <ChevronRight aria-hidden="true" size={18} />
              </button>
            </div>
            <p className="display-tight text-lg capitalize">
              {format(mese, "MMMM yyyy", { locale: it })}
            </p>
            <button
              type="button"
              onClick={() => vaiAlMese(oggi())}
              className="text-xs text-accent underline underline-offset-4"
            >
              Oggi
            </button>
          </div>

          <div className="grid grid-cols-7 border-l border-t border-line">
            {NOMI_GIORNI.map((nome) => (
              <div
                key={nome}
                className="border-b border-r border-line px-2 py-2 text-center text-[11px] font-medium text-muted"
              >
                {nome}
              </div>
            ))}
            {giorni.map((giorno) => {
              const iso = toDataISO(giorno);
              const passato = isBefore(giorno, startOfDay(oggi()));
              const eventi = (appuntamenti.data ?? []).filter(
                (appuntamento) => appuntamento.appointment_date === iso,
              );
              const selezionato = isSameDay(giorno, giornoSelezionato);
              return (
                <button
                  type="button"
                  key={iso}
                  onClick={() => setGiornoSelezionato(giorno)}
                  className={`min-h-20 border-b border-r border-line p-2 text-left transition-colors hover:bg-accent/10 ${!isSameMonth(giorno, mese) || passato ? "text-muted/40" : "text-ink"} ${selezionato ? "bg-accent/10 ring-1 ring-inset ring-accent" : ""}`}
                >
                  <span
                    className={`nums inline-flex h-6 min-w-6 items-center justify-center rounded-full text-xs ${isSameDay(giorno, oggi()) ? "bg-accent font-semibold text-[#0b0d0e]" : ""}`}
                  >
                    {format(giorno, "d")}
                  </span>
                  <span className="mt-2 block space-y-1">
                    {eventi.slice(0, 2).map((evento) => (
                      <span
                        key={evento.id}
                        className="block truncate rounded bg-accent/15 px-1 py-0.5 text-[10px] text-accent"
                      >
                        {evento.start_time.slice(0, 5)} {evento.title}
                      </span>
                    ))}
                    {eventi.length > 2 ? (
                      <span className="block text-[10px] text-muted">
                        +{eventi.length - 2} altri
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="border-t border-line pt-4 xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0">
          <p className="text-xs font-medium text-muted">
            {format(giornoSelezionato, "EEEE d MMMM", { locale: it })}
          </p>
          {appuntamenti.isLoading ? (
            <p className="mt-4 text-sm text-muted">Caricamento...</p>
          ) : null}
          {appuntamenti.error ? (
            <Errore
              errore={appuntamenti.error}
              onRiprova={() => void appuntamenti.refetch()}
            />
          ) : null}
          {!appuntamenti.isLoading &&
          !appuntamenti.error &&
          selezionati.length === 0 ? (
            <p className="mt-4 text-sm leading-relaxed text-muted">
              Nessun appuntamento. Seleziona un giorno e aggiungine uno.
            </p>
          ) : null}
          <ul className="mt-4 space-y-3">
            {selezionati.map((evento) => (
              <li
                key={evento.id}
                className="rounded-[12px] border border-line px-3 py-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">
                      {evento.title}
                    </p>
                    <p className="mt-1 text-xs text-accent">
                      {evento.start_time.slice(0, 5)} ·{" "}
                      {evento.duration_minutes} min
                    </p>
                    {evento.client_id && nomiClienti.has(evento.client_id) ? (
                      <p className="mt-1 truncate text-xs text-muted">
                        {nomiClienti.get(evento.client_id)}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-center gap-2">
                    <button
                      type="button"
                      aria-label={`Elimina ${evento.title}`}
                      title="Elimina appuntamento"
                      onClick={() => setDaEliminare(evento)}
                      className="text-muted hover:text-scaduta"
                    >
                      <Trash2 aria-hidden="true" size={15} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Modifica ${evento.title}`}
                      title="Modifica appuntamento"
                      onClick={() => setDaModificare(evento)}
                      className="text-muted hover:text-accent"
                    >
                      <Pencil aria-hidden="true" size={15} />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      <AppointmentDialog
        key={daModificare?.id ?? `nuovo-${aperture}`}
        aperto={dialogAperto || daModificare !== null}
        appuntamento={daModificare}
        giorno={giornoSelezionato}
        clienti={clientiDialog}
        inCorso={crea.isPending || aggiorna.isPending}
        onChiudi={() => { setDialogAperto(false); setDaModificare(null); }}
        onSalva={salva}
      />
      <ConfirmDialog
        aperto={daEliminare !== null}
        titolo={`Eliminare ${daEliminare?.title ?? "l'appuntamento"}?`}
        descrizione={
          daEliminare
            ? `${format(parseISODataOra(daEliminare), "EEEE d MMMM 'alle' HH:mm", { locale: it })}. Sparisce anche dai calendari iscritti al feed.`
            : ""
        }
        etichettaConferma="Elimina appuntamento"
        distruttivo
        inCorso={elimina.isPending}
        onAnnulla={() => setDaEliminare(null)}
        onConferma={confermaEliminazione}
      />
    </section>
  );
}

function AppointmentDialog({
  aperto,
  appuntamento,
  giorno,
  clienti,
  inCorso,
  onChiudi,
  onSalva,
}: {
  aperto: boolean;
  appuntamento: Appuntamento | null;
  giorno: Date;
  clienti: Array<{ id: string; first_name: string; last_name: string }>;
  inCorso: boolean;
  onChiudi: () => void;
  onSalva: (input: AppuntamentoInput) => void;
}) {
  const [titolo, setTitolo] = useState(appuntamento?.title ?? "");
  const [data, setData] = useState(appuntamento?.appointment_date ?? toDataISO(giorno));
  const [ora, setOra] = useState(appuntamento?.start_time.slice(0, 5) ?? "09:00");
  const [durata, setDurata] = useState(String(appuntamento?.duration_minutes ?? 60));
  const [cliente, setCliente] = useState(appuntamento?.client_id ?? "");
  const [note, setNote] = useState(appuntamento?.notes ?? "");

  return (
    <Dialog
      aperto={aperto}
      titolo={appuntamento ? "Modifica appuntamento" : "Nuovo appuntamento"}
      descrizione={appuntamento ? "Aggiorna i dettagli dell'appuntamento." : format(giorno, "EEEE d MMMM yyyy", { locale: it })}
      onChiudi={onChiudi}
      azioni={
        <>
          <Button onClick={onChiudi} disabled={inCorso}>
            Annulla
          </Button>
          <Button
            variante="primario"
            onClick={() =>
              onSalva({
                client_id: cliente || null,
                title: titolo.trim() || "Appuntamento",
                appointment_date: data,
                start_time: `${ora}:00`,
                duration_minutes: Number(durata),
                notes: note.trim() || null,
              })
            }
            disabled={inCorso || !titolo.trim()}
          >
            {appuntamento ? "Salva modifiche" : "Salva appuntamento"}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="Titolo">
          {(props) => (
            <Input
              {...props}
              value={titolo}
              onChange={(e) => setTitolo(e.target.value)}
              placeholder="Es. Sessione individuale"
              autoFocus
            />
          )}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Data">
            {(props) => <Input {...props} type="date" value={data} onChange={(e) => setData(e.target.value)} />}
          </Field>
          <Field label="Orario">
            {(props) => (
              <Input
                {...props}
                type="time"
                value={ora}
                onChange={(e) => setOra(e.target.value)}
              />
            )}
          </Field>
          <Field label="Durata">
            {(props) => (
              <Select
                {...props}
                value={durata}
                onChange={(e) => setDurata(e.target.value)}
              >
                <option value="30">30 minuti</option>
                <option value="45">45 minuti</option>
                <option value="60">1 ora</option>
                <option value="90">1 ora e mezza</option>
                <option value="120">2 ore</option>
              </Select>
            )}
          </Field>
        </div>
        <Field label="Cliente (facoltativo)">
          {(props) => (
            <Select
              {...props}
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
            >
              <option value="">Nessun cliente associato</option>
              {clienti.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.last_name} {item.first_name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Note (facoltative)">
          {(props) => (
            <Textarea
              {...props}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Dettagli utili per la sessione"
            />
          )}
        </Field>
      </div>
    </Dialog>
  );
}
