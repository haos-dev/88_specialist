import { formatIntervallo } from "@/lib/dates";

interface PlanHeadingProps {
  clienteNome: string;
  inizio: string | null;
  fine: string | null;
}

/**
 * L'unico punto in cui il sistema visivo alza la voce: nome del cliente grande
 * e allargato, titolo sotto, periodo e stato su una riga a cifre tabulari
 * sotto un filetto pesante.
 *
 * È lo stesso componente usato dal builder e dal foglio di stampa: schermo e
 * PDF devono sembrare due viste dello stesso documento, non due prodotti.
 */
export function PlanHeading({ clienteNome, inizio, fine }: PlanHeadingProps) {
  return (
    <div>
      <p className="display text-3xl leading-none text-ink sm:text-4xl">
        {clienteNome}
      </p>
      <p className="display-tight mt-1.5 text-xl text-muted">
        {formatIntervallo(inizio, fine)}
      </p>
    </div>
  );
}
