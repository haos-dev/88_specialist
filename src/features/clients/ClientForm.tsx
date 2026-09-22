import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Dialog } from "@/components/ui/Dialog";
import type { Cliente, ClienteInput } from "@/types/domain";

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
});

type Campi = z.input<typeof schema>;
type CampiPuliti = z.output<typeof schema>;

interface ClientFormProps {
  aperto: boolean;
  cliente?: Cliente | null;
  inCorso?: boolean;
  onSalva: (input: ClienteInput) => void;
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
    },
  });

  const invia = handleSubmit((campi) => onSalva(campi as ClienteInput));

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
