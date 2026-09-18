import {
  calcolaDateRinnovo,
  duplicaStruttura,
} from "@/features/plans/renewPlan";
import type {
  Cliente,
  Appuntamento,
  Esercizio,
  Giorno,
  GiornoEsercizio,
  GiornoEspanso,
  Impostazioni,
  Scheda,
  SchedaCompleta,
  SchedaSintesi,
} from "@/types/domain";
import { oggi, spostaData, toDataISO } from "@/lib/dates";
import { ErroreDati } from "../errors";
import type {
  AuthApi,
  AppuntamentiApi,
  ClientiApi,
  DashboardApi,
  DashboardSommario,
  DataLayer,
  EserciziApi,
  ImpostazioniApi,
  SchedeApi,
  Sessione,
} from "../types";
import {
  CLIENTI_SEED,
  ESERCIZI_SEED,
  GIORNI_SEED,
  IMPOSTAZIONI_SEED,
  RIGHE_SEED,
  SCHEDE_SEED,
  SESSIONE_SEED,
} from "./dati";

/**
 * Implementazione in memoria dell'intero data layer.
 *
 * Rispetta le stesse firme e gli stessi vincoli della versione Supabase —
 * incluso "si elimina solo ciò che è archiviato" e il riordino batch — così
 * quello che si vede in modalità fixtures è davvero quello che si otterrà
 * una volta collegato il backend. Nessuna riga di questa cartella finisce in
 * produzione: `VITE_USE_FIXTURES=false` la esclude dal grafo dei moduli.
 */

const OGGI = toDataISO(oggi());
const OWNER = SESSIONE_SEED.userId;
const clienti: Cliente[] = CLIENTI_SEED.map((c) => ({ ...c }));
const esercizi: Esercizio[] = ESERCIZI_SEED.map((e) => ({ ...e }));
const schede: Scheda[] = SCHEDE_SEED.map((s) => ({ ...s }));
const giorni: Giorno[] = GIORNI_SEED.map((g) => ({ ...g }));
const righe: GiornoEsercizio[] = RIGHE_SEED.map((r) => ({ ...r }));
let impostazioni: Impostazioni = { ...IMPOSTAZIONI_SEED };
const appuntamenti: Appuntamento[] = [
  {
    id: "app-001",
    owner_id: OWNER,
    client_id: "cl-001",
    title: "Sessione individuale",
    appointment_date: OGGI,
    start_time: "09:00:00",
    duration_minutes: 60,
    notes: null,
    created_at: `${OGGI}T08:00:00Z`,
    updated_at: `${OGGI}T08:00:00Z`,
  },
  {
    id: "app-002",
    owner_id: OWNER,
    client_id: "cl-002",
    title: "Controllo tecnica",
    appointment_date: spostaData(OGGI, 2),
    start_time: "17:30:00",
    duration_minutes: 45,
    notes: null,
    created_at: `${OGGI}T08:00:00Z`,
    updated_at: `${OGGI}T08:00:00Z`,
  },
];

let contatore = 1000;
function uid(prefisso: string): string {
  contatore += 1;
  return `${prefisso}-${contatore}`;
}

const appuntamentiFixtures: AppuntamentiApi = {
  async elenco(mese) {
    return attesa(
      appuntamenti.filter((appuntamento) =>
        appuntamento.appointment_date.startsWith(mese),
      ),
    );
  },
  async crea(input) {
    const nuovo = {
      id: uid("app"),
      owner_id: SESSIONE_SEED.userId,
      ...input,
      created_at: ora(),
      updated_at: ora(),
    };
    appuntamenti.push(nuovo);
    return attesa({ ...nuovo });
  },
  async elimina(id) {
    const indice = appuntamenti.findIndex(
      (appuntamento) => appuntamento.id === id,
    );
    if (indice >= 0) appuntamenti.splice(indice, 1);
    await attesa(null);
  },
};

/** Piccola latenza artificiale: gli stati di caricamento vanno visti almeno una volta. */
function attesa<T>(valore: T, ms = 120): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(valore), ms));
}

const ora = () => new Date().toISOString();

/* ------------------------------------------------------------------- auth */

const CHIAVE_SESSIONE = "ptm.fixtures.sessione";
let osservatori: Array<(s: Sessione | null) => void> = [];

