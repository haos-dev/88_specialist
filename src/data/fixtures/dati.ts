import { spostaData, toDataISO } from "@/lib/dates";
import type {
  Cliente,
  Esercizio,
  GiornoEsercizio,
  Giorno,
  Impostazioni,
  Scheda,
} from "@/types/domain";

/**
 * Dati di esempio per la modalità `VITE_USE_FIXTURES=true`.
 *
 * Servono a rendere l'app cliccabile prima che Supabase esista: ogni schermata
 * deve poter mostrare tutti i suoi stati (elenco pieno, elenco vuoto, scheda
 * scaduta, scheda in scadenza, cliente archiviato) senza backend. L'intera
 * cartella `fixtures/` è cancellabile in un commit quando il wiring è fatto.
 */

const OGGI = toDataISO(new Date());
const OWNER = "trainer-demo";

/** Placeholder inline: nessuna richiesta di rete, funziona anche offline. */
function media(sigla: string, tinta: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120" viewBox="0 0 160 120"><rect width="160" height="120" fill="${tinta}"/><text x="80" y="70" font-family="Archivo, sans-serif" font-size="42" font-weight="600" fill="#ffffff" text-anchor="middle">${sigla}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const TINTE: Record<string, string> = {
  Petto: "#0e5c52",
  Dorso: "#2e9c8a",
  Spalle: "#3f6f63",
  Bicipiti: "#1c7a6c",
  Tricipiti: "#14524a",
  Quadricipiti: "#276c5f",
  Femorali: "#1f5f55",
  Glutei: "#317f70",
  Addome: "#456f66",
  Polpacci: "#2a6459",
  Cardio: "#5a7a72",
  Mobilità: "#6b8b83",
};

interface SemeEsercizio {
  nome: string;
  gruppo: string;
  descrizione: string;
}

