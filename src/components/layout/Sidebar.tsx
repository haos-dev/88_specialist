import { NavLink } from "react-router-dom";
import {
  Dumbbell,
  LayoutDashboard,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useSchedeInScadenza } from "@/features/plans/usePlans";

const VOCI = [
  { a: "/", etichetta: "Dashboard", esatta: true, Icona: LayoutDashboard },
  { a: "/clienti", etichetta: "Clienti", esatta: false, Icona: Users },
  { a: "/templates", etichetta: "Templates", esatta: false, Icona: Dumbbell },
  {
    a: "/impostazioni",
    etichetta: "Impostazioni",
    esatta: false,
    Icona: Settings,
  },
];

function Voce({
  a,
  esatta,
  etichetta,
  conteggio,
  Icona,
}: {
  a: string;
  esatta: boolean;
  etichetta: string;
  conteggio?: number;
  Icona: LucideIcon;
}) {
  return (
    <NavLink
      to={a}
      end={esatta}
      aria-label={etichetta}
      title={etichetta}
      className={({ isActive }) =>
        cn(
          "relative flex h-12 w-12 items-center justify-center rounded-[16px] border text-sm transition-[background-color,border-color,color,transform] duration-150 active:scale-95",
          isActive
            ? "border-accent/35 bg-accent/10 font-medium text-accent"
            : "border-transparent text-muted hover:border-line hover:bg-white/[0.05] hover:text-ink",
        )
      }
    >
      <Icona aria-hidden="true" size={30} strokeWidth={1.8} />
      {conteggio ? (
        <span className="nums absolute -right-1 -top-1 min-w-5 rounded-full border border-scadenza/50 bg-scadenza-soft px-1 text-center text-[11px] font-medium leading-4 text-scadenza">
          {conteggio}
        </span>
      ) : null}
    </NavLink>
  );
}

export function Sidebar() {
  const { data: inScadenza } = useSchedeInScadenza();
  const conteggio = inScadenza?.length ?? 0;

  return (
    <nav
      data-app-nav
      aria-label="Navigazione principale"
      className={
        "no-print fixed bottom-4 left-1/2 z-30 flex -translate-x-1/2 flex-row items-center justify-center gap-4 border border-line bg-background backdrop-blur-sm rounded-[25px] px-3 py-3 " +
        "max-w-[calc(100vw-1.5rem)] "
      }
    >
      <ul className="flex min-w-0 items-center justify-center gap-3">
        {VOCI.map((voce) => (
          <li key={voce.a}>
            <Voce
              a={voce.a}
              esatta={voce.esatta}
              etichetta={voce.etichetta}
              conteggio={voce.a === "/" ? conteggio : undefined}
              Icona={voce.Icona}
            />
          </li>
        ))}
      </ul>
    </nav>
  );
}
