import { useMemo, useState } from "react";
import { Archive, Search, UserPlus, Users, X } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { SearchInput } from "@/components/ui/SearchInput";
import { Stato, Vuoto } from "@/components/ui/Stato";
import { useToast } from "@/components/ui/Toast";
import { ClientForm } from "@/features/clients/ClientForm";
import { useClienti, useCreaCliente } from "@/features/clients/useClients";
import { messaggioErrore, type FiltroClienti } from "@/data";

export default function Clients() {
  const [stato, setStato] = useState<FiltroClienti["stato"]>("attivi");
  const [ricerca, setRicerca] = useState("");
  const [ricercaAperta, setRicercaAperta] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [formAperto, setFormAperto] = useState(
    searchParams.get("nuovo") === "1",
  );

  const clienti = useClienti({ stato });
  const crea = useCreaCliente();
  const toast = useToast();

  const chiudiForm = () => {
    setFormAperto(false);
    if (searchParams.has("nuovo")) {
      const prossimi = new URLSearchParams(searchParams);
      prossimi.delete("nuovo");
      setSearchParams(prossimi, { replace: true });
    }
  };

  // Poche centinaia di clienti: il filtro sta bene qui, senza andare in rete a
  // ogni battuta. Per gli esercizi (~1300 righe) la scelta è opposta.
  const visibili = useMemo(() => {
    const q = ricerca.trim().toLocaleLowerCase("it");
    if (!q) return clienti.data ?? [];
    return (clienti.data ?? []).filter((c) =>
      `${c.first_name} ${c.last_name} ${c.email ?? ""}`
        .toLocaleLowerCase("it")
        .includes(q),
    );
  }, [clienti.data, ricerca]);

  return (
    <>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-5 border-b border-line pb-5">
        <div>
          <h1 className="display text-4xl leading-none text-ink sm:text-5xl">
            Clienti
          </h1>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {ricercaAperta ? (
            <div className="flex items-center gap-2 motion-safe:animate-[dialog-in_180ms_ease-out]">
              <SearchInput
                etichetta="Cerca fra i clienti"
                placeholder="Cerca per nome, cognome o email"
                valore={ricerca}
                onChange={setRicerca}
                ritardoMs={0}
                className="w-[min(18rem,calc(100vw-8rem))]"
              />
              <button
                type="button"
                aria-label="Chiudi ricerca"
                title="Chiudi ricerca"
                onClick={() => setRicercaAperta(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[25px] border border-line text-muted hover:border-line-strong hover:text-ink"
              >
                <X aria-hidden="true" size={17} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              aria-label="Cerca clienti"
              title="Cerca clienti"
              onClick={() => setRicercaAperta(true)}
              className="flex h-10 w-10 items-center justify-center rounded-[25px] border border-line bg-surface text-muted transition-[background-color,border-color,color,transform] duration-100 hover:border-accent/45 hover:text-accent active:scale-[0.98]"
            >
              <Search aria-hidden="true" size={17} />
            </button>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label={
                stato === "attivi"
                  ? "Mostra clienti archiviati"
                  : "Mostra clienti attivi"
              }
              aria-pressed={stato === "archiviati"}
              onClick={() =>
                setStato(stato === "attivi" ? "archiviati" : "attivi")
              }
              className="flex min-h-10 items-center gap-2 rounded-[10px] border border-line bg-surface px-3 text-sm text-muted transition-[background-color,border-color,color,transform] duration-100 hover:border-accent/45 hover:text-accent active:scale-[0.98]"
            >
              {stato === "attivi" ? (
                <Archive aria-hidden="true" size={17} />
              ) : (
                <Users aria-hidden="true" size={17} />
              )}
            </button>
          </div>

          <Button
            variante="primario"
            aria-label="Nuovo cliente"
            title="Nuovo cliente"
            className="h-10 gap-2 px-3"
            onClick={() => setFormAperto(true)}
          >
            <UserPlus aria-hidden="true" size={17} strokeWidth={2.2} />
          </Button>
        </div>
      </header>

      <Stato
        caricamento={clienti.isLoading}
        errore={clienti.error}
        dati={visibili}
        onRiprova={() => void clienti.refetch()}
        eVuoto={(d) => d.length === 0}
        vuoto={
          ricerca ? (
            <Vuoto
              titolo={`Nessun cliente per "${ricerca}"`}
              descrizione="Prova con un'altra parola, oppure cambia il filtro di stato."
            />
          ) : stato === "archiviati" ? (
            <Vuoto
              titolo="Nessun cliente archiviato"
              descrizione="Quando archivi un cliente lo ritrovi qui, insieme alle sue schede."
            />
          ) : (
            <Vuoto
              titolo="Non hai ancora nessun cliente"
              descrizione="Crea la prima anagrafica: da lì potrai costruirgli una scheda di allenamento."
              azione={
                <Button variante="primario" onClick={() => setFormAperto(true)}>
                  Nuovo cliente
                </Button>
              }
            />
          )
        }
      >
        {(righe) => (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {righe.map((cliente) => (
              <li key={cliente.id}>
                <Link
                  to={`/clienti/${cliente.id}`}
                  className="flex min-h-20 items-center rounded-[18px] border border-line bg-surface px-5 py-4 text-lg font-medium text-ink transition-[background-color,border-color,color,transform] duration-150 hover:-translate-y-0.5 hover:border-accent/50 hover:bg-[#202527] hover:text-accent active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
                >
                  {cliente.last_name} {cliente.first_name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Stato>

      <ClientForm
        aperto={formAperto}
        inCorso={crea.isPending}
        onChiudi={chiudiForm}
        onSalva={(input) =>
          crea.mutate(input, {
            onSuccess: (cliente) => {
              setFormAperto(false);
              toast.conferma(
                `${cliente.first_name} ${cliente.last_name} è stato creato.`,
              );
            },
            onError: (errore) => toast.errore(messaggioErrore(errore)),
          })
        }
      />
    </>
  );
}
