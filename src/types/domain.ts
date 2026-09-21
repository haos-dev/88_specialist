import type {
  ClientRow,
  ExerciseRow,
  PlanStatus,
  TrainerSettingsRow,
  WorkoutDayExerciseRow,
  WorkoutDayRow,
  WorkoutPlanRow,
  AppointmentRow,
} from "./database";

export type { PlanStatus };

export type Cliente = ClientRow;
export type Esercizio = ExerciseRow;
export type Scheda = WorkoutPlanRow;
export type Giorno = WorkoutDayRow;
export type GiornoEsercizio = WorkoutDayExerciseRow;
export type Impostazioni = TrainerSettingsRow;
export type Appuntamento = AppointmentRow;

/** Riga della tabella Clienti: anagrafica + quante schede attive ha. */
export interface ClienteConSchede extends Cliente {
  schede_attive: number;
}

/** Un esercizio dentro un giorno, già unito alla sua voce di libreria. */
export interface GiornoEsercizioEspanso extends GiornoEsercizio {
  esercizio: Esercizio;
}

export interface GiornoEspanso extends Giorno {
  esercizi: GiornoEsercizioEspanso[];
}

/** Scheda completa: quello che servono sia il builder sia la stampa. */
export interface SchedaCompleta extends Scheda {
  /** null solo per un template (§3.7bis): non ha un cliente. */
  cliente: Pick<
    Cliente,
    "id" | "first_name" | "last_name" | "email" | "phone" | "active"
  > | null;
  giorni: GiornoEspanso[];
}

export interface AppuntamentoInput {
  client_id: string | null;
  title: string;
  appointment_date: string;
  start_time: string;
  duration_minutes: number;
  notes: string | null;
}

/** Scheda nell'elenco di un cliente / nel widget scadenze. */
export interface SchedaSintesi extends Scheda {
  cliente_nome: string;
  giorni_count: number;
}

/**
 * Template di allenamento (§3.7bis): una `Scheda` con `client_id = null` e
 * `is_template = true`. Riepilogo per la griglia nella pagina Esercizi —
 * non serve `cliente_nome`, un template non ne ha uno.
 */
export interface TemplateSintesi {
  id: string;
  title: string;
  notes: string | null;
  giorni_count: number;
  esercizi_count: number;
  created_at: string;
}

/** Payload di creazione/modifica di un template (solo titolo e note: niente date, niente cliente). */
export interface TemplateInput {
  title: string;
  notes: string | null;
}

/**
 * PRD §3.6. `nessuna` copre sia le schede ancora lontane dalla scadenza sia
 * quelle senza `end_date`, che vanno escluse dal conteggio.
 */
export type StatoScadenza = "scaduta" | "in-scadenza" | "nessuna";

export interface Scadenza {
  stato: StatoScadenza;
  /** Giorni alla scadenza: negativo se già scaduta, null se non applicabile. */
  giorniResidui: number | null;
}

/** Payload del form Cliente (§3.1). */
export interface ClienteInput {
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  birth_date: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  goal: string | null;
  notes: string | null;
}

/** Payload del form Esercizio (§3.2). */
export interface EsercizioInput {
  name: string;
  muscle_group: string | null;
  description: string | null;
  media_url: string | null;
  media_type: string | null;
  media_attribution: string | null;
}

/** Payload del form Scheda (§3.3). */
export interface SchedaInput {
  client_id: string;
  title: string;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
}

/** Campi editabili di una riga esercizio dentro un giorno. */
export interface GiornoEsercizioInput {
  sets: string | null;
  reps: string | null;
  rest_seconds: number | null;
  tempo: string | null;
  notes: string | null;
}

/** Una sola posizione da riscrivere dopo un drag&drop (§3.3, audit B2). */
export interface Riordino {
  id: string;
  position: number;
}

export const GRUPPI_MUSCOLARI = [
  "Petto",
  "Dorso",
  "Spalle",
  "Bicipiti",
  "Tricipiti",
  "Avambracci",
  "Addome",
  "Quadricipiti",
  "Femorali",
  "Glutei",
  "Polpacci",
  "Cardio",
  "Mobilità",
] as const;

export type GruppoMuscolare = (typeof GRUPPI_MUSCOLARI)[number];
