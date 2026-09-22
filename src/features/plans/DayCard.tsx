import { useState } from "react";
import { Plus, Trash } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import type { GiornoEspanso, GiornoEsercizioInput } from "@/types/domain";
import { DragHandle } from "./DragHandle";
import { ExerciseRow } from "./ExerciseRow";

interface DayCardProps {
  giorno: GiornoEspanso;
  indice: number;
  onRinomina: (nome: string) => void;
  onElimina: () => void;
  onAggiungiEsercizio: () => void;
  onAggiornaRiga: (rowId: string, input: GiornoEsercizioInput) => void;
  onRimuoviRiga: (rowId: string) => void;
}

/**
 * Un giorno di allenamento. Non è una card: è una sezione di documento aperta
 * da un filetto pesante, come sul foglio stampato.
 */
export function DayCard({
  giorno,
  indice,
  onRinomina,
  onElimina,
  onAggiungiEsercizio,
  onAggiornaRiga,
  onRimuoviRiga,
}: DayCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: giorno.id,
    data: { tipo: "giorno" },
  });

  const [nome, setNome] = useState(giorno.day_name);

  return (
    <section
      ref={setNodeRef}
      data-print-day
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "border-t-2 border-ink pt-2.5",
        isDragging &&
          "relative z-10 bg-surface opacity-90 shadow-dialog [will-change:transform]",
      )}
    >
      <header className="mb-2 flex items-center gap-2">
        <DragHandle
          attributes={attributes}
          listeners={listeners}
          etichetta={`Sposta il giorno ${giorno.day_name}`}
          className="no-print -ml-1"
        />

        <span className="nums shrink-0 text-sm text-muted">
          Giorno {indice + 1}
        </span>

        <label className="sr-only" htmlFor={`nome-${giorno.id}`}>
          Nome del giorno {indice + 1}
        </label>
        <input
          id={`nome-${giorno.id}`}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          onBlur={() => {
            const pulito = nome.trim();
            if (pulito && pulito !== giorno.day_name) onRinomina(pulito);
            else setNome(giorno.day_name);
          }}
          placeholder="Es. Petto e tricipiti"
          className={
            "display-tight min-w-0 flex-1 rounded-[10px] border border-transparent bg-transparent px-1 " +
            "text-lg text-ink hover:border-line focus:border-accent focus:bg-surface focus:outline-none " +
            "focus-visible:outline-2 focus-visible:outline-teal focus-visible:outline-offset-1"
          }
        />
      </header>

      {giorno.esercizi.length === 0 ? (
        <p className="border-b border-line pb-3 pl-1 text-sm text-muted">
          Nessun esercizio in questo giorno.
        </p>
      ) : (
        <SortableContext
          items={giorno.esercizi.map((e) => e.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul>
            {giorno.esercizi.map((riga) => (
              <ExerciseRow
                key={riga.id}
                riga={riga}
                onAggiorna={(input) => onAggiornaRiga(riga.id, input)}
                onRimuovi={() => onRimuoviRiga(riga.id)}
              />
            ))}
          </ul>
        </SortableContext>
      )}

      <div className="no-print mt-2 flex flex-wrap items-center justify-between gap-2 pt-2">
        <Button
          variante="fantasma"
          aria-label="Aggiungi esercizio"
          title="Aggiungi esercizio"
          className="min-h-10 px-2.5"
          onClick={onAggiungiEsercizio}
        >
          <Plus aria-hidden="true" size={16} />
          Aggiungi esercizio
        </Button>

        <Button
          variante="fantasma"
          aria-label="Elimina giorno"
          title="Elimina giorno"
          className="min-h-10 px-2.5 text-scaduta hover:bg-scaduta-soft hover:text-scaduta"
          onClick={onElimina}
        >
          <Trash aria-hidden="true" size={15} />
          Elimina giorno
        </Button>
      </div>
    </section>
  );
}
