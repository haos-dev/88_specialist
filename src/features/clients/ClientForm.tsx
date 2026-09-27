import {
  useForm,
  useWatch,
  type Control,
  type FieldErrors,
  type UseFormRegister,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Dialog } from "@/components/ui/Dialog";
import { formatData, oggi, toDataISO } from "@/lib/dates";
import type { Cliente, ClienteInput, LezioneInput } from "@/types/domain";
import {
  FINE_MASSIMA_MESI,
  GIORNI_SETTIMANA,
  fineMassima,
  fineProposta,
  generaLezioni,
  titoloLezione,
  type Allenamento,
} from "./trainingSchedule";

/** Stringa vuota → null: in Postgres "non indicato" è NULL, non ''. */
const opzionale = z
  .string()
  .trim()
  .transform((v) => (v.length === 0 ? null : v));

/** Come `opzionale`, ma per i campi corporei: stringa vuota → null, altrimenti un numero nel range del vincolo Postgres (0007). */
function numeroOpzionale(min: number, max: number, messaggio: string) {
  return z
    .string()
    .trim()
    .transform((v) => (v.length === 0 ? null : Number(v)))
    .refine((v) => v === null || (!Number.isNaN(v) && v >= min && v <= max), {
      message: messaggio,
    });
}

/** Una riga per giorno della settimana, nell'ordine di `GIORNI_SETTIMANA`. */
type RigaGiorno = { attivo: boolean; ora: string };

function allenamentiScelti(righe: RigaGiorno[]): Allenamento[] {
  return righe.flatMap((riga, i) =>
    riga.attivo && riga.ora
      ? [{ giorno: GIORNI_SETTIMANA[i].giorno, ora: riga.ora }]
      : [],
  );
}

/**
 * Giorni di allenamento, solo alla creazione. Oggetto a sé perché il suo
 * `superRefine` giri anche quando un altro campo del form è ancora invalido:
 * una refine sullo schema intero verrebbe saltata.
 */
const programma = z
  .object({
    giorni: z.array(z.object({ attivo: z.boolean(), ora: z.string() })),
    fine: z.string(),
  })
  .superRefine(({ giorni, fine }, ctx) => {
    giorni.forEach((riga, i) => {
      if (riga.attivo && !riga.ora) {
        ctx.addIssue({
          code: "custom",
          path: ["giorni", i, "ora"],
          message: "Indica l'orario.",
        });
      }
    });
    if (!giorni.some((riga) => riga.attivo)) return;

    if (!fine) {
      ctx.addIssue({
        code: "custom",
        path: ["fine"],
        message: "Indica fino a quando.",
      });
    } else if (fine < toDataISO(oggi())) {
      ctx.addIssue({
        code: "custom",
        path: ["fine"],
        message: "La data di fine è già passata.",
      });
    } else if (fine > fineMassima()) {
      ctx.addIssue({
        code: "custom",
        path: ["fine"],
        message: `Al massimo ${FINE_MASSIMA_MESI} mesi da oggi.`,
      });
    } else if (
      generaLezioni(allenamentiScelti(giorni), fine, "").length === 0
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["fine"],
        message: "Nessuno dei giorni scelti cade in questo periodo.",
      });
    }
  });

const schema = z.object({
  first_name: z
    .string()
    .trim()
    .min(1, "Il nome serve per identificare il cliente."),
  last_name: z
    .string()
    .trim()
    .min(1, "Il cognome serve per identificare il cliente."),
  email: opzionale.refine(
    (v) => v === null || z.string().email().safeParse(v).success,
    {
      message: "Questo non è un indirizzo email valido.",
    },
  ),
  phone: opzionale,
  birth_date: opzionale,
  height_cm: numeroOpzionale(50, 250, "L'altezza va tra 50 e 250 cm."),
  weight_kg: numeroOpzionale(20, 400, "Il peso va tra 20 e 400 kg."),
  goal: opzionale,
  notes: opzionale,
  programma,
});

type Campi = z.input<typeof schema>;
type CampiPuliti = z.output<typeof schema>;

