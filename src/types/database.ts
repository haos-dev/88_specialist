/**
 * Forma delle tabelle Postgres, allineata a `supabase/migrations/`.
 *
 * Scritta a mano perché il progetto Supabase non esiste ancora; una volta
 * creato, va rigenerata con:
 *   npx supabase gen types typescript --project-id <ref> > src/types/database.ts
 *
 * La struttura (Row/Insert/Update/Relationships, i quattro blocchi vuoti come
 * `{ [_ in never]: never }`) è quella che emette il generatore di Supabase:
 * `supabase-js` la ispeziona per tipizzare `.from()`, `.insert()` e `.rpc()`,
 * e con una forma diversa ogni query degrada silenziosamente a `never`.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type PlanStatus = "active" | "archived";

export type ClientRow = {
  id: string;
  owner_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  birth_date: string | null; // date, ISO 'YYYY-MM-DD'
  height_cm: number | null;
  weight_kg: number | null;
  goal: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type ExerciseRow = {
  id: string;
  name: string;
  muscle_group: string | null;
  description: string | null;
  media_url: string | null;
  media_type: string | null;
  media_attribution: string | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
};

export type WorkoutPlanRow = {
  id: string;
  owner_id: string;
  /** null solo per i template (is_template = true): PRD §3.7bis. */
  client_id: string | null;
  title: string;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  status: PlanStatus;
  is_template: boolean;
  created_at: string;
  updated_at: string;
};

export type WorkoutDayRow = {
  id: string;
  plan_id: string;
  day_order: number;
  day_name: string;
};

export type WorkoutDayExerciseRow = {
  id: string;
  day_id: string;
  exercise_id: string;
  order_index: number;
  sets: string | null;
  reps: string | null;
  rest_seconds: number | null;
  tempo: string | null;
  notes: string | null;
};

export type TrainerSettingsRow = {
  owner_id: string;
  business_name: string | null;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  reminder_days_before: number | null;
  calendar_feed_token: string | null;
};

export type AppointmentRow = {
  id: string;
  owner_id: string;
  client_id: string | null;
  title: string;
  appointment_date: string;
  start_time: string;
  duration_minutes: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

/** Colonne con un `default` in Postgres. */
type ConDefault =
  | "id"
  | "owner_id"
  | "created_at"
  | "updated_at"
  | "active"
  | "archived"
  | "status"
  | "is_template"
  | "day_order"
  | "order_index";

type ColonneNullable<Row> = {
  [K in keyof Row]-?: null extends Row[K] ? K : never;
}[keyof Row];

/**
 * In insert sono opzionali sia le colonne con un default sia quelle nullable:
 * ometterle significa "lascia decidere a Postgres" o "NULL", che è esattamente
 * quello che vuole chi crea, per dire, una riga di esercizio senza recupero.
 */
type Insert<Row> = Omit<
  Row,
  Extract<keyof Row, ConDefault> | ColonneNullable<Row>
> &
  Partial<Pick<Row, Extract<keyof Row, ConDefault> | ColonneNullable<Row>>>;

export type Database = {
  public: {
    Tables: {
      clients: {
        Row: ClientRow;
        Insert: Insert<ClientRow>;
        Update: Partial<ClientRow>;
        Relationships: [];
      };
      exercises: {
        Row: ExerciseRow;
        Insert: Insert<ExerciseRow>;
        Update: Partial<ExerciseRow>;
        Relationships: [];
      };
      workout_plans: {
        Row: WorkoutPlanRow;
        Insert: Insert<WorkoutPlanRow>;
        Update: Partial<WorkoutPlanRow>;
        Relationships: [];
      };
      workout_days: {
        Row: WorkoutDayRow;
        Insert: Insert<WorkoutDayRow>;
        Update: Partial<WorkoutDayRow>;
        Relationships: [];
      };
      workout_day_exercises: {
        Row: WorkoutDayExerciseRow;
        Insert: Insert<WorkoutDayExerciseRow>;
        Update: Partial<WorkoutDayExerciseRow>;
        Relationships: [];
      };
      trainer_settings: {
        Row: TrainerSettingsRow;
        Insert: Insert<TrainerSettingsRow>;
        Update: Partial<TrainerSettingsRow>;
        Relationships: [];
      };
      appointments: {
        Row: AppointmentRow;
        Insert: Insert<AppointmentRow>;
        Update: Partial<AppointmentRow>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      /**
       * Rinnovo atomico: copia scheda + giorni + esercizi in una sola
       * transazione (audit B1). Client-side servirebbero 3+ round-trip non
       * transazionali, e un errore a metà lascerebbe una scheda a pezzi.
       */
      rinnova_scheda: {
        Args: {
          p_plan_id: string;
          p_titolo: string;
          p_inizio: string | null;
          p_fine: string | null;
        };
        Returns: WorkoutPlanRow;
      };
      /** Copia un template su un cliente specifico, come rinnova_scheda ma verso un client_id diverso (0007). */
      applica_template: {
        Args: {
          p_template_id: string;
          p_client_id: string;
          p_titolo: string;
          p_inizio: string | null;
          p_fine: string | null;
        };
        Returns: WorkoutPlanRow;
      };
      /** Riscrive in un colpo solo le posizioni cambiate da un drag&drop (audit B2). */
      riordina_giorni: {
        Args: { p_plan_id: string; p_ids: string[]; p_posizioni: number[] };
        Returns: undefined;
      };
      riordina_esercizi: {
        Args: { p_day_id: string; p_ids: string[]; p_posizioni: number[] };
        Returns: undefined;
      };
      /** Rigenera il token del feed calendario del trainer autenticato (0006). */
      rigenera_token_calendario: {
        Args: Record<string, never>;
        Returns: string;
      };
    };
    Enums: { plan_status: PlanStatus };
    CompositeTypes: { [_ in never]: never };
  };
};
