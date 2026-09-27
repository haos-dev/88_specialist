import {
  useForm,
  useWatch,
  type Control,
  type FieldErrors,
  type UseFormRegister,
  type UseFormSetValue,
} from "react-hook-form";
import { useId, type ReactNode } from "react";
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
    // Finché manca un orario la data di fine non si può giudicare: i giorni
    // senza orario non generano lezioni, e l'errore sarebbe fuorviante.
    if (giorni.some((riga) => riga.attivo && !riga.ora)) return;

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
    setValue,
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
      <form onSubmit={invia} className="flex flex-col gap-6" noValidate>
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Nome"
              obbligatorio
              errore={errors.first_name?.message}
            >
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

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-[1.5fr_1fr_1fr]">
            <div className="col-span-2 sm:col-span-1">
              <Field
                label="Data di nascita"
                errore={errors.birth_date?.message}
              >
                {(props) => (
                  <Input {...props} {...register("birth_date")} type="date" />
                )}
              </Field>
            </div>
            <Field label="Altezza" errore={errors.height_cm?.message}>
              {(props) => (
                <ConUnita unita="cm" descrittoDa={props["aria-describedby"]}>
                  {(descrittoDa) => (
                    <Input
                      {...props}
                      {...register("height_cm")}
                      aria-describedby={descrittoDa}
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      min={50}
                      max={250}
                      className="pr-10"
                      aria-invalid={Boolean(errors.height_cm)}
                    />
                  )}
                </ConUnita>
              )}
            </Field>
            <Field label="Peso" errore={errors.weight_kg?.message}>
              {(props) => (
                <ConUnita unita="kg" descrittoDa={props["aria-describedby"]}>
                  {(descrittoDa) => (
                    <Input
                      {...props}
                      {...register("weight_kg")}
                      aria-describedby={descrittoDa}
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      min={20}
                      max={400}
                      className="pr-10"
                      aria-invalid={Boolean(errors.weight_kg)}
                    />
                  )}
                </ConUnita>
              )}
            </Field>
          </div>
        </div>

        <Sezione titolo="Contatti">
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
        </Sezione>

        <Sezione titolo="Percorso">
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
            {(props) => (
              <Textarea {...props} {...register("notes")} rows={3} />
            )}
          </Field>
        </Sezione>

        {!modifica && (
          <GiorniAllenamento
            register={register}
            control={control}
            setValue={setValue}
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

/** Gruppo di campi con un titolo discreto e un filetto che lo separa dal precedente. */
function Sezione({
  titolo,
  descrizione,
  children,
}: {
  titolo: string;
  descrizione?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-4 border-t border-line pt-5">
      <legend className="float-left w-full">
        <span className="display-tight block text-sm text-ink">{titolo}</span>
        {descrizione && (
          <span className="mt-1 block text-xs text-muted">{descrizione}</span>
        )}
      </legend>
      {children}
    </fieldset>
  );
}

/**
 * Unità di misura dentro il campo, a destra del valore. È collegata anche via
 * `aria-describedby`, così lo screen reader legge "Altezza, cm".
 */
function ConUnita({
  unita,
  descrittoDa,
  children,
}: {
  unita: string;
  descrittoDa: string | undefined;
  children: (descrittoDa: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className="relative">
      {children([id, descrittoDa].filter(Boolean).join(" "))}
      <span
        id={id}
        className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted"
      >
        {unita}
      </span>
    </div>
  );
}

/**
 * Giorni e orari in cui il cliente si allena: ogni giorno scelto diventa una
 * lezione di un'ora in calendario, da oggi alla data di fine.
 *
 * La settimana sta su una riga, come la lavagna degli orari in palestra: si
 * accendono i giorni, e sotto compare l'orario solo per quelli accesi.
 */
function GiorniAllenamento({
  register,
  control,
  setValue,
  errori,
}: {
  register: UseFormRegister<Campi>;
  control: Control<Campi, unknown, CampiPuliti>;
  setValue: UseFormSetValue<Campi>;
  errori: FieldErrors<Campi>["programma"];
}) {
  const valori = useWatch({ control, name: "programma" });
  const lezioni = generaLezioni(
    allenamentiScelti(valori.giorni),
    valori.fine,
    "",
  );
  const scelti = GIORNI_SETTIMANA.map((g, i) => ({ ...g, i })).filter(
    ({ i }) => valori.giorni[i]?.attivo,
  );

  return (
    <Sezione
      titolo="Giorni di allenamento"
      descrizione="Facoltativo. Ogni giorno scelto diventa una lezione di un'ora in calendario, da oggi alla data di fine."
    >
      <div className="grid grid-cols-7 gap-1.5">
        {GIORNI_SETTIMANA.map(({ giorno, nome }, i) => {
          const campo = register(`programma.giorni.${i}.attivo`);
          return (
            <label key={giorno} className="relative block">
              <input
                type="checkbox"
                className="peer sr-only"
                aria-label={nome}
                {...campo}
                onChange={(e) => {
                  void campo.onChange(e);
                  // Chi si allena alle 18:30 il lunedì di solito torna alla
                  // stessa ora: il nuovo giorno parte dall'ultimo orario scritto.
                  if (e.target.checked && !valori.giorni[i]?.ora) {
                    const ultimo = [...valori.giorni]
                      .reverse()
                      .find((g) => g.attivo && g.ora)?.ora;
                    if (ultimo) setValue(`programma.giorni.${i}.ora`, ultimo);
                  }
                }}
              />
              <span
                aria-hidden="true"
                className={
                  "display-tight flex h-11 cursor-pointer select-none items-center justify-center rounded-[10px] border border-line bg-surface text-xs text-muted sm:text-sm " +
                  "transition-colors duration-100 hover:border-line-strong hover:text-ink " +
                  "peer-checked:border-accent peer-checked:bg-teal-soft peer-checked:text-accent-hover " +
                  "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus"
                }
              >
                {nome.slice(0, 3)}
              </span>
            </label>
          );
        })}
      </div>

      {scelti.length > 0 && (
        <>
          <ul className="flex flex-col divide-y divide-line rounded-[10px] border border-line">
            {scelti.map(({ giorno, nome, i }) => {
              const errore = errori?.giorni?.[i]?.ora?.message;
              const idErrore = `orario-${giorno}-errore`;
              return (
                <li
                  key={giorno}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5 pl-3 pr-1.5"
                >
                  <span className="flex-1 text-sm text-ink">{nome}</span>
                  <Input
                    type="time"
                    aria-label={`Orario ${nome.toLowerCase()}`}
                    aria-invalid={Boolean(errore)}
                    aria-describedby={errore ? idErrore : undefined}
                    className="!w-32"
                    {...register(`programma.giorni.${i}.ora`)}
                  />
                  {errore && (
                    <span
                      id={idErrore}
                      className="w-full pb-1 text-right text-xs text-scaduta"
                    >
                      {errore}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>

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
        </>
      )}
    </Sezione>
  );
}
