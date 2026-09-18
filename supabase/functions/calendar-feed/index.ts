// supabase/functions/calendar-feed/index.ts
//
// Feed iCalendar (.ics) di sola lettura degli appuntamenti di un trainer,
// pensato per l'iscrizione da Apple Calendar / Google Calendar / Outlook
// tramite "aggiungi calendario da URL".
//
// Perché una Edge Function e non una query diretta dal client:
// Apple/Google/Outlook fanno polling periodico di un URL semplice, senza
// login interattivo — non possono autenticarsi con la sessione Supabase del
// trainer. L'autenticazione qui è quindi il token stesso nell'URL (vedi
// 0006_calendar_feed.sql), e per risolverlo su `trainer_settings` serve la
// `service_role key`, che bypassa la RLS. Per questo la query è ristretta
// esplicitamente al solo owner_id trovato tramite il token, riga per riga:
// la service_role key qui dentro non deve mai finire in una query che non
// sia già filtrata per singolo trainer.
//
// A senso unico: quello che il trainer inserisce nell'app compare nel suo
// calendario. Il contrario no (PRD, discussione calendario) — un vero sync
// bidirezionale richiederebbe CalDAV, fuori scope.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Il dataset (e l'interfaccia) sono in italiano per un trainer italiano: si
// assume la sua fascia oraria. Se un giorno servisse configurabile, va
// aggiunta una colonna in trainer_settings — non c'è oggi un modo affidabile
// per dedurla dal solo token.
const TIMEZONE = "Europe/Rome";

// Finestra temporale del feed: un anno indietro e uno avanti sono più che
// sufficienti per un calendario di sessioni di allenamento, e tengono la
// risposta piccola anche dopo anni di utilizzo continuo.
const GIORNI_INDIETRO = 365;
const GIORNI_AVANTI = 365;

function rispostaTestoSemplice(messaggio: string, status: number): Response {
  return new Response(messaggio, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

/** Escape dei caratteri speciali nei campi testo ICS (RFC 5545 §3.3.11). */
function escapeICS(valore: string): string {
  return valore
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/** Piega le righe oltre i 75 ottetti con continuazione CRLF+spazio (RFC 5545 §3.1). */
function piegaRiga(riga: string): string {
  const bytes = new TextEncoder().encode(riga);
  if (bytes.length <= 75) return riga;

  let risultato = "";
  let indice = 0;
  let primaRiga = true;
  while (indice < riga.length) {
    const limite = primaRiga ? 75 : 74; // la continuazione perde 1 carattere per lo spazio iniziale
    const pezzo = riga.slice(indice, indice + limite);
    risultato += (primaRiga ? "" : "\r\n ") + pezzo;
    indice += limite;
    primaRiga = false;
  }
  return risultato;
}

function formattaDataOra(dataISO: string, oraISO: string): string {
  // dataISO: "2025-01-20", oraISO: "09:00:00" -> "20250120T090000"
  const data = dataISO.replaceAll("-", "");
  const ora = oraISO.replaceAll(":", "").slice(0, 6);
  return `${data}T${ora}`;
}

function aggiungiMinuti(dataISO: string, oraISO: string, minuti: number): string {
  const dataOra = new Date(`${dataISO}T${oraISO}`);
  dataOra.setMinutes(dataOra.getMinutes() + minuti);
  const pad = (n: number) => String(n).padStart(2, "0");
  const d = `${dataOra.getFullYear()}${pad(dataOra.getMonth() + 1)}${pad(dataOra.getDate())}`;
  const t = `${pad(dataOra.getHours())}${pad(dataOra.getMinutes())}${pad(dataOra.getSeconds())}`;
  return `${d}T${t}`;
}

function dtstamp(): string {
  return new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

type Appuntamento = {
  id: string;
  title: string;
  appointment_date: string;
  start_time: string;
  duration_minutes: number;
  notes: string | null;
  client_id: string | null;
};

Deno.serve(async (req) => {
  if (req.method !== "GET") {
    return rispostaTestoSemplice("Metodo non supportato.", 405);
  }

  const token = new URL(req.url).searchParams.get("token");
  if (!token) {
    return rispostaTestoSemplice("Parametro 'token' mancante.", 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: impostazioni, error: erroreImpostazioni } = await admin
    .from("trainer_settings")
    .select("owner_id, business_name")
    .eq("calendar_feed_token", token)
    .maybeSingle();

  // Stessa risposta generica per "token inesistente" e "errore interno": non
  // si vuole dare a chi tenta token a caso un modo per distinguere i due casi.
  if (erroreImpostazioni || !impostazioni) {
    return rispostaTestoSemplice("Feed non trovato.", 404);
  }

  const oggi = new Date();
  const dataInizio = new Date(oggi);
  dataInizio.setDate(dataInizio.getDate() - GIORNI_INDIETRO);
  const dataFine = new Date(oggi);
  dataFine.setDate(dataFine.getDate() + GIORNI_AVANTI);
  const isoData = (d: Date) => d.toISOString().slice(0, 10);

  // Filtro esplicito per owner_id anche se la service_role key bypasserebbe
  // comunque la RLS: è la riga che garantisce che il token di un trainer non
  // possa mai restituire gli appuntamenti di un altro.
  const { data: appuntamenti, error: erroreAppuntamenti } = await admin
    .from("appointments")
    .select(
      "id, title, appointment_date, start_time, duration_minutes, notes, client_id",
    )
    .eq("owner_id", impostazioni.owner_id)
    .gte("appointment_date", isoData(dataInizio))
    .lte("appointment_date", isoData(dataFine))
    .order("appointment_date", { ascending: true });

  if (erroreAppuntamenti) {
    return rispostaTestoSemplice("Errore nel leggere gli appuntamenti.", 500);
  }

  const nomeCalendario = impostazioni.business_name || "PT Manager";
  const righe: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PT Manager//Calendar Feed//IT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeICS(nomeCalendario)}`,
    `X-WR-TIMEZONE:${TIMEZONE}`,
  ];

  for (const appuntamento of (appuntamenti ?? []) as Appuntamento[]) {
    righe.push(
      "BEGIN:VEVENT",
      `UID:${appuntamento.id}@ptmanager`,
      `DTSTAMP:${dtstamp()}`,
      `DTSTART;TZID=${TIMEZONE}:${formattaDataOra(appuntamento.appointment_date, appuntamento.start_time)}`,
      `DTEND;TZID=${TIMEZONE}:${aggiungiMinuti(appuntamento.appointment_date, appuntamento.start_time, appuntamento.duration_minutes)}`,
      `SUMMARY:${escapeICS(appuntamento.title)}`,
    );
    if (appuntamento.notes) {
      righe.push(`DESCRIPTION:${escapeICS(appuntamento.notes)}`);
    }
    righe.push("END:VEVENT");
  }

  righe.push("END:VCALENDAR");

  const corpo = righe.map(piegaRiga).join("\r\n") + "\r\n";

  return new Response(corpo, {
    status: 200,
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'inline; filename="calendario.ics"',
      // I client calendario fanno già polling periodico per conto loro
      // (intervallo deciso da loro, non controllabile da qui): una cache
      // breve riduce solo il carico in caso di refresh ravvicinati.
      "cache-control": "public, max-age=300",
    },
  });
});
