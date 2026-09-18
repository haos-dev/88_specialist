import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
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

const opzionale = z
  .string()
  .trim()
  .transform((v) => (v.length === 0 ? null : v));

const colore = opzionale.refine(
  (v) => v === null || /^#[0-9a-fA-F]{6}$/.test(v),
  {
    message: "Serve un colore in formato #RRGGBB.",
  },
);

const schema = z.object({
  business_name: opzionale,
  logo_url: opzionale.refine((v) => v === null || /^https?:\/\//.test(v), {
    message: "Serve un indirizzo che inizi con http:// o https://",
  }),
  primary_color: colore,
  secondary_color: colore,
  address: opzionale,
  phone: opzionale,
  email: opzionale.refine(
    (v) => v === null || z.string().email().safeParse(v).success,
    {
      message: "Questo non è un indirizzo email valido.",
    },
  ),
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
  const { esci, sessione } = useAuth();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isDirty },
  } = useForm<Campi, unknown, CampiPuliti>({
    resolver: zodResolver(schema),
    values: {
      business_name: impostazioni.data?.business_name ?? "",
      logo_url: impostazioni.data?.logo_url ?? "",
      primary_color: impostazioni.data?.primary_color ?? "",
      secondary_color: impostazioni.data?.secondary_color ?? "",
      address: impostazioni.data?.address ?? "",
      phone: impostazioni.data?.phone ?? "",
      email: impostazioni.data?.email ?? "",
      reminder_days_before:
        impostazioni.data?.reminder_days_before ?? SOGLIA_REMINDER_DEFAULT,
    },
  });

  const logo = watch("logo_url");

  const invia = handleSubmit((campi) => {
    salva.mutate(campi as ImpostazioniInput, {
      onSuccess: () => toast.conferma("Impostazioni salvate."),
      onError: (errore) => toast.errore(messaggioErrore(errore)),
    });
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
    <>
      <PageHeader
        titolo="Impostazioni"
        descrizione="Come ti presenti sulle schede stampate, e quanto preavviso vuoi sulle scadenze."
      />

      <form
        onSubmit={invia}
        className="flex max-w-2xl flex-col gap-8"
        noValidate
      >
        <section className="flex flex-col gap-4">
          <h2 className="display-tight border-b border-line pb-1.5 text-lg">
            Intestazione delle schede
          </h2>

          <Field
            label="Nome dell'attività"
            errore={errors.business_name?.message}
          >
            {(props) => (
              <Input
                {...props}
                {...register("business_name")}
                placeholder="Es. Studio Forma"
              />
            )}
          </Field>

          <Field
            label="Logo"
            aiuto="Indirizzo pubblico dell'immagine. Compare in alto a destra sul foglio stampato."
            errore={errors.logo_url?.message}
          >
            {(props) => (
              <Input
                {...props}
                {...register("logo_url")}
                type="url"
                placeholder="https://…"
                aria-invalid={Boolean(errors.logo_url)}
              />
            )}
          </Field>

          {logo && !errors.logo_url && (
            <img
              src={logo}
              alt=""
              className="h-16 w-auto max-w-48 border border-line object-contain p-1"
              onError={(e) => {
                e.currentTarget.style.visibility = "hidden";
              }}
            />
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Colore principale"
              errore={errors.primary_color?.message}
            >
              {(props) => (
                <Input
                  {...props}
                  {...register("primary_color")}
                  placeholder="#0E5C52"
                  aria-invalid={Boolean(errors.primary_color)}
                />
              )}
            </Field>
            <Field
              label="Colore secondario"
              errore={errors.secondary_color?.message}
            >
              {(props) => (
                <Input
                  {...props}
                  {...register("secondary_color")}
                  placeholder="#2E9C8A"
                  aria-invalid={Boolean(errors.secondary_color)}
                />
              )}
            </Field>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="display-tight border-b border-line pb-1.5 text-lg">
            Recapiti
          </h2>

          <Field label="Indirizzo" errore={errors.address?.message}>
            {(props) => (
              <Textarea {...props} {...register("address")} rows={2} />
            )}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Telefono" errore={errors.phone?.message}>
              {(props) => (
                <Input {...props} {...register("phone")} type="tel" />
              )}
            </Field>
            <Field label="Email" errore={errors.email?.message}>
              {(props) => (
                <Input
                  {...props}
                  {...register("email")}
                  type="email"
                  aria-invalid={Boolean(errors.email)}
                />
              )}
            </Field>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="display-tight border-b border-line pb-1.5 text-lg">
            Promemoria scadenze
          </h2>

          <Field
            label="Giorni di preavviso"
            aiuto="Una scheda compare fra quelle da rinnovare quando mancano meno di questi giorni alla sua data di fine."
            errore={errors.reminder_days_before?.message}
          >
            {(props) => (
              <Input
                {...props}
                {...register("reminder_days_before")}
                type="number"
                min={0}
                max={365}
                className="sm:max-w-28"
                aria-invalid={Boolean(errors.reminder_days_before)}
              />
            )}
          </Field>
        </section>

        <div className="flex items-center gap-3 border-t border-line pt-5">
          <Button
            type="submit"
            variante="primario"
            disabled={salva.isPending || !isDirty}
          >
            {salva.isPending ? "Salvataggio…" : "Salva impostazioni"}
          </Button>
          {!isDirty && !salva.isPending && (
            <span className="text-sm text-muted">
              Nessuna modifica da salvare.
            </span>
          )}
        </div>
      </form>

      <section className="mt-12 max-w-2xl border-t border-line pt-5">
        <h2 className="display-tight text-lg">Feed calendario</h2>
        <p className="mt-1 text-sm text-muted">
          Iscriviti a questo indirizzo da Apple Calendar, Google Calendar o
          Outlook (&quot;aggiungi calendario da URL&quot;) per vedere i tuoi
          appuntamenti anche sul telefono. Funziona in un verso solo: quello
          che inserisci qui compare lì, non il contrario. L&apos;app di
          calendario ricontrolla periodicamente da sola — di solito entro
          poche ore, non è immediato.
        </p>

        {impostazioni.data?.calendar_feed_token ? (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
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
                    onError: (errore) =>
                      toast.errore(messaggioErrore(errore)),
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

      <section className="mt-12 max-w-2xl border-t border-line pt-5">
        <h2 className="display-tight text-lg">Accesso</h2>
        <p className="mt-1 text-sm text-muted">
          Sei entrato come {sessione?.email}.
        </p>
        <Button className="mt-3" onClick={() => void esci()}>
          Esci
        </Button>
      </section>
    </>
  );
}