function leggiSessione(): Sessione | null {
  try {
    const grezzo = localStorage.getItem(CHIAVE_SESSIONE);
    return grezzo ? (JSON.parse(grezzo) as Sessione) : null;
  } catch {
    return null;
  }
}

function scriviSessione(sessione: Sessione | null) {
  try {
    if (sessione)
      localStorage.setItem(CHIAVE_SESSIONE, JSON.stringify(sessione));
    else localStorage.removeItem(CHIAVE_SESSIONE);
  } catch {
    // Modalità privata o storage bloccato: la sessione vive solo in memoria.
  }
  osservatori.forEach((cb) => cb(sessione));
}

const authFixtures: AuthApi = {
  async sessioneCorrente() {
    return attesa(leggiSessione(), 60);
  },
  async accedi(email, password) {
    await attesa(null, 200);
    if (!email.includes("@")) {
      throw new ErroreDati(
        "autenticazione",
        "Inserisci un indirizzo email valido.",
      );
    }
    if (password.length < 4) {
      throw new ErroreDati("autenticazione", "Email o password non corretti.");
    }
    const sessione: Sessione = { ...SESSIONE_SEED, email };
    scriviSessione(sessione);
    return sessione;
  },
  async esci() {
    scriviSessione(null);
  },
  osservaSessione(callback) {
    osservatori.push(callback);
    return () => {
      osservatori = osservatori.filter((cb) => cb !== callback);
    };
  },
};

/* ---------------------------------------------------------------- clienti */

function schedeAttiveDi(clientId: string): number {
  return schede.filter((s) => s.client_id === clientId && s.status === "active")
    .length;
}

const clientiFixtures: ClientiApi = {
  async elenco(filtro) {
    const righeFiltrate = clienti
      .filter((c) =>
        filtro.stato === "tutti"
          ? true
          : filtro.stato === "attivi"
            ? c.active
            : !c.active,
      )
      .sort(
        (a, b) =>
          a.last_name.localeCompare(b.last_name, "it") ||
          a.first_name.localeCompare(b.first_name, "it"),
      )
      .map((c) => ({ ...c, schede_attive: schedeAttiveDi(c.id) }));
    return attesa(righeFiltrate);
  },

  async dettaglio(id) {
    return attesa(clienti.find((c) => c.id === id) ?? null);
  },

  async crea(input) {
    const nuovo: Cliente = {
      id: uid("cl"),
      owner_id: SESSIONE_SEED.userId,
      ...input,
      active: true,
      created_at: ora(),
      updated_at: ora(),
    };
    clienti.push(nuovo);
    return attesa(nuovo);
  },

  async aggiorna(id, input) {
    const cliente = clienti.find((c) => c.id === id);
    if (!cliente)
      throw new ErroreDati("sconosciuto", "Questo cliente non esiste più.");
    Object.assign(cliente, input, { updated_at: ora() });
    return attesa({ ...cliente });
  },

  async impostaAttivo(id, attivo) {
    const cliente = clienti.find((c) => c.id === id);
    if (!cliente)
      throw new ErroreDati("sconosciuto", "Questo cliente non esiste più.");
    cliente.active = attivo;
    cliente.updated_at = ora();
    return attesa({ ...cliente });
  },

  async elimina(id) {
    const indice = clienti.findIndex((c) => c.id === id);
    if (indice < 0)
      throw new ErroreDati("sconosciuto", "Questo cliente non esiste più.");
    if (clienti[indice].active) {
      throw new ErroreDati(
        "vincolo",
        "Puoi eliminare definitivamente solo un cliente già archiviato.",
      );
    }
    // Come il `on delete cascade` in Postgres: via il cliente, via le sue schede.
    const schedeDelCliente = schede
      .filter((s) => s.client_id === id)
      .map((s) => s.id);
    schedeDelCliente.forEach(rimuoviSchedaInMemoria);
    clienti.splice(indice, 1);
    await attesa(null);
  },
};

/* --------------------------------------------------------------- esercizi */

