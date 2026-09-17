import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { StatoScadenza } from "@/types/domain";
import { formatGiorniResidui } from "@/lib/dates";

type Tono = "neutro" | "accento" | "scaduta" | "scadenza";

const TONI: Record<Tono, string> = {
  neutro: "border-line text-muted",
  accento: "border-accent/45 bg-teal-soft text-accent-hover",
  scaduta: "border-scaduta/35 bg-scaduta-soft text-scaduta",
  scadenza: "border-scadenza/35 bg-scadenza-soft text-scadenza",
};

/** Etichetta di stato: compatta e leggermente arrotondata per la scansione. */
export function Badge({
  tono = "neutro",
  children,
  className,
}: {
  tono?: Tono;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        TONI[tono],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** PRD §3.6 — la stessa etichetta ovunque compaia una scadenza. */
export function BadgeScadenza({
  stato,
  giorniResidui,
}: {
  stato: StatoScadenza;
  giorniResidui: number | null;
}) {
  if (stato === "nessuna") return null;
  return (
    <Badge tono={stato === "scaduta" ? "scaduta" : "scadenza"}>
      {giorniResidui === null
        ? "In scadenza"
        : formatGiorniResidui(giorniResidui)}
    </Badge>
  );
}
