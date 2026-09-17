import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type TonoToast = "ok" | "errore";

interface Avviso {
  id: number;
  testo: string;
  tono: TonoToast;
}

interface ContestoToast {
  /** Conferma un'azione riuscita, con lo stesso verbo del pulsante che l'ha avviata. */
  conferma: (testo: string) => void;
  errore: (testo: string) => void;
}

const Contesto = createContext<ContestoToast | null>(null);

let prossimoId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [avvisi, setAvvisi] = useState<Avviso[]>([]);

  const aggiungi = useCallback((testo: string, tono: TonoToast) => {
    prossimoId += 1;
    const id = prossimoId;
    setAvvisi((precedenti) => [...precedenti, { id, testo, tono }]);
    // Gli errori restano più a lungo: vanno letti, non intravisti.
    setTimeout(
      () => {
        setAvvisi((precedenti) => precedenti.filter((a) => a.id !== id));
      },
      tono === "errore" ? 7000 : 3500,
    );
  }, []);

  const valore = useMemo<ContestoToast>(
    () => ({
      conferma: (testo) => aggiungi(testo, "ok"),
      errore: (testo) => aggiungi(testo, "errore"),
    }),
    [aggiungi],
  );

  return (
    <Contesto.Provider value={valore}>
      {children}
      <div
        className="no-print pointer-events-none fixed bottom-4 left-1/2 z-50 flex w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-2"
        aria-live="polite"
        aria-atomic="false"
      >
        {avvisi.map((avviso) => (
          <div
            key={avviso.id}
            className={
              "pointer-events-auto rounded-[10px] border-l-2 px-3.5 py-2.5 text-sm shadow-dialog " +
              (avviso.tono === "errore"
                ? "border-scaduta bg-scaduta-soft text-scaduta"
                : "border-accent bg-surface text-ink")
            }
          >
            {avviso.testo}
          </div>
        ))}
      </div>
    </Contesto.Provider>
  );
}

export function useToast(): ContestoToast {
  const contesto = useContext(Contesto);
  if (!contesto) throw new Error("useToast va usato dentro <ToastProvider>");
  return contesto;
}