const eserciziFixtures: EserciziApi = {
  async elenco(filtro) {
    const ricerca = filtro.ricerca.trim().toLocaleLowerCase("it");
    const filtrati = esercizi
      .filter((e) => (filtro.includiArchiviati ? true : !e.archived))
      .filter((e) =>
        filtro.gruppoMuscolare
          ? e.muscle_group === filtro.gruppoMuscolare
          : true,
      )
      .filter((e) =>
        ricerca ? e.name.toLocaleLowerCase("it").includes(ricerca) : true,
      )
      .sort((a, b) => a.name.localeCompare(b.name, "it"));

    const da = filtro.pagina * filtro.perPagina;
    return attesa({
      righe: filtrati.slice(da, da + filtro.perPagina).map((e) => ({ ...e })),
      totale: filtrati.length,
    });
  },

  async dettaglio(id) {
    return attesa(esercizi.find((e) => e.id === id) ?? null);
  },

  async crea(input) {
    const duplicato = esercizi.some(
      (e) =>
        e.name.toLocaleLowerCase("it") === input.name.toLocaleLowerCase("it"),
    );
    if (duplicato) {
      throw new ErroreDati(
        "vincolo",
        "Esiste già un esercizio con questo nome.",
      );
    }
    const nuovo: Esercizio = {
      id: uid("ex"),
      ...input,
      archived: false,
      created_at: ora(),
      updated_at: ora(),
    };
    esercizi.push(nuovo);
    return attesa(nuovo);
  },

  async aggiorna(id, input) {
    const esercizio = esercizi.find((e) => e.id === id);
    if (!esercizio)
      throw new ErroreDati("sconosciuto", "Questo esercizio non esiste più.");
    Object.assign(esercizio, input, { updated_at: ora() });
    return attesa({ ...esercizio });
  },

  async impostaArchiviato(id, archiviato) {
    const esercizio = esercizi.find((e) => e.id === id);
    if (!esercizio)
      throw new ErroreDati("sconosciuto", "Questo esercizio non esiste più.");
    esercizio.archived = archiviato;
    esercizio.updated_at = ora();
    return attesa({ ...esercizio });
  },

  async utilizzi(id) {
    return attesa(righe.filter((r) => r.exercise_id === id).length);
  },

  async elimina(id) {
    // Rispecchia `on delete restrict` (audit A2).
    if (righe.some((r) => r.exercise_id === id)) {
      throw new ErroreDati(
        "vincolo",
        "Questo esercizio è usato in almeno una scheda. Archivialo invece di eliminarlo, così le schede esistenti restano leggibili.",
      );
    }
    const indice = esercizi.findIndex((e) => e.id === id);
    if (indice >= 0) esercizi.splice(indice, 1);
    await attesa(null);
  },

  async gruppiMuscolari() {
    const unici = new Set(
      esercizi.map((e) => e.muscle_group).filter(Boolean) as string[],
    );
    return attesa([...unici].sort((a, b) => a.localeCompare(b, "it")));
  },
};

/* ----------------------------------------------------------------- schede */

function rimuoviSchedaInMemoria(planId: string) {
  const giorniDelPiano = giorni
    .filter((g) => g.plan_id === planId)
    .map((g) => g.id);
  for (let i = righe.length - 1; i >= 0; i -= 1) {
    if (giorniDelPiano.includes(righe[i].day_id)) righe.splice(i, 1);
  }
  for (let i = giorni.length - 1; i >= 0; i -= 1) {
    if (giorni[i].plan_id === planId) giorni.splice(i, 1);
  }
  const indice = schede.findIndex((s) => s.id === planId);
  if (indice >= 0) schede.splice(indice, 1);
}

function nomeCliente(clientId: string): string {
  const cliente = clienti.find((c) => c.id === clientId);
  return cliente ? `${cliente.first_name} ${cliente.last_name}` : "—";
}

function aSintesi(scheda: Scheda): SchedaSintesi {
  return {
    ...scheda,
    cliente_nome: nomeCliente(scheda.client_id),
    giorni_count: giorni.filter((g) => g.plan_id === scheda.id).length,
  };
}

function giorniEspansi(planId: string): GiornoEspanso[] {
  return giorni
    .filter((g) => g.plan_id === planId)
    .sort((a, b) => a.day_order - b.day_order)
    .map((g) => ({
      ...g,
      esercizi: righe
        .filter((r) => r.day_id === g.id)
        .sort((a, b) => a.order_index - b.order_index)
        .map((r) => ({
          ...r,
          esercizio: esercizi.find((e) => e.id === r.exercise_id) ?? {
            id: r.exercise_id,
            name: "Esercizio non trovato",
            muscle_group: null,
            description: null,
            media_url: null,
            media_type: null,
            media_attribution: null,
            archived: false,
            created_at: ora(),
            updated_at: ora(),
          },
        })),
    }));
}