const SEMI: SemeEsercizio[] = [
  {
    nome: "Panca piana con bilanciere",
    gruppo: "Petto",
    descrizione:
      "Scapole addotte e depresse, discesa controllata fino a sfiorare il petto, piedi ben piantati a terra.",
  },
  {
    nome: "Panca inclinata con manubri",
    gruppo: "Petto",
    descrizione:
      "Inclinazione a 30°, gomiti a 45° rispetto al busto, fermata breve in basso.",
  },
  {
    nome: "Croci ai cavi",
    gruppo: "Petto",
    descrizione:
      "Gomiti leggermente flessi e fissi per tutta l’esecuzione, chiusura sulla linea mediana.",
  },
  {
    nome: "Piegamenti sulle braccia",
    gruppo: "Petto",
    descrizione:
      "Corpo in linea dalla testa ai talloni, addome contratto, discesa fino a sfiorare il pavimento.",
  },
  {
    nome: "Trazioni alla sbarra",
    gruppo: "Dorso",
    descrizione:
      "Presa prona poco più larga delle spalle, salita fino a portare il mento oltre la sbarra.",
  },
  {
    nome: "Rematore con bilanciere",
    gruppo: "Dorso",
    descrizione:
      "Busto a circa 45°, schiena neutra, bilanciere tirato verso l’ombelico.",
  },
  {
    nome: "Lat machine presa larga",
    gruppo: "Dorso",
    descrizione:
      "Petto in fuori, tirata verso lo sterno senza reclinare troppo il busto.",
  },
  {
    nome: "Pulley basso",
    gruppo: "Dorso",
    descrizione:
      "Schiena ferma, movimento dalle braccia, ritorno controllato in allungamento.",
  },
  {
    nome: "Lento avanti con bilanciere",
    gruppo: "Spalle",
    descrizione:
      "In piedi, glutei e addome contratti, spinta verticale senza inarcare la zona lombare.",
  },
  {
    nome: "Alzate laterali",
    gruppo: "Spalle",
    descrizione:
      "Manubri leggeri, salita fino all’altezza delle spalle, niente slancio del busto.",
  },
  {
    nome: "Alzate posteriori",
    gruppo: "Spalle",
    descrizione:
      "Busto flesso in avanti, apertura controllata, focus sul deltoide posteriore.",
  },
  {
    nome: "Tirate al mento",
    gruppo: "Spalle",
    descrizione:
      "Presa poco più stretta delle spalle, gomiti alti, fermarsi prima di eventuali fastidi.",
  },
  {
    nome: "Curl con bilanciere",
    gruppo: "Bicipiti",
    descrizione:
      "Gomiti fermi vicino al busto, nessuna spinta di schiena, discesa lenta.",
  },
  {
    nome: "Curl a martello",
    gruppo: "Bicipiti",
    descrizione:
      "Presa neutra, lavoro su brachiale e brachioradiale, alternato o simultaneo.",
  },
  {
    nome: "Curl su panca inclinata",
    gruppo: "Bicipiti",
    descrizione:
      "Braccia dietro la linea del corpo per massimizzare l’allungamento iniziale.",
  },
  {
    nome: "French press",
    gruppo: "Tricipiti",
    descrizione:
      "Gomiti fermi e puntati al soffitto, discesa verso la fronte, estensione completa.",
  },
  {
    nome: "Push down ai cavi",
    gruppo: "Tricipiti",
    descrizione:
      "Gomiti aderenti al busto, estensione completa senza portare le spalle in avanti.",
  },
  {
    nome: "Dip alle parallele",
    gruppo: "Tricipiti",
    descrizione:
      "Busto il più verticale possibile per spostare il carico sui tricipiti.",
  },
  {
    nome: "Squat con bilanciere",
    gruppo: "Quadricipiti",
    descrizione:
      "Discesa fino a coscia parallela o poco sotto, ginocchia in linea con le punte dei piedi.",
  },
  {
    nome: "Leg press",
    gruppo: "Quadricipiti",
    descrizione:
      "Piedi a media altezza sulla pedana, non bloccare le ginocchia in chiusura.",
  },
  {
    nome: "Affondi con manubri",
    gruppo: "Quadricipiti",
    descrizione:
      "Passo lungo, busto eretto, ginocchio posteriore che sfiora il pavimento.",
  },
  {
    nome: "Stacco rumeno",
    gruppo: "Femorali",
    descrizione:
      "Ginocchia semiflesse e fisse, anca che va indietro, schiena neutra per tutto il movimento.",
  },
  {
    nome: "Leg curl sdraiato",
    gruppo: "Femorali",
    descrizione:
      "Bacino aderente al cuscino, flessione completa, ritorno controllato.",
  },
  {
    nome: "Hip thrust",
    gruppo: "Glutei",
    descrizione:
      "Scapole appoggiate alla panca, spinta dai talloni, fermata di un secondo in chiusura.",
  },
  {
    nome: "Plank",
    gruppo: "Addome",
    descrizione:
      "Bacino in linea, addome e glutei contratti, respirazione regolare. Tenuta a tempo.",
  },
  {
    nome: "Crunch a terra",
    gruppo: "Addome",
    descrizione:
      "Solo le scapole si staccano da terra, niente trazione sul collo.",
  },
  {
    nome: "Calf raise in piedi",
    gruppo: "Polpacci",
    descrizione:
      "Massima escursione, pausa in alto, discesa lenta in allungamento.",
  },
  {
    nome: "Corsa sul tapis roulant",
    gruppo: "Cardio",
    descrizione:
      "Riscaldamento o defaticamento. Durata e pendenza secondo la scheda.",
  },
  {
    nome: "Vogatore",
    gruppo: "Cardio",
    descrizione:
      "Sequenza gambe-busto-braccia in trazione, braccia-busto-gambe in ritorno.",
  },
  {
    nome: "Mobilità dell’anca",
    gruppo: "Mobilità",
    descrizione:
      "Circonduzioni e affondi dinamici, da inserire prima delle sedute di gambe.",
  },
];

export const ESERCIZI_SEED: Esercizio[] = SEMI.map((seme, i) => ({
  id: `ex-${String(i + 1).padStart(3, "0")}`,
  name: seme.nome,
  muscle_group: seme.gruppo,
  description: seme.descrizione,
  media_url: media(
    seme.gruppo.slice(0, 2).toUpperCase(),
    TINTE[seme.gruppo] ?? "#0e5c52",
  ),
  media_type: "image/svg+xml",
  media_attribution:
    "Immagine di esempio — sarà sostituita dal dataset in fase di seed",
  archived: false,
  created_at: `${OGGI}T09:00:00Z`,
  updated_at: `${OGGI}T09:00:00Z`,
}));

