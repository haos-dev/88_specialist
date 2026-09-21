import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Stato, Vuoto } from "@/components/ui/Stato";
import { useToast } from "@/components/ui/Toast";
import { ExerciseLibraryDialog } from "@/features/exercises/ExerciseLibraryDialog";
import { TemplateForm } from "@/features/plans/TemplateForm";
import { useCreaTemplate, useTemplates } from "@/features/plans/usePlans";
import { messaggioErrore } from "@/data";
import { Database, FilePlusCorner } from "lucide-react";

/**
 * §3.7bis: un template è una scheda senza cliente (client_id null,
 * is_template true) — struttura una volta, applica a chiunque. Vive accanto
 * alla libreria esercizi perché, come gli esercizi, è materiale riutilizzabile
 * che non appartiene a un cliente specifico. Applica ed elimina stanno nel
 * builder, aprendo il template.
 */
export default function Templates() {
  const navigate = useNavigate();

  const [bibliotecaAperta, setBibliotecaAperta] = useState(false);
  const [templateFormAperto, setTemplateFormAperto] = useState(false);

  const toast = useToast();

  const templates = useTemplates();
  const creaTemplate = useCreaTemplate();

  return (
    <>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-5 border-b border-line pb-5">
        <div>
          <h1 className="display text-4xl leading-none text-ink sm:text-5xl">
            Templates
          </h1>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            aria-label="Libreria esercizi"
            title="Libreria esercizi"
            onClick={() => setBibliotecaAperta(true)}
            className="flex min-h-10 items-center gap-2 rounded-[10px] border border-line bg-surface px-3 text-sm text-muted transition-[background-color,border-color,color,transform] duration-100 hover:border-accent/45 hover:text-accent active:scale-[0.98]"
          >
            <Database aria-hidden="true" size={19} strokeWidth={2.2} />
          </Button>
          <Button
            variante="primario"
            aria-label="Nuovo template"
            title="Nuovo template"
            className="h-10 gap-2 px-3"
            onClick={() => setTemplateFormAperto(true)}
          >
            <FilePlusCorner aria-hidden="true" size={19} strokeWidth={2.2} />
          </Button>
        </div>
      </header>

      <Stato
        caricamento={templates.isLoading}
        errore={templates.error}
        dati={templates.data}
        onRiprova={() => void templates.refetch()}
        eVuoto={(d) => d.length === 0}
        vuoto={
          <Vuoto
            titolo="Non hai ancora nessun template"
            descrizione="Crea il tuo primo template da associare a un cliente."
            azione={
              <Button
                variante="primario"
                aria-label="Nuovo template"
                title="Nuovo template"
                onClick={() => setTemplateFormAperto(true)}
              >
                <FilePlusCorner aria-hidden="true" size={19} strokeWidth={2.2} />
              </Button>
            }
          />
        }
      >
        {(righe) => (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {righe.map((template) => (
              <li key={template.id}>
                <Link
                  to={`/schede/${template.id}`}
                  className="flex min-h-20 items-center rounded-[18px] border border-line bg-surface px-5 py-4 text-lg font-medium text-ink transition-[background-color,border-color,color,transform] duration-150 hover:-translate-y-0.5 hover:border-accent/50 hover:bg-[#202527] hover:text-accent active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
                >
                  {template.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Stato>

      {bibliotecaAperta && (
        <ExerciseLibraryDialog
          aperto={bibliotecaAperta}
          onChiudi={() => setBibliotecaAperta(false)}
        />
      )}

      <TemplateForm
        aperto={templateFormAperto}
        inCorso={creaTemplate.isPending}
        onChiudi={() => setTemplateFormAperto(false)}
        onSalva={(input) =>
          creaTemplate.mutate(input, {
            onSuccess: (nuovo) => {
              setTemplateFormAperto(false);
              toast.conferma(
                "Template creato: ora aggiungici giorni ed esercizi.",
              );
              navigate(`/schede/${nuovo.id}`);
            },
            onError: (errore) => toast.errore(messaggioErrore(errore)),
          })
        }
      />
    </>
  );
}