const schedeFixtures: SchedeApi = {
  async elencoPerCliente(clientId) {
    const righeScheda = schede
      .filter((s) => s.client_id === clientId)
      .sort(
        (a, b) =>
          a.status.localeCompare(b.status) ||
          (b.end_date ?? "").localeCompare(a.end_date ?? ""),
      )
      .map(aSintesi);
    return attesa(righeScheda);
  },

  async inScadenza(sogliaGiorni) {
    const limite = spostaData(toDataISO(oggi()), Math.max(0, sogliaGiorni));
    const clientiAttivi = new Set(
      clienti.filter((c) => c.active).map((c) => c.id),
    );

    const segnalate = schede
      .filter(
        (s) =>
          s.status === "active" &&
          s.end_date !== null &&
          s.end_date <= limite &&
          clientiAttivi.has(s.client_id),
      )
      .sort((a, b) => (a.end_date ?? "").localeCompare(b.end_date ?? ""))
      .map(aSintesi);
    return attesa(segnalate);
  },

  async dettaglio(id) {
    const scheda = schede.find((s) => s.id === id);
    if (!scheda) return attesa(null);
    const cliente = clienti.find((c) => c.id === scheda.client_id);
    const completa: SchedaCompleta = {
      ...scheda,
      cliente: {
        id: cliente?.id ?? scheda.client_id,
        first_name: cliente?.first_name ?? "—",
        last_name: cliente?.last_name ?? "",
        email: cliente?.email ?? null,
        phone: cliente?.phone ?? null,
        active: cliente?.active ?? true,
      },
      giorni: giorniEspansi(id),
    };
    return attesa(completa);
  },

  async crea(input) {
    const nuova: Scheda = {
      id: uid("pl"),
      owner_id: SESSIONE_SEED.userId,
      ...input,
      status: "active",
      created_at: ora(),
      updated_at: ora(),
    };
    schede.push(nuova);
    return attesa(nuova);
  },

  async aggiorna(id, input) {
    const scheda = schede.find((s) => s.id === id);
    if (!scheda)
      throw new ErroreDati("sconosciuto", "Questa scheda non esiste più.");
    Object.assign(scheda, input, { updated_at: ora() });
    return attesa({ ...scheda });
  },

  async impostaStato(id, stato) {
    const scheda = schede.find((s) => s.id === id);
    if (!scheda)
      throw new ErroreDati("sconosciuto", "Questa scheda non esiste più.");
    scheda.status = stato;
    scheda.updated_at = ora();
    return attesa({ ...scheda });
  },

  async elimina(id) {
    const scheda = schede.find((s) => s.id === id);
    if (!scheda)
      throw new ErroreDati("sconosciuto", "Questa scheda non esiste più.");
    if (scheda.status !== "archived") {
      throw new ErroreDati(
        "vincolo",
        "Puoi eliminare definitivamente solo una scheda già archiviata.",
      );
    }
    rimuoviSchedaInMemoria(id);
    await attesa(null);
  },

  async rinnova(id, titolo, inizio, fine) {
    const originale = schede.find((s) => s.id === id);
    if (!originale)
      throw new ErroreDati("sconosciuto", "Questa scheda non esiste più.");

    const date =
      inizio === null && fine === null
        ? calcolaDateRinnovo(originale)
        : { start_date: inizio, end_date: fine };

    const nuova: Scheda = {
      ...originale,
      id: uid("pl"),
      title: titolo,
      start_date: date.start_date,
      end_date: date.end_date,
      status: "active",
      created_at: ora(),
      updated_at: ora(),
    };
    schede.push(nuova);

    // Copia profonda: giorni *e* esercizi (audit B1).
    duplicaStruttura(giorniEspansi(id)).giorni.forEach((giorno) => {
      const dayId = uid("dy");
      giorni.push({
        id: dayId,
        plan_id: nuova.id,
        day_order: giorno.day_order,
        day_name: giorno.day_name,
      });
      giorno.esercizi.forEach((riga) => {
        righe.push({ id: uid("rw"), day_id: dayId, ...riga });
      });
    });

    return attesa(nuova);
  },

  async aggiungiGiorno(planId, nome) {
    const ordine = giorni.filter((g) => g.plan_id === planId).length;
    giorni.push({
      id: uid("dy"),
      plan_id: planId,
      day_order: ordine,
      day_name: nome,
    });
    await attesa(null);
  },

  async rinominaGiorno(dayId, nome) {
    const giorno = giorni.find((g) => g.id === dayId);
    if (giorno) giorno.day_name = nome;
    await attesa(null);
  },

  async eliminaGiorno(dayId) {
    for (let i = righe.length - 1; i >= 0; i -= 1) {
      if (righe[i].day_id === dayId) righe.splice(i, 1);
    }
    const indice = giorni.findIndex((g) => g.id === dayId);
    if (indice >= 0) giorni.splice(indice, 1);
    await attesa(null);
  },

  async riordinaGiorni(_planId, posizioni) {
    posizioni.forEach(({ id, position }) => {
      const giorno = giorni.find((g) => g.id === id);
      if (giorno) giorno.day_order = position;
    });
    await attesa(null, 40);
  },

  async aggiungiEsercizio(dayId, exerciseId) {
    const ordine = righe.filter((r) => r.day_id === dayId).length;
    righe.push({
      id: uid("rw"),
      day_id: dayId,
      exercise_id: exerciseId,
      order_index: ordine,
      sets: "3",
      reps: "10",
      rest_seconds: 60,
      tempo: null,
      notes: null,
    });
    await attesa(null);
  },

  async aggiornaEsercizio(rowId, input) {
    const riga = righe.find((r) => r.id === rowId);
    if (riga) Object.assign(riga, input);
    await attesa(null, 40);
  },

  async rimuoviEsercizio(rowId) {
    const indice = righe.findIndex((r) => r.id === rowId);
    if (indice >= 0) righe.splice(indice, 1);
    await attesa(null);
  },

  async riordinaEsercizi(_dayId, posizioni) {
    posizioni.forEach(({ id, position }) => {
      const riga = righe.find((r) => r.id === id);
      if (riga) riga.order_index = position;
    });
    await attesa(null, 40);
  },
};

