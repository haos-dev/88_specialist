-- =============================================================================
-- 0003 — Trigger e indici
-- =============================================================================

-- -----------------------------------------------------------------------------
-- [A4] updated_at
--
-- Il PRD dà a queste colonne un `default now()`, che vale solo all'insert:
-- senza trigger, `updated_at` resta per sempre uguale a `created_at` e non
-- serve a niente.
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists clients_set_updated_at on public.clients;
create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

drop trigger if exists exercises_set_updated_at on public.exercises;
create trigger exercises_set_updated_at
  before update on public.exercises
  for each row execute function public.set_updated_at();

drop trigger if exists workout_plans_set_updated_at on public.workout_plans;
create trigger workout_plans_set_updated_at
  before update on public.workout_plans
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- [A7] trainer_settings è una riga singola che nessuno crea
--
-- Ogni lettura delle impostazioni doveva gestire "la riga non c'è ancora".
-- Creandola all'iscrizione dell'utente il caso sparisce. L'app resta comunque
-- difensiva: se l'account è stato creato prima di questa migrazione, il primo
-- salvataggio fa un upsert.
-- -----------------------------------------------------------------------------
create or replace function public.crea_impostazioni_trainer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.trainer_settings (owner_id)
  values (new.id)
  on conflict (owner_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.crea_impostazioni_trainer();

-- Riga per gli account che esistono già.
insert into public.trainer_settings (owner_id)
select id from auth.users
on conflict (owner_id) do nothing;

-- -----------------------------------------------------------------------------
-- [A6] Indici per i percorsi di accesso reali dell'app
-- -----------------------------------------------------------------------------

-- Elenco clienti, ordinato per cognome (pagina Clienti).
create index if not exists clients_owner_nome_idx
  on public.clients (owner_id, last_name, first_name);

-- Schede di un cliente (pagina ClientDetail) e cascade delle eliminazioni.
create index if not exists workout_plans_client_idx
  on public.workout_plans (client_id);

-- Widget e badge scadenze: la query filtra status='active' e ordina per
-- end_date. Indice parziale, perché le archiviate non entrano mai nel calcolo.
create index if not exists workout_plans_scadenze_idx
  on public.workout_plans (owner_id, end_date)
  where status = 'active' and end_date is not null;

-- Caricamento di una scheda completa (builder e stampa).
create index if not exists workout_days_plan_idx
  on public.workout_days (plan_id, day_order);

create index if not exists workout_day_exercises_day_idx
  on public.workout_day_exercises (day_id, order_index);

-- "In quante schede è usato questo esercizio?" prima di eliminarlo (PRD §3.2).
create index if not exists workout_day_exercises_exercise_idx
  on public.workout_day_exercises (exercise_id);

-- Filtro per gruppo muscolare nella libreria.
create index if not exists exercises_muscle_group_idx
  on public.exercises (muscle_group)
  where archived = false;
