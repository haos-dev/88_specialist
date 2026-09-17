-- =============================================================================
-- 0001 — Schema iniziale
--
-- Corrisponde a PRD §7, con le correzioni dell'audit segnate come [Ax].
-- `auth.users` di Supabase gestisce già l'account del trainer: le tabelle qui
-- sotto lo referenziano tramite `owner_id`, anche se oggi l'utente è uno solo.
-- =============================================================================

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- -----------------------------------------------------------------------------
-- clients
-- -----------------------------------------------------------------------------
create table if not exists public.clients (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users (id) on delete cascade default auth.uid(),
  first_name  text not null check (length(btrim(first_name)) > 0),
  last_name   text not null check (length(btrim(last_name)) > 0),
  email       text,
  phone       text,
  birth_date  date,
  notes       text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on column public.clients.active is
  'false = archiviato. PRD §3.1: si elimina definitivamente solo un cliente archiviato.';

-- -----------------------------------------------------------------------------
-- exercises — libreria condivisa, senza owner_id (PRD §7)
-- -----------------------------------------------------------------------------
create table if not exists public.exercises (
  id                uuid primary key default gen_random_uuid(),
  name              text not null check (length(btrim(name)) > 0),
  muscle_group      text,
  description       text,
  media_url         text,
  media_type        text,
  media_attribution text,
  -- [A2] Un esercizio usato in una scheda non si può cancellare (la FK è
  -- `on delete restrict`), ma si deve poter togliere dalla libreria senza
  -- riscrivere lo storico dei clienti.
  archived          boolean not null default false,
  created_at        timestamptz not null default now(),
  -- [A8] c'era solo created_at, a differenza di tutte le altre tabelle.
  updated_at        timestamptz not null default now()
);

-- [A5] Il seed deduplica per nome (PRD §3.2) ma niente lo imponeva: senza
-- questo indice due esecuzioni dello script creano 2600 righe invece di 1300.
create unique index if not exists exercises_name_unique
  on public.exercises (lower(name));

-- -----------------------------------------------------------------------------
-- workout_plans
-- -----------------------------------------------------------------------------
create table if not exists public.workout_plans (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users (id) on delete cascade default auth.uid(),
  client_id   uuid not null references public.clients (id) on delete cascade,
  title       text not null check (length(btrim(title)) > 0),
  start_date  date,
  end_date    date,
  notes       text,
  -- [A3] il PRD dichiarava 'active' | 'archived' ma non lo imponeva.
  status      text not null default 'active' check (status in ('active', 'archived')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- Una scheda che finisce prima di iniziare romperebbe il calcolo scadenze.
  constraint workout_plans_periodo_valido
    check (start_date is null or end_date is null or start_date <= end_date)
);

-- -----------------------------------------------------------------------------
-- workout_days
-- -----------------------------------------------------------------------------
create table if not exists public.workout_days (
  id        uuid primary key default gen_random_uuid(),
  plan_id   uuid not null references public.workout_plans (id) on delete cascade,
  day_order integer not null default 0,
  day_name  text not null default 'Giorno'
);

-- -----------------------------------------------------------------------------
-- workout_day_exercises
-- -----------------------------------------------------------------------------
create table if not exists public.workout_day_exercises (
  id           uuid primary key default gen_random_uuid(),
  day_id       uuid not null references public.workout_days (id) on delete cascade,
  -- [A2] `restrict`, non il NO ACTION implicito del PRD: rende esplicito che
  -- la cancellazione di un esercizio in uso deve fallire, e l'app lo traduce
  -- in "archivialo invece di eliminarlo".
  exercise_id  uuid not null references public.exercises (id) on delete restrict,
  order_index  integer not null default 0,
  -- sets/reps restano text di proposito: "max", "8-10" e "45\"" sono valori
  -- che il trainer scrive davvero.
  sets         text,
  reps         text,
  rest_seconds integer check (rest_seconds is null or rest_seconds >= 0),
  tempo        text,
  notes        text
);

-- -----------------------------------------------------------------------------
-- trainer_settings — una riga per trainer
-- -----------------------------------------------------------------------------
create table if not exists public.trainer_settings (
  owner_id             uuid primary key references auth.users (id) on delete cascade default auth.uid(),
  business_name        text,
  logo_url             text,
  primary_color        text,
  secondary_color      text,
  address              text,
  phone                text,
  email                text,
  reminder_days_before integer default 7
    check (reminder_days_before is null or (reminder_days_before between 0 and 365))
);
