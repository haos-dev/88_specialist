import { useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
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
} from "lucide-react";
import { useClienti } from "@/features/clients/useClients";
import {
  useAppuntamenti,
  useCreaAppuntamento,
  useEliminaAppuntamento,
} from "@/features/plans/usePlans";
import { oggi, toDataISO } from "@/lib/dates";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Errore } from "@/components/ui/Stato";
import type { AppuntamentoInput } from "@/types/domain";

const NOMI_GIORNI = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

function meseISO(data: Date): string {
  return format(data, "yyyy-MM");
}

export function AppointmentCalendar() {
  const [mese, setMese] = useState(() => startOfMonth(oggi()));
  const [giornoSelezionato, setGiornoSelezionato] = useState(() => oggi());
  const [dialogAperto, setDialogAperto] = useState(false);
  const meseCorrente = meseISO(mese);
  const appuntamenti = useAppuntamenti(meseCorrente);
  const clienti = useClienti({ stato: "attivi" });
  const crea = useCreaAppuntamento(meseCorrente);
  const elimina = useEliminaAppuntamento(meseCorrente);
  const giorni = eachDayOfInterval({
    start: startOfWeek(startOfMonth(mese), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(mese), { weekStartsOn: 1 }),
  });
  const selezionati = (appuntamenti.data ?? []).filter((appuntamento) =>
    isSameDay(
      new Date(`${appuntamento.appointment_date}T12:00:00`),
      giornoSelezionato,
    ),
  );

  const vaiAlMese = (nuovoMese: Date) => {
    setMese(startOfMonth(nuovoMese));
    setGiornoSelezionato(startOfMonth(nuovoMese));
  };

  const salva = (input: AppuntamentoInput) => {
    crea.mutate(input, { onSuccess: () => setDialogAperto(false) });
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
          title="Nuovo appuntamento"
          className="h-9 w-9 !p-0"
          onClick={() => setDialogAperto(true)}
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
              const eventi = (appuntamenti.data ?? []).filter(
                (appuntamento) => appuntamento.appointment_date === iso,
              );
              const selezionato = isSameDay(giorno, giornoSelezionato);
              return (
                <button
                  type="button"
                  key={iso}
                  onClick={() => setGiornoSelezionato(giorno)}
                  className={`min-h-20 border-b border-r border-line p-2 text-left transition-colors hover:bg-accent/10 ${!isSameMonth(giorno, mese) ? "text-muted/40" : "text-ink"} ${selezionato ? "bg-accent/10 ring-1 ring-inset ring-accent" : ""}`}
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
                    {evento.client_id ? (
                      <p className="mt-1 truncate text-xs text-muted">
                        {clienti.data?.find(
                          (cliente) => cliente.id === evento.client_id,
                        )
                          ? `${clienti.data.find((cliente) => cliente.id === evento.client_id)?.first_name} ${clienti.data.find((cliente) => cliente.id === evento.client_id)?.last_name}`
                          : "Cliente archiviato"}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    aria-label={`Elimina ${evento.title}`}
                    title="Elimina appuntamento"
                    onClick={() => elimina.mutate(evento.id)}
                    className="text-muted hover:text-scaduta"
                  >
                    <Trash2 aria-hidden="true" size={15} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      <AppointmentDialog
        aperto={dialogAperto}
        giorno={giornoSelezionato}
        clienti={clienti.data ?? []}
        inCorso={crea.isPending}
        onChiudi={() => setDialogAperto(false)}
        onSalva={salva}
      />
    </section>
  );
}

function AppointmentDialog({
  aperto,
  giorno,
  clienti,
  inCorso,
  onChiudi,
  onSalva,
}: {
  aperto: boolean;
  giorno: Date;
  clienti: Array<{ id: string; first_name: string; last_name: string }>;
  inCorso: boolean;
  onChiudi: () => void;
  onSalva: (input: AppuntamentoInput) => void;
}) {
  const [titolo, setTitolo] = useState("");
  const [ora, setOra] = useState("09:00");
  const [durata, setDurata] = useState("60");
  const [cliente, setCliente] = useState("");
  const [note, setNote] = useState("");

  return (
    <Dialog
      aperto={aperto}
      titolo="Nuovo appuntamento"
      descrizione={format(giorno, "EEEE d MMMM yyyy", { locale: it })}
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
                appointment_date: toDataISO(giorno),
                start_time: `${ora}:00`,
                duration_minutes: Number(durata),
                notes: note.trim() || null,
              })
            }
            disabled={inCorso || !titolo.trim()}
          >
            Salva appuntamento
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
