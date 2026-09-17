/**
 * Audit B8 — l'app richiede rete (PRD §5) e quando manca deve dirlo con
 * parole sue, non con un "Failed to fetch" del browser. Ogni operazione del
 * data layer passa da qui, così ogni schermata mostra lo stesso messaggio.
 */
export type CausaErrore = 'offline' | 'autenticazione' | 'vincolo' | 'sconosciuto'

export class ErroreDati extends Error {
  readonly causa: CausaErrore
  readonly dettaglio?: string

  constructor(causa: CausaErrore, message: string, dettaglio?: string) {
    super(message)
    this.name = 'ErroreDati'
    this.causa = causa
    this.dettaglio = dettaglio
  }
}

export function eOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

/** Traduce un errore Postgres/Supabase in qualcosa che il trainer può leggere. */
export function traduciErrore(errore: unknown, azione: string): ErroreDati {
  if (errore instanceof ErroreDati) return errore

  if (eOffline()) {
    return new ErroreDati(
      'offline',
      `Non c'è connessione, quindi ${azione} non è stato salvato. Riprova quando torni online.`,
    )
  }

  const e = errore as { code?: string; message?: string; status?: number } | null
  const code = e?.code
  const message = e?.message ?? String(errore)

  if (e?.status === 401 || code === 'PGRST301') {
    return new ErroreDati(
      'autenticazione',
      'La sessione è scaduta. Accedi di nuovo per continuare.',
      message,
    )
  }

  // 23503 foreign_key_violation, 23505 unique_violation, 23514 check_violation
  if (code === '23503') {
    return new ErroreDati(
      'vincolo',
      'Questo elemento è usato altrove e non può essere eliminato.',
      message,
    )
  }
  if (code === '23505') {
    return new ErroreDati('vincolo', 'Esiste già un elemento con questo nome.', message)
  }
  if (code === '23514') {
    return new ErroreDati('vincolo', 'Alcuni valori non sono ammessi.', message)
  }

  if (/fetch|network/i.test(message)) {
    return new ErroreDati(
      'offline',
      `Il server non risponde, quindi ${azione} non è stato salvato. Riprova fra poco.`,
      message,
    )
  }

  return new ErroreDati('sconosciuto', `Non è stato possibile ${azione}.`, message)
}

export function messaggioErrore(errore: unknown): string {
  if (errore instanceof ErroreDati) return errore.message
  if (errore instanceof Error) return errore.message
  return 'Si è verificato un errore imprevisto.'
}
