-- =============================================================================
-- 0009 — Lezioni ricorrenti alla creazione del cliente + correzioni appointments
--
-- Il form "Nuovo cliente" può indicare i giorni e gli orari di allenamento e
-- una data di fine: l'app calcola le singole lezioni (logica pura in
-- src/features/clients/trainingSchedule.ts, testata) e le salva insieme al
-- cliente con `crea_cliente_con_lezioni`, in una sola transazione.
--
-- Più tre correzioni emerse dall'audit sulla tabella appointments (0005).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- updated_at su appointments
--
-- 0005 è arrivata dopo 0003 e non ha agganciato il trigger: senza,
-- `updated_at` resta per sempre uguale a `created_at` (stesso difetto [A4]).
-- -----------------------------------------------------------------------------
drop trigger if exists appointments_set_updated_at on public.appointments;
create trigger appointments_set_updated_at
  before update on public.appointments
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Eliminare un cliente elimina i suoi appuntamenti
--
-- Con `on delete set null` le lezioni di un cliente eliminato restavano in
-- calendario senza cliente, ancora intitolate "Lezione Mario Rossi". Si
-- elimina definitivamente solo un cliente già archiviato (PRD §3.1), e le
-- sue schede se ne vanno già in cascade: lo stesso vale ora per il calendario.
-- -----------------------------------------------------------------------------
alter table public.appointments
  drop constraint if exists appointments_client_id_fkey;
alter table public.appointments
  add constraint appointments_client_id_fkey
  foreign key (client_id) references public.clients (id) on delete cascade;

-- Serve alla cascade qui sopra e al trigger di archiviazione qui sotto, che
-- altrimenti scandirebbero l'intera tabella per ogni cliente.
create index if not exists appointments_client_idx
  on public.appointments (client_id)
  where client_id is not null;

-- -----------------------------------------------------------------------------
-- Archiviare un cliente toglie dal calendario i suoi appuntamenti futuri
--
-- Quelli passati restano: sono lo storico di cosa è stato fatto. Un trigger,
-- non una seconda query dal client, così l'archiviazione e la pulizia
-- avvengono nella stessa transazione. Riattivare il cliente non li
-- ricrea: la UI lo dice prima di archiviare.
--
-- "Futuro" è valutato nel fuso del trainer, lo stesso che usa il feed .ics
-- (supabase/functions/calendar-feed): data e ora sono salvate come orario
-- locale di Roma, non in UTC.
-- -----------------------------------------------------------------------------
create or replace function public.rimuovi_appuntamenti_futuri_cliente()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  delete from public.appointments
   where client_id = new.id
     and (appointment_date + start_time) > (now() at time zone 'Europe/Rome');
  return new;
end;
$$;

drop trigger if exists clients_archiviato_rimuovi_appuntamenti on public.clients;
create trigger clients_archiviato_rimuovi_appuntamenti
  after update of active on public.clients
  for each row
  when (old.active and not new.active)
  execute function public.rimuovi_appuntamenti_futuri_cliente();

-- -----------------------------------------------------------------------------
-- crea_cliente_con_lezioni
--
-- Cliente + lezioni in una transazione: dal client sarebbero due chiamate, e
-- un errore sulla seconda lascerebbe un cliente creato senza le lezioni che
-- il trainer ha appena chiesto (stesso ragionamento di rinnova_scheda, 0004).
--
-- `security invoker`: owner_id prende il default auth.uid() su entrambe le
-- tabelle e le policy RLS continuano a verificarlo in `with check`.
-- I campi del cliente sono elencati uno per uno invece di un
-- jsonb_populate_record: id, owner_id, active e le date di sistema non si
-- possono passare da qui.
-- -----------------------------------------------------------------------------
create or replace function public.crea_cliente_con_lezioni(
  p_cliente jsonb,
  p_lezioni jsonb
)
returns public.clients
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_cliente public.clients;
begin
  if jsonb_typeof(p_lezioni) is distinct from 'array' then
    raise exception 'p_lezioni deve essere un array' using errcode = 'invalid_parameter_value';
  end if;

  -- Lo stesso tetto del form (12 mesi, sette giorni su sette): oltre, è un
  -- errore di chi chiama, non un programma di allenamento.
  if jsonb_array_length(p_lezioni) > 400 then
    raise exception 'Troppe lezioni in un colpo solo' using errcode = 'check_violation';
  end if;

  insert into public.clients
    (first_name, last_name, email, phone, birth_date, height_cm, weight_kg, goal, notes)
  values (
    p_cliente ->> 'first_name',
    p_cliente ->> 'last_name',
    p_cliente ->> 'email',
    p_cliente ->> 'phone',
    (p_cliente ->> 'birth_date')::date,
    (p_cliente ->> 'height_cm')::numeric,
    (p_cliente ->> 'weight_kg')::numeric,
    p_cliente ->> 'goal',
    p_cliente ->> 'notes'
  )
  returning * into v_cliente;

  insert into public.appointments
    (client_id, title, appointment_date, start_time, duration_minutes, notes)
  select v_cliente.id,
         l.title,
         l.appointment_date,
         l.start_time,
         coalesce(l.duration_minutes, 60),
         l.notes
    from jsonb_to_recordset(p_lezioni) as l(
      title            text,
      appointment_date date,
      start_time       time,
      duration_minutes integer,
      notes            text
    );

  return v_cliente;
end;
$$;

revoke all on function public.crea_cliente_con_lezioni(jsonb, jsonb) from public, anon;
grant execute on function public.crea_cliente_con_lezioni(jsonb, jsonb) to authenticated;
