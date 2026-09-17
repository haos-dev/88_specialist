import { useId } from "react";
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";

const CONTROLLO =
  "min-h-10 w-full rounded-[10px] border border-line bg-surface px-2.5 text-ink " +
  "placeholder:text-muted/70 transition-colors " +
  "hover:border-line-strong focus:border-accent focus:outline-none " +
  "focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-1 " +
  "disabled:bg-paper disabled:text-muted aria-[invalid=true]:border-scaduta";

interface FieldProps {
  label: string;
  /** Testo di aiuto sotto al campo. Sparisce quando c'è un errore. */
  aiuto?: string;
  errore?: string;
  obbligatorio?: boolean;
  children: (props: {
    id: string;
    "aria-describedby": string | undefined;
  }) => ReactNode;
}

/**
 * Etichetta, aiuto ed errore per un singolo controllo, con gli `id` già
 * collegati. L'etichetta resta in sentence case: niente maiuscoletto spaziato.
 */
export function Field({
  label,
  aiuto,
  errore,
  obbligatorio,
  children,
}: FieldProps) {
  const id = useId();
  const idDescrizione = errore
    ? `${id}-err`
    : aiuto
      ? `${id}-aiuto`
      : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
        {obbligatorio && (
          <span className="ml-1 text-muted" aria-hidden="true">
            *
          </span>
        )}
      </label>

      {children({ id, "aria-describedby": idDescrizione })}

      {errore ? (
        <p id={`${id}-err`} className="text-xs text-scaduta">
          {errore}
        </p>
      ) : aiuto ? (
        <p id={`${id}-aiuto`} className="text-xs text-muted">
          {aiuto}
        </p>
      ) : null}
    </div>
  );
}

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input className={cn(CONTROLLO, "h-9 text-base", className)} {...props} />
  );
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        CONTROLLO,
        "min-h-24 py-2 text-base leading-relaxed",
        className,
      )}
      {...props}
    />
  );
}

export function Select({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(CONTROLLO, "h-9 pr-8 text-base", className)}
      {...props}
    />
  );
}
