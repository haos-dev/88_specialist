import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Caricamento, Errore, Vuoto } from "@/components/ui/Stato";
import { PlanHeading } from "@/features/plans/PlanHeading";
import { useScheda } from "@/features/plans/usePlans";
import { stampaScheda } from "@/features/pdf/printSheet";
import { formatDataEstesa } from "@/lib/dates";

/**
 * PRD §3.4 — l'anteprima che si apre in una scheda nuova. Il trainer la
 * rivede e, se gli va bene, la stampa o la salva come PDF con la funzione
 * nativa del browser.
 *
 * Non è avvolta da `AppLayout`: qui non c'è navigazione da nascondere in
 * stampa, c'è solo il foglio.
 */
export default function PrintPlan() {
  const { id = "" } = useParams<{ id: string }>();
  const scheda = useScheda(id);
  const [inPreparazione, setInPreparazione] = useState(false);

  const pronto = Boolean(scheda.data);

  // Il titolo della pagina è anche il nome file proposto: lo scriviamo appena
  // i dati ci sono, non solo al momento della stampa, così vale anche se il
  // trainer usa Ctrl+P al posto del pulsante.
  useEffect(() => {
    if (!scheda.data || scheda.data.is_template) return;
    const precedente = document.title;
    const cliente = scheda.data.cliente
      ? `${scheda.data.cliente.first_name} ${scheda.data.cliente.last_name}`.trim()
      : "";
    void import("@/lib/filename").then(({ nomeFileScheda }) => {
      document.title = nomeFileScheda(cliente, scheda.data!.title);
    });
    return () => {
      document.title = precedente;
    };
  }, [scheda.data]);

  if (scheda.isLoading)
    return (
      <div className="p-8">
        <Caricamento />
      </div>
    );
  if (scheda.error) {
    return (
      <div className="p-8">
        <Errore errore={scheda.error} onRiprova={() => void scheda.refetch()} />
      </div>
    );
  }
  if (!scheda.data) {
    return (
      <div className="p-8">
        <Vuoto
          titolo="Questa scheda non esiste"
          descrizione="Potrebbe essere stata eliminata."
        />
      </div>
    );
  }
  if (scheda.data.is_template) {
    // §3.7bis: un template non ha un cliente, non ha senso stamparlo così
    // com'è. Va prima applicato a un cliente (crea una scheda vera), e si
    // stampa quella.
    return (
      <div className="p-8">
        <Vuoto
          titolo="Non si stampa un template"
          descrizione='Applica prima il template a un cliente ("Applica a un cliente" nel builder): la scheda che ne nasce si stampa normalmente.'
        />
      </div>
    );
  }

  const s = scheda.data;
  const clienteNome = s.cliente
    ? `${s.cliente.first_name} ${s.cliente.last_name}`.trim()
    : "";
  const totaleEsercizi = s.giorni.reduce(
    (somma, g) => somma + g.esercizi.length,
    0,
  );

  const stampa = async () => {
    setInPreparazione(true);
    try {
      await stampaScheda({ nomeCliente: clienteNome, titoloScheda: s.title });
    } finally {
      setInPreparazione(false);
    }
  };

  return (
    <div className="min-h-dvh bg-paper">
      {/* Barra di conferma: l'unica cosa che non finisce sul foglio. */}
      <div className="material-chrome no-print sticky top-0 z-10 border-b">
        <div className="mx-auto flex max-w-[210mm] flex-wrap items-center justify-between gap-3 px-6 py-3">
          <p className="text-sm text-muted">
            Anteprima di stampa. Controlla il foglio, poi salvalo come PDF dalla
            finestra di stampa.
          </p>
          <Button
            variante="primario"
            onClick={() => void stampa()}
            disabled={!pronto || inPreparazione}
          >
            {inPreparazione ? "Preparazione…" : "Stampa o salva come PDF"}
          </Button>
        </div>
      </div>

      <article className="print-surface print-sheet mx-auto max-w-[210mm] bg-surface px-8 py-10 text-ink sm:px-12">
        <PlanHeading
          clienteNome={clienteNome}
          inizio={s.start_date}
          fine={s.end_date}
        />

        {s.notes && (
          <p className="prose-column mt-5 whitespace-pre-line border-l-2 border-line pl-4 text-sm text-muted">
            {s.notes}
          </p>
        )}

        {s.giorni.length === 0 ? (
          <p className="mt-10 border-t border-line pt-6 text-sm text-muted">
            Questa scheda non ha ancora giorni di allenamento.
          </p>
        ) : (
          <div className="mt-9 flex flex-col gap-8">
            {s.giorni.map((giorno, indice) => (
              <section
                key={giorno.id}
                data-print-day
                className="border-t-2 border-ink pt-2.5"
              >
                <h2 className="mb-2 flex items-baseline gap-3">
                  <span className="nums text-sm text-muted">
                    Giorno {indice + 1}
                  </span>
                  <span className="display-tight text-lg text-ink">
                    {giorno.day_name}
                  </span>
                </h2>

                {giorno.esercizi.length === 0 ? (
                  <p className="border-b border-line pb-3 text-sm text-muted">
                    Nessun esercizio.
                  </p>
                ) : (
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr>
                        <th className="w-14 border-b border-line-strong pb-1 text-xs font-medium text-muted" />
                        <th className="border-b border-line-strong pb-1 pr-4 text-xs font-medium text-muted">
                          Esercizio
                        </th>
                        <th className="w-16 border-b border-line-strong pb-1 pr-3 text-right text-xs font-medium text-muted">
                          Serie
                        </th>
                        <th className="w-16 border-b border-line-strong pb-1 pr-3 text-right text-xs font-medium text-muted">
                          Rip.
                        </th>
                        <th className="w-20 border-b border-line-strong pb-1 text-right text-xs font-medium text-muted">
                          Recupero
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {giorno.esercizi.map((riga) => (
                        <tr key={riga.id} data-print-row>
                          <td className="border-b border-line py-1.5 pr-2 align-top">
                            {riga.esercizio.media_url ? (
                              <img
                                src={riga.esercizio.media_url}
                                alt=""
                                className="h-10 w-12 border border-line object-cover"
                              />
                            ) : null}
                          </td>
                          <td className="border-b border-line py-1.5 pr-4 align-top">
                            <p className="text-sm font-medium text-ink">
                              {riga.esercizio.name}
                            </p>
                            {riga.notes && (
                              <p className="mt-0.5 text-xs text-muted">
                                {riga.notes}
                              </p>
                            )}
                          </td>
                          <td className="nums border-b border-line py-1.5 pr-3 text-right align-top text-sm">
                            {riga.sets ?? "—"}
                          </td>
                          <td className="nums border-b border-line py-1.5 pr-3 text-right align-top text-sm">
                            {riga.reps ?? "—"}
                          </td>
                          <td className="nums border-b border-line py-1.5 text-right align-top text-sm">
                            {riga.rest_seconds === null
                              ? "—"
                              : `${riga.rest_seconds}″`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            ))}
          </div>
        )}

        <footer className="nums mt-10 flex flex-wrap justify-between gap-x-6 gap-y-1 border-t border-line pt-3 text-xs text-muted">
          <span>
            {s.giorni.length} {s.giorni.length === 1 ? "giorno" : "giorni"} ·{" "}
            {totaleEsercizi} {totaleEsercizi === 1 ? "esercizio" : "esercizi"}
          </span>
          <span>
            Stampato il{" "}
            {formatDataEstesa(new Date().toISOString().slice(0, 10))}
          </span>
        </footer>
      </article>
    </div>
  );
}