function cliente(
  id: string,
  first: string,
  last: string,
  extra: Partial<Cliente> = {},
): Cliente {
  return {
    id,
    owner_id: OWNER,
    first_name: first,
    last_name: last,
    email: `${first.toLowerCase()}.${last.toLowerCase()}@example.it`,
    phone: null,
    birth_date: null,
    height_cm: null,
    weight_kg: null,
    goal: null,
    notes: null,
    active: true,
    created_at: `${OGGI}T09:00:00Z`,
    updated_at: `${OGGI}T09:00:00Z`,
    ...extra,
  };
}

export const CLIENTI_SEED: Cliente[] = [
  cliente("cl-001", "Mario", "Rossi", {
    phone: "333 1234567",
    birth_date: "1988-04-12",
    height_cm: 178,
    weight_kg: 82.5,
    goal: "Ipertrofia, focus su petto e spalle",
    notes:
      "Vecchio infortunio alla spalla destra: niente lento dietro, alzate laterali sotto i 90°.",
  }),
  cliente("cl-002", "Giulia", "Bianchi", {
    phone: "347 9988776",
    birth_date: "1995-11-03",
    height_cm: 165,
    weight_kg: 61,
    goal: "Ricomposizione corporea",
    notes:
      "Obiettivo ricomposizione. Si allena tre volte a settimana, lunedì/mercoledì/venerdì.",
  }),
  cliente("cl-003", "Luca", "Ferrari", { birth_date: "1979-01-27" }),
  cliente("cl-004", "Sara", "Conti", {
    phone: "340 5566778",
    goal: "Mezza maratona in aprile",
    notes:
      "Preparazione mezza maratona ad aprile. Pesi due volte a settimana, il resto è corsa.",
  }),
  cliente("cl-005", "Davide", "Greco", { email: null }),
  cliente("cl-006", "Elena", "Moretti", {
    active: false,
    notes: "Ha sospeso gli allenamenti a giugno. Archiviata.",
  }),
];

function scheda(
  id: string,
  clientId: string | null,
  title: string,
  inizio: string | null,
  fine: string | null,
  extra: Partial<Scheda> = {},
): Scheda {
  return {
    id,
    owner_id: OWNER,
    client_id: clientId,
    title,
    start_date: inizio,
    end_date: fine,
    notes: null,
    status: "active",
    is_template: false,
    created_at: `${OGGI}T09:00:00Z`,
    updated_at: `${OGGI}T09:00:00Z`,
    ...extra,
  };
}

// Le date sono relative a oggi, così il badge scadenze mostra sempre qualcosa
// di realistico qualunque sia il giorno in cui si apre l'app.
export const SCHEDE_SEED: Scheda[] = [
  scheda(
    "pl-001",
    "cl-001",
    "Ipertrofia — blocco 1",
    spostaData(OGGI, -74),
    spostaData(OGGI, -5),
    {
      notes:
        "Progressione a carico costante, +2 reps a settimana prima di salire di peso.",
    },
  ),
  scheda(
    "pl-002",
    "cl-002",
    "Ricomposizione — inverno",
    spostaData(OGGI, -95),
    spostaData(OGGI, -3),
  ),
  scheda(
    "pl-003",
    "cl-004",
    "Forza di base",
    spostaData(OGGI, -10),
    spostaData(OGGI, 80),
  ),
  scheda(
    "pl-004",
    "cl-001",
    "Adattamento anatomico",
    spostaData(OGGI, -160),
    spostaData(OGGI, -80),
    {
      status: "archived",
    },
  ),
  scheda(
    "pl-005",
    "cl-006",
    "Full body 2×",
    spostaData(OGGI, -220),
    spostaData(OGGI, -120),
    {
      status: "archived",
    },
  ),
  // Template (§3.7bis): client_id null, is_template true. Niente date: un
  // template non è legato a un periodo, lo decide chi lo applica a un cliente.
  scheda("pl-tpl-001", null, "Full body — 3 giorni", null, null, {
    is_template: true,
    notes: "Struttura base per chi inizia: un giorno di riposo tra le sedute.",
  }),
];

interface SemeGiorno {
  planId: string;
  nome: string;
  esercizi: Array<
    [nomeEsercizio: string, sets: string, reps: string, rest: number | null]
  >;
}

