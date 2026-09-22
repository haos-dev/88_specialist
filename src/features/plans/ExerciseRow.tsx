import { useEffect, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { Minus } from "lucide-react";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/cn";
import type {
  GiornoEsercizioEspanso,
  GiornoEsercizioInput,
} from "@/types/domain";
import { DragHandle } from "./DragHandle";

interface ExerciseRowProps {
  riga: GiornoEsercizioEspanso;
  onAggiorna: (input: GiornoEsercizioInput) => void;
  onRimuovi: () => void;
}

const CAMPO =
  "h-7 w-full rounded-[10px] border border-transparent bg-transparent px-1 text-sm tabular-nums " +
  "hover:border-line focus:border-accent focus:bg-surface focus:outline-none " +
  "focus-visible:outline-2 focus-visible:outline-teal focus-visible:outline-offset-1";

export function ExerciseRow({ riga, onAggiorna, onRimuovi }: ExerciseRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: riga.id,
    data: { tipo: "esercizio", dayId: riga.day_id },
  });

  // I campi sono controllati localmente e salvati al blur: salvare a ogni
  // battuta manderebbe una scrittura per tasto premuto.
  const [bozza, setBozza] = useState({
    sets: riga.sets ?? "",
    reps: riga.reps ?? "",
    rest: riga.rest_seconds === null ? "" : String(riga.rest_seconds),
    notes: riga.notes ?? "",
  });

  useEffect(() => {
    setBozza({
      sets: riga.sets ?? "",
      reps: riga.reps ?? "",
      rest: riga.rest_seconds === null ? "" : String(riga.rest_seconds),
      notes: riga.notes ?? "",
    });
  }, [riga.sets, riga.reps, riga.rest_seconds, riga.notes]);

  const salva = () => {
    const recupero =
      bozza.rest.trim() === "" ? null : Number.parseInt(bozza.rest, 10);
    const input: GiornoEsercizioInput = {
      sets: bozza.sets.trim() || null,
      reps: bozza.reps.trim() || null,
      rest_seconds: Number.isFinite(recupero) ? recupero : null,
      tempo: riga.tempo,
      notes: bozza.notes.trim() || null,
    };
    const invariato =
      input.sets === riga.sets &&
      input.reps === riga.reps &&
      input.rest_seconds === riga.rest_seconds &&
      input.notes === riga.notes;
    if (!invariato) onAggiorna(input);
  };

  return (
    <li
      ref={setNodeRef}
      data-print-row
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex flex-wrap items-center gap-2 border-b border-line py-1.5",
        isDragging &&
          "relative z-10 bg-surface opacity-90 shadow-dialog [will-change:transform]",
      )}
    >
      <DragHandle
        attributes={attributes}
        listeners={listeners}
        etichetta={`Sposta ${riga.esercizio.name}`}
        className="no-print"
      />

      {riga.esercizio.media_url ? (
        <img
          src={riga.esercizio.media_url}
          alt=""
          loading="lazy"
          className="h-9 w-12 shrink-0 border border-line object-cover"
        />
      ) : (
        <div
          className="h-9 w-12 shrink-0 border border-dashed border-line"
          aria-hidden="true"
        />
      )}

      <div className="min-w-0 flex-1 basis-40">
        <p className="truncate text-sm font-medium" title={riga.esercizio.name}>
          {riga.esercizio.name}
        </p>
        <p className="truncate text-xs text-muted">
          {riga.esercizio.muscle_group ?? "—"}
        </p>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1">
        <label className="sr-only" htmlFor={`sets-${riga.id}`}>
          Serie per {riga.esercizio.name}
        </label>
        <input
          id={`sets-${riga.id}`}
          value={bozza.sets}
          onChange={(e) => setBozza((b) => ({ ...b, sets: e.target.value }))}
          onBlur={salva}
          placeholder="serie"
          className={cn(CAMPO, "w-9 text-right")}
        />
        <span aria-hidden="true" className="text-xs text-muted">
          ×
        </span>
        <label className="sr-only" htmlFor={`reps-${riga.id}`}>
          Ripetizioni per {riga.esercizio.name}
        </label>
        <input
          id={`reps-${riga.id}`}
          value={bozza.reps}
          onChange={(e) => setBozza((b) => ({ ...b, reps: e.target.value }))}
          onBlur={salva}
          placeholder="rip"
          className={cn(CAMPO, "w-12")}
        />
        <label className="sr-only" htmlFor={`rest-${riga.id}`}>
          Recupero in secondi per {riga.esercizio.name}
        </label>
        <input
          id={`rest-${riga.id}`}
          value={bozza.rest}
          onChange={(e) =>
            setBozza((b) => ({
              ...b,
              rest: e.target.value.replace(/[^\d]/g, ""),
            }))
          }
          onBlur={salva}
          inputMode="numeric"
          placeholder="rec"
          className={cn(CAMPO, "w-10 text-right")}
        />
        <span aria-hidden="true" className="w-3 text-xs text-muted">
          {bozza.rest ? "″" : ""}
        </span>
      </div>

      <button
        type="button"
        aria-label={`Togli ${riga.esercizio.name} dal giorno`}
        title="Togli dal giorno"
        className="no-print shrink-0 rounded-[10px] p-1 text-scaduta transition-colors hover:text-scaduta focus-visible:text-scaduta"
        onClick={onRimuovi}
      >
        <Minus aria-hidden="true" size={16} />
      </button>
    </li>
  );
}
