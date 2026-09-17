import { cn } from "@/lib/cn";

export type VarianteBottone =
  | "primario"
  | "secondario"
  | "fantasma"
  | "pericolo";
export type DimensioneBottone = "md" | "sm";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-[10px] font-medium " +
  "transition-[background-color,border-color,color,transform] duration-100 " +
  "active:scale-[0.98] motion-reduce:active:scale-100 " +
  "disabled:cursor-not-allowed disabled:opacity-45 whitespace-nowrap";

const VARIANTI: Record<VarianteBottone, string> = {
  primario: "bg-accent text-[#0b0d0e] hover:bg-accent-hover",
  secondario:
    "border border-line bg-surface text-ink hover:border-line-strong hover:bg-[#202527]",
  fantasma: "text-muted hover:bg-teal-soft hover:text-accent-hover",
  pericolo:
    "border border-scaduta/35 bg-scaduta-soft text-scaduta hover:bg-scaduta hover:text-white",
};

const DIMENSIONI: Record<DimensioneBottone, string> = {
  md: "min-h-10 px-3.5 text-sm",
  sm: "min-h-8 px-2.5 text-xs",
};

/** Condiviso fra `<Button>` e i `<Link>` che devono sembrare bottoni. */
export function classiBottone(
  variante: VarianteBottone = "secondario",
  dimensione: DimensioneBottone = "md",
  className?: string,
): string {
  return cn(BASE, VARIANTI[variante], DIMENSIONI[dimensione], className);
}