/* ----------------------------------------------------------- impostazioni */

const impostazioniFixtures: ImpostazioniApi = {
  async leggi() {
    return attesa({ ...impostazioni });
  },
  async salva(input) {
    impostazioni = { ...impostazioni, ...input };
    return attesa({ ...impostazioni });
  },
  async rigeneraTokenCalendario() {
    // Token finto ma dalla stessa forma di encode(gen_random_bytes(24),'hex'):
    // 48 caratteri esadecimali, così l'URL mostrato in UI è realistico anche
    // sui dati di esempio.
    const nuovoToken = Array.from({ length: 48 }, () =>
      Math.floor(Math.random() * 16).toString(16),
    ).join("");
    impostazioni = { ...impostazioni, calendar_feed_token: nuovoToken };
    await attesa(null, 200);
    return nuovoToken;
  },
};

const dashboardFixtures: DashboardApi = {
  async sommario(sogliaGiorni): Promise<DashboardSommario> {
    const oggiISO = toDataISO(oggi());
    const limite = spostaData(oggiISO, Math.max(0, sogliaGiorni));
    const attive = schede.filter(
      (s) =>
        s.status === "active" &&
        clienti.find((c) => c.id === s.client_id)?.active === true,
    );
    return attesa({
      clientiAttivi: clienti.filter((c) => c.active).length,
      schedeAttive: attive.length,
      schedeScadute: attive.filter(
        (s) => s.end_date !== null && s.end_date < oggiISO,
      ).length,
      schedeInScadenza: attive.filter(
        (s) =>
          s.end_date !== null && s.end_date >= oggiISO && s.end_date <= limite,
      ).length,
    });
  },
};

export const dataLayerFixtures: DataLayer = {
  auth: authFixtures,
  dashboard: dashboardFixtures,
  appuntamenti: appuntamentiFixtures,
  clienti: clientiFixtures,
  esercizi: eserciziFixtures,
  schede: schedeFixtures,
  impostazioni: impostazioniFixtures,
  fixtures: true,
};
