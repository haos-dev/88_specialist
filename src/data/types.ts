import type {
  Appuntamento,
  AppuntamentoInput,
  Cliente,
  ClienteConSchede,
  ClienteInput,
  Esercizio,
  EsercizioInput,
  GiornoEsercizioInput,
  Impostazioni,
  Riordino,
  Scheda,
  SchedaCompleta,
  SchedaInput,
  SchedaSintesi,
  TemplateInput,
  TemplateSintesi,
} from "@/types/domain";

/* ------------------------------------------------------------------ auth */

export interface Sessione {
  userId: string;
  email: string;
}

export interface AuthApi {
  sessioneCorrente(): Promise<Sessione | null>;
  accedi(email: string, password: string): Promise<Sessione>;
  esci(): Promise<void>;
  /** Ritorna la funzione di annullamento della sottoscrizione. */
  osservaSessione(callback: (sessione: Sessione | null) => void): () => void;
}

/* ------------------------------------------------------------ dashboard */

export interface DashboardSommario {
  clientiAttivi: number;
  schedeAttive: number;
  schedeScadute: number;
  schedeInScadenza: number;
}

export interface DashboardApi {
  sommario(sogliaGiorni: number): Promise<DashboardSommario>;
}

export interface AppuntamentiApi {
  elenco(mese: string): Promise<Appuntamento[]>;
  crea(input: AppuntamentoInput): Promise<Appuntamento>;
  elimina(id: string): Promise<void>;
}

/* --------------------------------------------------------------- clienti */

export interface FiltroClienti {
  /** 'attivi' è il default della pagina Clienti (PRD §3.1). */
  stato: "attivi" | "archiviati" | "tutti";
}

export interface ClientiApi {
  elenco(filtro: FiltroClienti): Promise<ClienteConSchede[]>;
  dettaglio(id: string): Promise<Cliente | null>;
  crea(input: ClienteInput): Promise<Cliente>;
  aggiorna(id: string, input: ClienteInput): Promise<Cliente>;
  /** Archivia (false) o riattiva (true). */
  impostaAttivo(id: string, attivo: boolean): Promise<Cliente>;
  /** Hard delete: consentito solo su clienti già archiviati (PRD §3.1). */
  elimina(id: string): Promise<void>;
}

/* -------------------------------------------------------------- esercizi */

export interface FiltroEsercizi {
  ricerca: string;
  gruppoMuscolare: string | null;
  /** Audit B3: il dataset è di ~1300 righe, si pagina lato server. */
  pagina: number;
  perPagina: number;
}

export interface PaginaEsercizi {
  righe: Esercizio[];
  totale: number;
}

export interface EserciziApi {
  elenco(filtro: FiltroEsercizi): Promise<PaginaEsercizi>;
  dettaglio(id: string): Promise<Esercizio | null>;
  crea(input: EsercizioInput): Promise<Esercizio>;
  aggiorna(id: string, input: EsercizioInput): Promise<Esercizio>;
  /** Quante righe di scheda usano questo esercizio (PRD §3.2: avviso prima di eliminare). */
  utilizzi(id: string): Promise<number>;
  elimina(id: string): Promise<void>;
  gruppiMuscolari(): Promise<string[]>;
}

/* --------------------------------------------------------------- schede */

export interface SchedeApi {
  elencoPerCliente(clientId: string): Promise<SchedaSintesi[]>;
  /** Alimenta il badge in sidebar e il widget in dashboard (PRD §3.6). */
  inScadenza(sogliaGiorni: number): Promise<SchedaSintesi[]>;
  dettaglio(id: string): Promise<SchedaCompleta | null>;
  crea(input: SchedaInput): Promise<Scheda>;
  aggiorna(id: string, input: Omit<SchedaInput, "client_id">): Promise<Scheda>;
  impostaStato(id: string, stato: "active" | "archived"): Promise<Scheda>;
  /** Hard delete: solo su schede già archiviate (PRD §3.3). */
  elimina(id: string): Promise<void>;
  /** Copia profonda con nuove date (PRD §3.3, audit B1). Ritorna la nuova scheda. */
  rinnova(
    id: string,
    titolo: string,
    inizio: string | null,
    fine: string | null,
  ): Promise<Scheda>;

  aggiungiGiorno(planId: string, nome: string): Promise<void>;
  rinominaGiorno(dayId: string, nome: string): Promise<void>;
  eliminaGiorno(dayId: string): Promise<void>;
  /** Un solo upsert batch per tutte le posizioni cambiate (audit B2). */
  riordinaGiorni(planId: string, posizioni: Riordino[]): Promise<void>;

  aggiungiEsercizio(dayId: string, exerciseId: string): Promise<void>;
  aggiornaEsercizio(rowId: string, input: GiornoEsercizioInput): Promise<void>;
  rimuoviEsercizio(rowId: string): Promise<void>;
  riordinaEsercizi(dayId: string, posizioni: Riordino[]): Promise<void>;

  /* ------------------------------------------------------------ template */
  // §3.7bis: un template è una Scheda con client_id null e is_template true.
  // Condivide giorni/esercizi/drag&drop con le schede normali (gli hook e i
  // metodi qui sopra restano validi per un template tanto quanto per una
  // scheda) — questi cinque metodi coprono solo ciò che è specifico dei
  // template: elenco, creazione, modifica, applicazione a un cliente,
  // eliminazione diretta (nessuna regola "solo se archiviato": un template
  // non ha schede dipendenti da proteggere).
  elencoTemplate(): Promise<TemplateSintesi[]>;
  creaTemplate(input: TemplateInput): Promise<Scheda>;
  aggiornaTemplate(id: string, input: TemplateInput): Promise<Scheda>;
  /** Copia profonda su un cliente specifico (gemella di `rinnova`). */
  applicaTemplate(
    templateId: string,
    clientId: string,
    titolo: string,
    inizio: string | null,
    fine: string | null,
  ): Promise<Scheda>;
  eliminaTemplate(id: string): Promise<void>;
}

/* --------------------------------------------------------- impostazioni */

export type ImpostazioniInput = Omit<Impostazioni, "owner_id">;

export interface ImpostazioniApi {
  leggi(): Promise<Impostazioni>;
  salva(input: ImpostazioniInput): Promise<Impostazioni>;
  /** Genera un nuovo token per il feed calendario, invalidando quello precedente. */
  rigeneraTokenCalendario(): Promise<string>;
}

/* ------------------------------------------------------------------ tutto */

export interface DataLayer {
  auth: AuthApi;
  dashboard: DashboardApi;
  appuntamenti: AppuntamentiApi;
  clienti: ClientiApi;
  esercizi: EserciziApi;
  schede: SchedeApi;
  impostazioni: ImpostazioniApi;
  /** true quando gira sui dati finti: la UI lo segnala nella sidebar. */
  readonly fixtures: boolean;
}
