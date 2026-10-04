import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input } from "@/components/ui/Field";
import { formatData, oggi, toDataISO } from "@/lib/dates";
import type { Cliente, PreferenzeAllenamentoInput } from "@/types/domain";
import {
  FINE_MASSIMA_MESI,
  GIORNI_SETTIMANA,
  fineMassima,
  fineProposta,
  generaLezioni,
  titoloLezione,
  type Allenamento,
} from "./trainingSchedule";

export function TrainingPreferencesDialog({
  cliente,
  aperto,
  inCorso,
  onChiudi,
  onSalva,
}: {
  cliente: Cliente;
  aperto: boolean;
  inCorso: boolean;
  onChiudi: () => void;
  onSalva: (preferenze: PreferenzeAllenamentoInput) => void;
}) {
  const [giorni, setGiorni] = useState<Allenamento[]>(() => cliente.training_days as Allenamento[] ?? []);
  const [fine, setFine] = useState(cliente.training_until ?? fineProposta());
  const oggiISO = toDataISO(oggi());
  const lezioni = generaLezioni(
    giorni,
    fine,
    titoloLezione(cliente.first_name, cliente.last_name),
  );
  const dateValida = !giorni.length || (fine >= oggiISO && fine <= fineMassima());

  const chiudi = () => {
    setGiorni(cliente.training_days as Allenamento[] ?? []);
    setFine(cliente.training_until ?? fineProposta());
    onChiudi();
  };
  const cambiaGiorno = (giorno: Allenamento["giorno"], attivo: boolean) => {
    setGiorni((correnti) => attivo
      ? [...correnti, { giorno, ora: correnti.at(-1)?.ora ?? "09:00" }].sort((a, b) => a.giorno - b.giorno)
      : correnti.filter((riga) => riga.giorno !== giorno));
  };

  return (
    <Dialog
      aperto={aperto}
      titolo="Preferenze di allenamento"
      descrizione="Salvando, tutti gli appuntamenti futuri di questo cliente verranno sostituiti dal nuovo programma."
      onChiudi={chiudi}
      azioni={<>
        <Button onClick={chiudi} disabled={inCorso}>Annulla</Button>
        <Button variante="primario" disabled={inCorso || !dateValida || (giorni.length > 0 && lezioni.length === 0)} onClick={() => onSalva({ lezioni, giorni: giorni.length ? giorni : null, fine: giorni.length ? fine : null })}>
          {inCorso ? "Salvataggio…" : "Sostituisci appuntamenti"}
        </Button>
      </>}
    >
      <div className="grid gap-4">
        <p className="text-sm leading-relaxed text-muted">Seleziona giorni e orari per generare lezioni di un’ora da oggi alla data indicata. Lascia tutti i giorni deselezionati per rimuovere gli appuntamenti futuri senza crearne di nuovi.</p>
        <div className="grid grid-cols-7 gap-1.5">
          {GIORNI_SETTIMANA.map(({ giorno, nome }) => {
            const selezionato = giorni.some((riga) => riga.giorno === giorno);
            return <label key={giorno} className="relative block">
              <input type="checkbox" className="peer sr-only" aria-label={nome} checked={selezionato} onChange={(e) => cambiaGiorno(giorno, e.target.checked)} />
              <span className="display-tight flex h-11 cursor-pointer items-center justify-center rounded-[10px] border border-line bg-surface text-xs text-muted transition-colors hover:border-line-strong peer-checked:border-accent peer-checked:bg-teal-soft peer-checked:text-accent-hover peer-focus-visible:outline-2 peer-focus-visible:outline-focus">{nome.slice(0, 3)}</span>
            </label>;
          })}
        </div>
        {giorni.length > 0 && <>
          <ul className="divide-y divide-line rounded-[10px] border border-line">
            {giorni.map((riga) => {
              const nome = GIORNI_SETTIMANA.find((g) => g.giorno === riga.giorno)!.nome;
              return <li key={riga.giorno} className="flex items-center gap-3 px-3 py-2">
                <span className="flex-1 text-sm">{nome}</span>
                <Input aria-label={`Orario ${nome.toLowerCase()}`} type="time" className="!w-32" value={riga.ora} onChange={(e) => setGiorni((correnti) => correnti.map((x) => x.giorno === riga.giorno ? { ...x, ora: e.target.value } : x))} />
              </li>;
            })}
          </ul>
          <Field label="Fino al" errore={!dateValida ? `Scegli una data tra oggi e ${FINE_MASSIMA_MESI} mesi.` : undefined} aiuto={lezioni.length ? `${lezioni.length} lezioni, dal ${formatData(lezioni[0].appointment_date)} al ${formatData(lezioni[lezioni.length - 1].appointment_date)}.` : undefined}>
            {(props) => <Input {...props} type="date" min={oggiISO} max={fineMassima()} value={fine} onChange={(e) => setFine(e.target.value)} />}
          </Field>
        </>}
      </div>
    </Dialog>
  );
}
