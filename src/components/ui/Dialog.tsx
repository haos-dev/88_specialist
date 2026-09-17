import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "./Button";

interface DialogProps {
  aperto: boolean;
  titolo: string;
  descrizione?: string;
  onChiudi: () => void;
  children?: ReactNode;
  /** Pulsanti in fondo. Se assente il dialog ha solo "Chiudi". */
  azioni?: ReactNode;
  larghezza?: "sm" | "md" | "lg";
}

const LARGHEZZE = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-3xl" } as const;

/**
 * Costruito sul `<dialog>` nativo: trappola del focus, `Esc` per chiudere e
 * inerzia dello sfondo arrivano dal browser invece che da 200 righe di codice
 * nostro che le implementano peggio.
 */
export function Dialog({
  aperto,
  titolo,
  descrizione,
  onChiudi,
  children,
  azioni,
  larghezza = "md",
}: DialogProps) {
  const riferimento = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = riferimento.current;
    if (!dialog) return;
    if (aperto && !dialog.open) dialog.showModal();
    if (!aperto && dialog.open) dialog.close();
  }, [aperto]);

  return (
    <dialog
      ref={riferimento}
      onCancel={(e) => {
        e.preventDefault();
        onChiudi();
      }}
      onClose={onChiudi}
      aria-labelledby="dialog-titolo"
      className={[
        "dialog-surface material-chrome w-[calc(100vw-2rem)] rounded-[18px] border p-0 text-ink",
        "backdrop:bg-black/70",
        "m-auto overflow-hidden",
        LARGHEZZE[larghezza],
      ].join(" ")}
    >
      {aperto && (
        <div className="flex max-h-[85vh] flex-col">
          <header className="border-b border-line px-5 pb-3.5 pt-4">
            <h2 id="dialog-titolo" className="display-tight text-lg">
              {titolo}
            </h2>
            {descrizione && (
              <p className="mt-1 max-w-[56ch] text-sm text-muted">
                {descrizione}
              </p>
            )}
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {children}
          </div>

          <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">
            {azioni ?? <Button onClick={onChiudi}>Chiudi</Button>}
          </footer>
        </div>
      )}
    </dialog>
  );
}

interface ConfirmDialogProps {
  aperto: boolean;
  titolo: string;
  descrizione: string;
  /** Testo del pulsante: dice cosa succede, non "Conferma". */
  etichettaConferma: string;
  distruttivo?: boolean;
  inCorso?: boolean;
  onConferma: () => void;
  onAnnulla: () => void;
}

export function ConfirmDialog({
  aperto,
  titolo,
  descrizione,
  etichettaConferma,
  distruttivo = false,
  inCorso = false,
  onConferma,
  onAnnulla,
}: ConfirmDialogProps) {
  return (
    <Dialog
      aperto={aperto}
      titolo={titolo}
      descrizione={descrizione}
      onChiudi={onAnnulla}
      larghezza="sm"
      azioni={
        <>
          <Button onClick={onAnnulla} disabled={inCorso}>
            Annulla
          </Button>
          <Button
            variante={distruttivo ? "pericolo" : "primario"}
            onClick={onConferma}
            disabled={inCorso}
          >
            {inCorso ? "Attendi…" : etichettaConferma}
          </Button>
        </>
      }
    />
  );
}
