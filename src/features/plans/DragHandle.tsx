import type { DraggableAttributes } from "@dnd-kit/core";
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";
import { cn } from "@/lib/cn";

interface DragHandleProps {
  attributes: DraggableAttributes;
  listeners: SyntheticListenerMap | undefined;
  etichetta: string;
  className?: string;
}

/**
 * Il trascinamento parte solo da qui, non da tutta la riga: dentro le righe
 * ci sono campi di testo, e un drag agganciato all'intera riga renderebbe
 * impossibile selezionare "4×8" con il mouse.
 *
 * Restando un `<button>` vero, dnd-kit ci attacca sopra anche il riordino da
 * tastiera (spazio per prendere, frecce per spostare, spazio per posare).
 */
export function DragHandle({
  attributes,
  listeners,
  etichetta,
  className,
}: DragHandleProps) {
  return (
    <button
      type="button"
      aria-label={etichetta}
      className={cn(
        "flex h-10 w-10 shrink-0 cursor-grab touch-none items-center justify-center rounded-[10px]",
        "text-line-strong transition-[background-color,color,transform] duration-100 ",
        "hover:bg-teal-soft hover:text-accent active:scale-95 active:cursor-grabbing",
        className,
      )}
      {...attributes}
      {...listeners}
    >
      <svg
        viewBox="0 0 10 16"
        className="h-4 w-2.5"
        fill="currentColor"
        aria-hidden="true"
      >
        <circle cx="2" cy="3" r="1.3" />
        <circle cx="8" cy="3" r="1.3" />
        <circle cx="2" cy="8" r="1.3" />
        <circle cx="8" cy="8" r="1.3" />
        <circle cx="2" cy="13" r="1.3" />
        <circle cx="8" cy="13" r="1.3" />
      </svg>
    </button>
  );
}
