-- =============================================================================
-- 0007 — Campi corporei cliente + schede-template
--
-- Due modifiche indipendenti, stessa migrazione perché arrivate insieme.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Clienti: altezza, peso, obiettivo
--
-- Tutti opzionali (non tutti i trainer li raccolgono per ogni cliente). I
-- range dei check sono larghi apposta: servono a intercettare un errore di
-- battitura (es. "175" scritto in metri), non a validare la plausibilità
-- clinica di un valore.
-- -----------------------------------------------------------------------------
alter table public.clients
  add column if not exists height_cm numeric(5, 1)
    check (height_cm is null or (height_cm between 50 and 250)),
  add column if not exists weight_kg numeric(5, 1)
    check (weight_kg is null or (weight_kg between 20 and 400)),
  add column if not exists goal text;

-- -----------------------------------------------------------------------------
-- Schede-template
--
-- Una scheda-template è una riga di workout_plans senza cliente: stessa
-- tabella, stesse policy RLS (già basate su owner_id, non su un join a
-- clients — vedi 0002), stesso builder di giorni/esercizi. Niente tabelle
-- nuove, niente logica duplicata per una struttura identica.
-- -----------------------------------------------------------------------------
alter table public.workout_plans
  alter column client_id drop not null,
  add column if not exists is_template boolean not null default false;

alter table public.workout_plans
  drop constraint if exists workout_plans_client_o_template;
alter table public.workout_plans
  add constraint workout_plans_client_o_template
  check (
    (is_template and client_id is null)
    or (not is_template and client_id is not null)
  );

-- L'indice di scadenza (0003) filtrava solo per status='active'. I template
-- non hanno mai end_date valorizzato per definizione (non sono legati a un
-- periodo), ma lo rendiamo esplicito invece di contare su quella convenzione:
-- se un giorno qualcuno la rompe per errore, l'indice/la query restano corretti.
drop index if exists public.workout_plans_scadenze_idx;
create index workout_plans_scadenze_idx
  on public.workout_plans (owner_id, end_date)
  where status = 'active' and end_date is not null and not is_template;

-- Elenco template nella pagina Esercizi.
create index if not exists workout_plans_template_idx
  on public.workout_plans (owner_id)
  where is_template;

-- -----------------------------------------------------------------------------
-- applica_template — gemella di rinnova_scheda (0004), con una differenza:
-- la copia va a un client_id di destinazione diverso dall'origine (che qui è
-- sempre null). Stessa transazione singola per non lasciare in giro una
-- scheda a metà se qualcosa fallisce nel mezzo.
-- -----------------------------------------------------------------------------
create or replace function public.applica_template(
  p_template_id uuid,
  p_client_id   uuid,
  p_titolo      text,
  p_inizio      date,
  p_fine        date
)
returns public.workout_plans
language plpgsql
as $$
declare
  v_template  public.workout_plans;
  v_cliente   public.clients;
  v_nuova     public.workout_plans;
  v_giorno    record;
  v_nuovo_id  uuid;
begin
  select * into v_template
    from public.workout_plans
   where id = p_template_id and is_template = true;

  if not found then
    raise exception 'Template non trovato' using errcode = 'no_data_found';
  end if;

  -- Il client_id di destinazione non viene dal record sorgente (che non ne
  -- ha uno): va verificato a sé, altrimenti un id sbagliato creerebbe una
  -- scheda orfana che la RLS nasconderebbe solo alla lettura, non all'insert.
  select * into v_cliente
    from public.clients
   where id = p_client_id and active = true;

  if not found then
    raise exception 'Cliente non trovato o archiviato' using errcode = 'no_data_found';
  end if;

  insert into public.workout_plans
    (owner_id, client_id, title, start_date, end_date, notes, status, is_template)
  values
    (v_template.owner_id, p_client_id, p_titolo, p_inizio, p_fine,
     v_template.notes, 'active', false)
  returning * into v_nuova;

  for v_giorno in
    select * from public.workout_days
     where plan_id = p_template_id
     order by day_order
  loop
    insert into public.workout_days (plan_id, day_order, day_name)
    values (v_nuova.id, v_giorno.day_order, v_giorno.day_name)
    returning id into v_nuovo_id;

    insert into public.workout_day_exercises
      (day_id, exercise_id, order_index, sets, reps, rest_seconds, tempo, notes)
    select v_nuovo_id, exercise_id, order_index, sets, reps, rest_seconds, tempo, notes
      from public.workout_day_exercises
     where day_id = v_giorno.id
     order by order_index;
  end loop;

  return v_nuova;
end;
$$;

revoke all on function public.applica_template(uuid, uuid, text, date, date) from public, anon;
grant execute on function public.applica_template(uuid, uuid, text, date, date) to authenticated;

-- -----------------------------------------------------------------------------
-- rinnova_scheda (0004) — guardia sui template
--
-- Con client_id nullable, rinnovare un template inserirebbe una riga con
-- client_id null e is_template false: violerebbe workout_plans_client_o_template
-- con un errore generico. Meglio dirlo con parole chiare. Un template non si
-- rinnova (non ha date né cliente): si applica.
-- -----------------------------------------------------------------------------
create or replace function public.rinnova_scheda(
  p_plan_id uuid,
  p_titolo  text,
  p_inizio  date,
  p_fine    date
)
returns public.workout_plans
language plpgsql
as $$
declare
  v_originale public.workout_plans;
  v_nuova     public.workout_plans;
  v_giorno    record;
  v_nuovo_id  uuid;
begin
  select * into v_originale
    from public.workout_plans
   where id = p_plan_id;

  if not found then
    raise exception 'Scheda non trovata' using errcode = 'no_data_found';
  end if;

  if v_originale.is_template then
    raise exception 'Un template non si rinnova: applicalo a un cliente'
      using errcode = 'check_violation';
  end if;

  insert into public.workout_plans
    (owner_id, client_id, title, start_date, end_date, notes, status)
  values
    (v_originale.owner_id, v_originale.client_id, p_titolo, p_inizio, p_fine,
     v_originale.notes, 'active')
  returning * into v_nuova;

  for v_giorno in
    select * from public.workout_days
     where plan_id = p_plan_id
     order by day_order
  loop
    insert into public.workout_days (plan_id, day_order, day_name)
    values (v_nuova.id, v_giorno.day_order, v_giorno.day_name)
    returning id into v_nuovo_id;

    insert into public.workout_day_exercises
      (day_id, exercise_id, order_index, sets, reps, rest_seconds, tempo, notes)
    select v_nuovo_id, exercise_id, order_index, sets, reps, rest_seconds, tempo, notes
      from public.workout_day_exercises
     where day_id = v_giorno.id
     order by order_index;
  end loop;

  return v_nuova;
end;
$$;

revoke all on function public.rinnova_scheda(uuid, text, date, date) from public, anon;
grant execute on function public.rinnova_scheda(uuid, text, date, date) to authenticated;
