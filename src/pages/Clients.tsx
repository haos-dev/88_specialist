import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SearchInput } from "@/components/ui/SearchInput";
import { Stato, Vuoto } from "@/components/ui/Stato";
import { Table, TD, TH, TR } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { ClientForm } from "@/features/clients/ClientForm";
import { useClienti, useCreaCliente } from "@/features/clients/useClients";
import { messaggioErrore, type FiltroClienti } from "@/data";
import { cn } from "@/lib/cn";

const FILTRI: Array<{ valore: FiltroClienti["stato"]; etichetta: string }> = [
  { valore: "attivi", etichetta: "Attivi" },
  { valore: "archiviati", etichetta: "Archiviati" },
  { valore: "tutti", etichetta: "Tutti" },
];

export default function Clients() {
  const [stato, setStato] = useState<FiltroClienti["stato"]>("attivi");
  const [ricerca, setRicerca] = useState("");
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
      <PageHeader
        titolo="Clienti"
        azioni={
          <Button variante="primario" onClick={() => setFormAperto(true)}>
            Nuovo cliente
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-3">
        <SearchInput
          etichetta="Cerca fra i clienti"
          placeholder="Cerca per nome, cognome o email"
          valore={ricerca}
          onChange={setRicerca}
          ritardoMs={0}
          className="w-full sm:max-w-80"
        />

        <div
          className="flex items-center gap-1"
          role="group"
          aria-label="Filtra per stato"
        >
          {FILTRI.map((filtro) => (
            <button
              key={filtro.valore}
              type="button"
              onClick={() => setStato(filtro.valore)}
              aria-pressed={stato === filtro.valore}
              className={cn(
                "border-b-2 px-1 pb-1 text-sm transition-colors",
                stato === filtro.valore
                  ? "border-accent font-medium text-ink"
                  : "border-transparent text-muted hover:text-ink",
              )}
            >
              {filtro.etichetta}
            </button>
          ))}
        </div>
      </div>

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
          <Table>
            <thead>
              <tr>
                <TH>Cliente</TH>
                <TH className="hidden sm:table-cell">Contatti</TH>
                <TH className="text-right">Schede attive</TH>
                <TH className="w-0" />
              </tr>
            </thead>
            <tbody>
              {righe.map((cliente) => (
                <TR key={cliente.id}>
                  <TD>
                    <Link
                      to={`/clienti/${cliente.id}`}
                      className="font-medium underline-offset-4 hover:text-accent hover:underline"
                    >
                      {cliente.last_name} {cliente.first_name}
                    </Link>
                    {!cliente.active && (
                      <Badge className="ml-2 align-middle">Archiviato</Badge>
                    )}
                  </TD>
                  <TD className="hidden text-sm text-muted sm:table-cell">
                    {cliente.email ?? cliente.phone ?? "—"}
                  </TD>
                  <TD className="nums text-right">{cliente.schede_attive}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
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