interface ClientFormProps {
  aperto: boolean;
  cliente?: Cliente | null;
  inCorso?: boolean;
  /** `lezioni` è sempre vuoto in modifica: i giorni si scelgono solo alla creazione. */
  onSalva: (input: ClienteInput, lezioni: LezioneInput[]) => void;
  onChiudi: () => void;
}

export function ClientForm({
  aperto,
  cliente,
  inCorso,
  onSalva,
  onChiudi,
}: ClientFormProps) {
  const modifica = Boolean(cliente);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
    // Il terzo generico è il tipo *dopo* le trasformazioni dello schema:
    // senza, `handleSubmit` consegnerebbe le stringhe grezze invece dei null.
  } = useForm<Campi, unknown, CampiPuliti>({
    resolver: zodResolver(schema),
    values: {
      first_name: cliente?.first_name ?? "",
      last_name: cliente?.last_name ?? "",
      email: cliente?.email ?? "",
      phone: cliente?.phone ?? "",
      birth_date: cliente?.birth_date ?? "",
      height_cm: cliente?.height_cm != null ? String(cliente.height_cm) : "",
      weight_kg: cliente?.weight_kg != null ? String(cliente.weight_kg) : "",
      goal: cliente?.goal ?? "",
      notes: cliente?.notes ?? "",
      programma: {
        giorni: GIORNI_SETTIMANA.map(() => ({ attivo: false, ora: "" })),
        fine: fineProposta(),
      },
    },
  });

  const invia = handleSubmit(({ programma, ...campi }) => {
    const input = campi as ClienteInput;
    const lezioni = modifica
      ? []
      : generaLezioni(
          allenamentiScelti(programma.giorni),
          programma.fine,
          titoloLezione(input.first_name, input.last_name),
        );
    onSalva(input, lezioni);
  });

  const chiudi = () => {
    reset();
    onChiudi();
  };

  return (
    <Dialog
      aperto={aperto}
      titolo={modifica ? "Modifica cliente" : "Nuovo cliente"}
      onChiudi={chiudi}
      nascondiScrollbar
      azioni={
        <>
          <Button onClick={chiudi} disabled={inCorso}>
            Annulla
          </Button>
          <Button
            variante="primario"
            onClick={() => void invia()}
            disabled={inCorso}
          >
            {inCorso
              ? "Salvataggio…"
              : modifica
                ? "Salva modifiche"
                : "Crea cliente"}
          </Button>
        </>
      }
    >
      <form onSubmit={invia} className="flex flex-col gap-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome" obbligatorio errore={errors.first_name?.message}>
            {(props) => (
              <Input
                {...props}
                {...register("first_name")}
                autoFocus
                autoComplete="off"
                aria-invalid={Boolean(errors.first_name)}
              />
            )}
          </Field>
          <Field
            label="Cognome"
            obbligatorio
            errore={errors.last_name?.message}
          >
            {(props) => (
              <Input
                {...props}
                {...register("last_name")}
                autoComplete="off"
                aria-invalid={Boolean(errors.last_name)}
              />
            )}
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" errore={errors.email?.message}>
            {(props) => (
              <Input
                {...props}
                {...register("email")}
                type="email"
                autoComplete="off"
                aria-invalid={Boolean(errors.email)}
              />
            )}
          </Field>
          <Field label="Telefono" errore={errors.phone?.message}>
            {(props) => (
              <Input
                {...props}
                {...register("phone")}
                type="tel"
                autoComplete="off"
              />
            )}
          </Field>
        </div>

        <Field label="Data di nascita" errore={errors.birth_date?.message}>
          {(props) => (
            <Input
              {...props}
              {...register("birth_date")}
              type="date"
              className="sm:max-w-48"
            />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Altezza (cm)" errore={errors.height_cm?.message}>
            {(props) => (
              <Input
                {...props}
                {...register("height_cm")}
                type="number"
                inputMode="decimal"
                step="0.1"
                min={50}
                max={250}
                aria-invalid={Boolean(errors.height_cm)}
              />
            )}
          </Field>
          <Field label="Peso (kg)" errore={errors.weight_kg?.message}>
            {(props) => (
              <Input
                {...props}
                {...register("weight_kg")}
                type="number"
                inputMode="decimal"
                step="0.1"
                min={20}
                max={400}
                aria-invalid={Boolean(errors.weight_kg)}
              />
            )}
          </Field>
        </div>

        <Field
          label="Obiettivo"
          errore={errors.goal?.message}
          aiuto="Es. ipertrofia, dimagrimento, una gara specifica."
        >
          {(props) => (
            <Input {...props} {...register("goal")} autoComplete="off" />
          )}
        </Field>

        <Field
          label="Note"
          aiuto="Infortuni e limitazioni: quello che serve ricordare quando costruisci una scheda."
          errore={errors.notes?.message}
        >
          {(props) => <Textarea {...props} {...register("notes")} rows={4} />}
        </Field>

        {!modifica && (
          <GiorniAllenamento
            register={register}
            control={control}
            errori={errors.programma}
          />
        )}

        {/* Permette l'invio con Invio da dentro un campo. */}
        <button
          type="submit"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        >
          Salva
        </button>
      </form>
    </Dialog>
  );
}

/**
 * Giorni e orari in cui il cliente si allena: ogni giorno scelto diventa una
 * lezione di un'ora in calendario, da oggi alla data di fine.
 */
function GiorniAllenamento({
  register,
  control,
  errori,
}: {
  register: UseFormRegister<Campi>;
  control: Control<Campi, unknown, CampiPuliti>;
  errori: FieldErrors<Campi>["programma"];
}) {
  const valori = useWatch({ control, name: "programma" });
  const lezioni = generaLezioni(
    allenamentiScelti(valori.giorni),
    valori.fine,
    "",
  );
  const nessunGiorno = !valori.giorni.some((riga) => riga.attivo);

  return (
    <fieldset className="flex flex-col gap-3 border-t border-line pt-4">
      <legend className="float-left mb-1 w-full text-sm font-medium text-ink">
        Giorni di allenamento
      </legend>
      <p className="-mt-2 text-xs text-muted">
        Facoltativo. Ogni giorno scelto diventa una lezione di un&apos;ora in
        calendario, da oggi alla data di fine.
      </p>

      <ul className="flex flex-col gap-1">
        {GIORNI_SETTIMANA.map(({ giorno, nome }, i) => {
          const attivo = valori.giorni[i]?.attivo;
          const errore = errori?.giorni?.[i]?.ora?.message;
          return (
            <li
              key={giorno}
              className="flex min-h-10 flex-wrap items-center gap-x-3 gap-y-1"
            >
              <label className="flex w-28 items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-accent"
                  {...register(`programma.giorni.${i}.attivo`)}
                />
                {nome}
              </label>
              {attivo ? (
                <Input
                  type="time"
                  aria-label={`Orario ${nome.toLowerCase()}`}
                  aria-invalid={Boolean(errore)}
                  title={errore}
                  className="!w-36"
                  {...register(`programma.giorni.${i}.ora`)}
                />
              ) : null}
              {errore ? (
                <span className="w-full text-xs text-scaduta">{errore}</span>
              ) : null}
            </li>
          );
        })}
      </ul>

      {!nessunGiorno && (
        <Field
          label="Fino al"
          errore={errori?.fine?.message}
          aiuto={
            lezioni.length > 0
              ? `${lezioni.length} ${lezioni.length === 1 ? "lezione" : "lezioni"}, dal ${formatData(lezioni[0].appointment_date)} al ${formatData(lezioni[lezioni.length - 1].appointment_date)}.`
              : undefined
          }
        >
          {(props) => (
            <Input
              {...props}
              {...register("programma.fine")}
              type="date"
              min={toDataISO(oggi())}
              max={fineMassima()}
              className="sm:max-w-48"
              aria-invalid={Boolean(errori?.fine)}
            />
          )}
        </Field>
      )}
    </fieldset>
  );
}