const SEMI_GIORNI: SemeGiorno[] = [
  {
    planId: "pl-001",
    nome: "Petto e tricipiti",
    esercizi: [
      ["Panca piana con bilanciere", "4", "8", 90],
      ["Panca inclinata con manubri", "3", "10", 75],
      ["Croci ai cavi", "3", "12", 60],
      ["French press", "3", "10", 60],
      ["Push down ai cavi", "3", "12", 45],
    ],
  },
  {
    planId: "pl-001",
    nome: "Dorso e bicipiti",
    esercizi: [
      ["Trazioni alla sbarra", "4", "max", 120],
      ["Rematore con bilanciere", "4", "8", 90],
      ["Pulley basso", "3", "12", 60],
      ["Curl con bilanciere", "3", "10", 60],
      ["Curl a martello", "3", "12", 45],
    ],
  },
  {
    planId: "pl-001",
    nome: "Gambe e spalle",
    esercizi: [
      ["Squat con bilanciere", "4", "8", 120],
      ["Stacco rumeno", "3", "10", 90],
      ["Leg press", "3", "12", 75],
      ["Lento avanti con bilanciere", "3", "10", 75],
      ["Alzate laterali", "3", "15", 45],
    ],
  },
  {
    planId: "pl-002",
    nome: "Full body A",
    esercizi: [
      ["Squat con bilanciere", "3", "10", 90],
      ["Panca piana con bilanciere", "3", "10", 90],
      ["Rematore con bilanciere", "3", "10", 90],
      ["Plank", "3", '45"', 45],
    ],
  },
  {
    planId: "pl-002",
    nome: "Full body B",
    esercizi: [
      ["Stacco rumeno", "3", "10", 90],
      ["Lat machine presa larga", "3", "12", 60],
      ["Lento avanti con bilanciere", "3", "10", 75],
      ["Hip thrust", "3", "12", 60],
    ],
  },
  {
    planId: "pl-003",
    nome: "Forza — spinta",
    esercizi: [
      ["Panca piana con bilanciere", "5", "5", 180],
      ["Lento avanti con bilanciere", "4", "6", 120],
      ["Dip alle parallele", "3", "8", 90],
    ],
  },
  {
    planId: "pl-003",
    nome: "Forza — trazione",
    esercizi: [
      ["Stacco rumeno", "5", "5", 180],
      ["Trazioni alla sbarra", "4", "6", 120],
      ["Rematore con bilanciere", "3", "8", 90],
    ],
  },
  {
    planId: "pl-004",
    nome: "Circuito introduttivo",
    esercizi: [
      ["Leg press", "3", "15", 60],
      ["Lat machine presa larga", "3", "15", 60],
      ["Crunch a terra", "3", "20", 45],
    ],
  },
  {
    planId: "pl-tpl-001",
    nome: "Giorno A — spinta",
    esercizi: [
      ["Panca piana con bilanciere", "3", "10", 90],
      ["Leg press", "3", "12", 90],
      ["Push down ai cavi", "3", "12", 60],
    ],
  },
  {
    planId: "pl-tpl-001",
    nome: "Giorno B — trazione",
    esercizi: [
      ["Lat machine presa larga", "3", "12", 90],
      ["Stacco rumeno", "3", "10", 90],
      ["Curl con bilanciere", "3", "12", 60],
    ],
  },
];

const perNome = new Map(ESERCIZI_SEED.map((e) => [e.name, e.id]));

export const GIORNI_SEED: Giorno[] = [];
export const RIGHE_SEED: GiornoEsercizio[] = [];

SEMI_GIORNI.forEach((seme, indice) => {
  const dayId = `dy-${String(indice + 1).padStart(3, "0")}`;
  const ordinePiano = GIORNI_SEED.filter(
    (g) => g.plan_id === seme.planId,
  ).length;

  GIORNI_SEED.push({
    id: dayId,
    plan_id: seme.planId,
    day_order: ordinePiano,
    day_name: seme.nome,
  });

  seme.esercizi.forEach(([nome, sets, reps, rest], i) => {
    const exerciseId = perNome.get(nome);
    if (!exerciseId) return;
    RIGHE_SEED.push({
      id: `${dayId}-r${i + 1}`,
      day_id: dayId,
      exercise_id: exerciseId,
      order_index: i,
      sets,
      reps,
      rest_seconds: rest,
      tempo: null,
      notes: null,
    });
  });
});

export const IMPOSTAZIONI_SEED: Impostazioni = {
  owner_id: OWNER,
  reminder_days_before: 7,
  calendar_feed_token: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6",
};

export const SESSIONE_SEED = { userId: OWNER, email: "trainer@example.it" };
