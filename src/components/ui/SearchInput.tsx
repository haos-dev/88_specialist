import { useEffect, useId, useState } from "react";
import { cn } from "@/lib/cn";

interface SearchInputProps {
  valore: string;
  onChange: (valore: string) => void;
  placeholder?: string;
  etichetta: string;
  /** Ritardo prima di propagare il valore. 0 per la ricerca puramente locale. */
  ritardoMs?: number;
  className?: string;
}

/**
 * Campo di ricerca con debounce interno: sull'elenco esercizi ogni battuta è
 * una query al server (audit B3), quindi non se ne manda una per tasto.
 */
export function SearchInput({
  valore,
  onChange,
  placeholder = "Cerca…",
  etichetta,
  ritardoMs = 250,
  className,
}: SearchInputProps) {
  const id = useId();
  const [locale, setLocale] = useState(valore);

  // Riallinea quando il valore cambia da fuori (es. "azzera filtri").
  useEffect(() => setLocale(valore), [valore]);

  useEffect(() => {
    if (locale === valore) return;
    if (ritardoMs === 0) {
      onChange(locale);
      return;
    }
    const timer = setTimeout(() => onChange(locale), ritardoMs);
    return () => clearTimeout(timer);
    // `valore` è volutamente escluso: reagiamo solo a quello che digita l'utente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale, ritardoMs]);

  return (
    <div className={cn("relative", className)}>
      <label className="sr-only" htmlFor={id}>
        {etichetta}
      </label>
      <input
        id={id}
        type="search"
        value={locale}
        onChange={(e) => setLocale(e.target.value)}
        placeholder={placeholder}
        className={
          "min-h-10 w-full rounded-[10px] border border-line bg-surface pl-8 pr-2.5 text-base text-ink " +
          "placeholder:text-muted/70 hover:border-line-strong focus:border-accent focus:outline-none " +
          "focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-1"
        }
      />
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      >
        <circle cx="7" cy="7" r="4.5" />
        <path d="M10.5 10.5 14 14" strokeLinecap="round" />
      </svg>
    </div>
  );
}
