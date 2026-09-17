import { useEffect, useState } from "react";

/**
 * Audit B8 — PRD §5 richiede connessione per leggere e scrivere, e dice che
 * l'assenza di rete va comunicata "in modo chiaro, non un errore generico".
 * Questa è la parte proattiva: si vede prima che il trainer perda del lavoro,
 * non dopo che un salvataggio è fallito.
 */
export function OfflineBanner() {
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    const vaOnline = () => setOnline(true);
    const vaOffline = () => setOnline(false);
    window.addEventListener("online", vaOnline);
    window.addEventListener("offline", vaOffline);
    return () => {
      window.removeEventListener("online", vaOnline);
      window.removeEventListener("offline", vaOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div
      data-offline-banner
      role="status"
      className="material-chrome border-b border-scadenza/50 px-4 py-2 text-sm text-scadenza"
    >
      <strong className="font-medium">Sei offline.</strong> Puoi consultare
      quello che è già aperto, ma le modifiche non vengono salvate finché non
      torna la connessione.
    </div>
  );
}
