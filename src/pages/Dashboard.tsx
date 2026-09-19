import { CircleAlert, UserPlus } from "lucide-react";
import { Link } from "react-router-dom";
import { AppointmentCalendar } from "@/components/dashboard/AppointmentCalendar";
import { Button } from "@/components/ui/Button";
import { Errore } from "@/components/ui/Stato";
import { calcolaScadenza, ordinaPerUrgenza } from "@/features/plans/planExpiry";
import {
  useDashboardSommario,
  useSchedeInScadenza,
} from "@/features/plans/usePlans";
import { useSogliaReminder } from "@/features/settings/useSettings";

export default function Dashboard() {
  const soglia = useSogliaReminder();
  const sommario = useDashboardSommario();
  const scadenze = useSchedeInScadenza();

  const righe = ordinaPerUrgenza(
    (scadenze.data ?? []).map((scheda) => ({
      scheda,
      scadenza: calcolaScadenza(
        {
          end_date: scheda.end_date,
          status: scheda.status,
          clienteAttivo: true,
        },
        soglia,
      ),
    })),
  );
  const priorita = righe.slice(0, 5);

  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-5 border-b border-line pb-5">
        <div>
          <div>
            <h1 className="display text-4xl leading-none text-ink sm:text-3xl">
              Ciao,{" "}
              <h1 className="display text-4xl leading-none text-accent sm:text-5xl">
                Giovanni!
              </h1>
            </h1>
          </div>
        </div>
        <Link to="/clienti?nuovo=1">
          <Button
            variante="primario"
            aria-label="Nuovo cliente"
            title="Nuovo cliente"
            className="h-11 w-11 !p-0"
          >
            <UserPlus aria-hidden="true" size={18} strokeWidth={2.2} />
          </Button>
        </Link>
      </header>

      {sommario.error ? (
        <Errore
          errore={sommario.error}
          onRiprova={() => void sommario.refetch()}
        />
      ) : null}

      <div className="grid min-h-[calc(100dvh-12rem)] grid-cols-1 auto-rows-min gap-4 md:grid-cols-2 xl:grid-cols-12">
        <section
          className="relative overflow-hidden rounded-[22px] border border-accent/35 bg-accent p-6 text-[#0b0d0e] md:col-span-2 xl:col-span-4 xl:row-span-3"
          aria-labelledby="titolo-rinnovi-focus"
        >
          <div className="relative z-10 flex h-full min-h-64 flex-col justify-between">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="titolo-rinnovi-focus" className="text-sm font-semibold">
                  Da rinnovare
                </h2>
                <p className="mt-2 max-w-[24ch] text-sm/relaxed text-[#0b0d0e]/75">
                  Schede attive che richiedono attenzione entro {soglia}{" "}
                  {soglia === 1 ? "giorno" : "giorni"}.
                </p>
              </div>
              <CircleAlert aria-hidden="true" size={24} strokeWidth={1.8} />
            </div>
            <div>
              <p className="nums text-6xl font-semibold leading-none tracking-[-0.07em] sm:text-7xl">
                {sommario.isLoading
                  ? "—"
                  : (sommario.data?.schedeInScadenza ?? 0)}
              </p>
              <p className="mt-2 text-sm font-medium text-[#0b0d0e]/70">
                schede da controllare
              </p>
            </div>
            <div className="relative z-10 mt-8 border-t border-[#0b0d0e]/15 pt-5">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h3 id="titolo-rinnovi" className="text-sm font-semibold">
                  Rinnovi prioritari
                </h3>
              </div>
              {scadenze.isLoading ? (
                <p className="text-sm text-[#0b0d0e]/65">
                  Carico le priorita...
                </p>
              ) : null}
              {!scadenze.isLoading &&
              !scadenze.error &&
              priorita.length === 0 ? (
                <p className="text-sm text-[#0b0d0e]/65">
                  Nessuna scheda urgente.
                </p>
              ) : null}
              {priorita.length > 0 ? (
                <ul className="divide-y divide-[#0b0d0e]/15">
                  {priorita.map(({ scheda, scadenza }) => (
                    <li
                      key={scheda.id}
                      className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <Link
                          to={`/clienti/${scheda.client_id}`}
                          className="block truncate text-base font-semibold leading-tight hover:underline"
                        >
                          {scheda.cliente_nome}
                        </Link>
                        <Link
                          to={`/schede/${scheda.id}`}
                          className="mt-1 block truncate text-sm leading-tight text-[#0b0d0e]/75 hover:underline"
                        >
                          {scheda.title}
                        </Link>
                      </div>
                      <span className="shrink-0 text-right text-sm font-semibold">
                        {scadenza.giorniResidui === null
                          ? "Scadenza"
                          : scadenza.giorniResidui < 0
                            ? `${Math.abs(scadenza.giorniResidui)} gg fa`
                            : `${scadenza.giorniResidui} gg`}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <Link
                to="/clienti"
                className="mt-4 inline-flex text-xs font-semibold underline underline-offset-4 hover:no-underline"
              >
                Vedi tutti i clienti
              </Link>
            </div>
          </div>
          <div
            aria-hidden="true"
            className="absolute -bottom-20 -right-12 h-64 w-64 rounded-full border-[36px] border-[#0b0d0e]/10"
          />
        </section>

        <AppointmentCalendar />
      </div>
    </div>
  );
}
