import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Caricamento, Errore } from "@/components/ui/Stato";
import { useToast } from "@/components/ui/Toast";
import {
  useImpostazioni,
  useSalvaImpostazioni,
  useRigeneraTokenCalendario,
} from "@/features/settings/useSettings";
import { SOGLIA_REMINDER_DEFAULT } from "@/features/plans/planExpiry";
import { messaggioErrore, type ImpostazioniInput } from "@/data";
import { useAuth } from "@/components/auth/AuthProvider";

const SUPABASE_URL_FEED = import.meta.env.VITE_SUPABASE_URL as
  | string
  | undefined;

function urlFeedCalendario(token: string): string {
  if (!SUPABASE_URL_FEED) return "";
  return `${SUPABASE_URL_FEED}/functions/v1/calendar-feed?token=${token}`;
}

const schema = z.object({
  reminder_days_before: z.coerce
    .number({ message: "Inserisci un numero di giorni." })
    .int("Inserisci un numero intero di giorni.")
    .min(0, "Il preavviso non può essere negativo.")
    .max(365, "Un anno di preavviso è troppo: usa un valore più basso."),
});

type Campi = z.input<typeof schema>;
type CampiPuliti = z.output<typeof schema>;

export default function Settings() {
  const impostazioni = useImpostazioni();
  const salva = useSalvaImpostazioni();
  const rigeneraToken = useRigeneraTokenCalendario();
  const toast = useToast();
  const { esci } = useAuth();

  const {
    register,
    trigger,
    formState: { errors },
  } = useForm<Campi, unknown, CampiPuliti>({
    resolver: zodResolver(schema),
    mode: "onChange",
    values: {
      reminder_days_before:
        impostazioni.data?.reminder_days_before ?? SOGLIA_REMINDER_DEFAULT,
    },
  });

  if (impostazioni.isLoading) return <Caricamento />;
  if (impostazioni.error) {
    return (
      <Errore
        errore={impostazioni.error}
        onRiprova={() => void impostazioni.refetch()}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-5 border-b border-line pb-5">
        <div>
          <h1 className="display text-4xl leading-none text-ink sm:text-5xl">
            Settings
          </h1>
        </div>
      </header>

      <div className="flex flex-col gap-8">
        <section className="flex flex-col gap-4">
          <h2 className="display-tight text-lg">Scadenze</h2>

          <Field
            label="Giorni di preavviso"
            aiuto="Le schede compaiono nel promemoria quando mancano meno di questi giorni alla scadenza."
            errore={errors.reminder_days_before?.message}
          >
            {(props) => (
              <Input
                {...props}
                {...register("reminder_days_before", {
                  onChange: async (event) => {
                    const valido = schema.safeParse({
                      reminder_days_before: event.target.value,
                    });
                    await trigger("reminder_days_before");
                    if (!valido.success) return;
                    salva.mutate(
                      {
                        reminder_days_before: valido.data.reminder_days_before,
                      } as ImpostazioniInput,
                      {
                        onError: (errore) =>
                          toast.errore(messaggioErrore(errore)),
                      },
                    );
                  },
                })}
                type="number"
                min={0}
                max={365}
                className="w-20"
                aria-invalid={Boolean(errors.reminder_days_before)}
              />
            )}
          </Field>
        </section>
      </div>

      <section className="mt-12 border-t border-line pt-5">
        <h2 className="display-tight text-lg">Calendario</h2>
        <p className="mt-1 text-sm text-muted">
          Iscriviti a questo indirizzo da Apple Calendar, Google Calendar o
          Outlook per vedere gli appuntamenti anche sul telefono. Il feed è a
          senso unico: gli appuntamenti inseriti qui compaiono nel calendario,
          ma non il contrario.
        </p>

        {impostazioni.data?.calendar_feed_token ? (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              aria-label="Link del feed calendario"
              readOnly
              value={urlFeedCalendario(impostazioni.data.calendar_feed_token)}
              onFocus={(e) => e.currentTarget.select()}
              className="font-mono text-xs sm:flex-1"
            />
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={() => {
                  void navigator.clipboard
                    .writeText(
                      urlFeedCalendario(
                        impostazioni.data!.calendar_feed_token!,
                      ),
                    )
                    .then(() => toast.conferma("Link copiato."))
                    .catch(() =>
                      toast.errore("Non sono riuscito a copiare il link."),
                    );
                }}
              >
                Copia
              </Button>
              <Button
                type="button"
                onClick={() => {
                  if (
                    !window.confirm(
                      "Rigenerare il link? Quello attuale smetterà di funzionare: dovrai iscriverti di nuovo su ogni dispositivo.",
                    )
                  )
                    return;
                  rigeneraToken.mutate(undefined, {
                    onSuccess: () => toast.conferma("Nuovo link generato."),
                    onError: (errore) => toast.errore(messaggioErrore(errore)),
                  });
                }}
                disabled={rigeneraToken.isPending}
              >
                {rigeneraToken.isPending ? "Rigenero…" : "Rigenera link"}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            className="mt-4"
            onClick={() =>
              rigeneraToken.mutate(undefined, {
                onError: (errore) => toast.errore(messaggioErrore(errore)),
              })
            }
            disabled={rigeneraToken.isPending}
          >
            {rigeneraToken.isPending ? "Genero…" : "Genera link"}
          </Button>
        )}
      </section>

      <section className="mt-12 border-t border-line pt-5">
        <div className="flex justify-end">
          <Button
            variante="fantasma"
            className="shrink-0 border border-line text-scaduta hover:bg-scaduta-soft hover:text-scaduta"
            onClick={() => void esci()}
          >
            Logout
          </Button>
        </div>
      </section>
    </div>
  );
}
