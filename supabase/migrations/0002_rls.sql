-- =============================================================================
-- 0002 — Row Level Security
--
-- PRD §5/§6.3: RLS attiva su TUTTE le tabelle fin dal primo giorno, anche con
-- un solo trainer. Con RLS spenta l'API PostgREST è pubblicamente leggibile
-- da chiunque abbia la anon key — che è nel bundle del browser.
--
-- [A1] Il PRD dice "ogni tabella limita le righe all'utente autenticato" ma
-- dà a `exercises` nessun `owner_id`: la libreria è condivisa. Le due cose non
-- sono in contraddizione se si separa "RLS attiva" da "filtrata per owner":
-- exercises ha RLS attiva con una policy che concede tutto agli autenticati,
-- e nulla a chi non lo è. Il giorno in cui servisse il multi-trainer vero,
-- è questa policy a cambiare, non lo schema.
-- =============================================================================

alter table public.clients               enable row level security;
alter table public.exercises             enable row level security;
alter table public.workout_plans         enable row level security;
alter table public.workout_days          enable row level security;
alter table public.workout_day_exercises enable row level security;
alter table public.trainer_settings      enable row level security;

-- -----------------------------------------------------------------------------
-- clients — filtrata per proprietario
-- -----------------------------------------------------------------------------
drop policy if exists clients_proprietario on public.clients;
create policy clients_proprietario on public.clients
  for all
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- exercises — libreria condivisa fra tutti gli autenticati
-- -----------------------------------------------------------------------------
drop policy if exists exercises_autenticati on public.exercises;
create policy exercises_autenticati on public.exercises
  for all
  to authenticated
  using (true)
  with check (true);

-- -----------------------------------------------------------------------------
-- workout_plans — filtrata per proprietario
-- -----------------------------------------------------------------------------
drop policy if exists workout_plans_proprietario on public.workout_plans;
create policy workout_plans_proprietario on public.workout_plans
  for all
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- workout_days / workout_day_exercises
--
-- Non hanno owner_id: l'appartenenza si eredita risalendo alla scheda. Le
-- policy usano `exists` invece di un join così restano valide anche quando
-- PostgREST le applica dentro una select annidata.
-- -----------------------------------------------------------------------------
drop policy if exists workout_days_via_scheda on public.workout_days;
create policy workout_days_via_scheda on public.workout_days
  for all
  to authenticated
  using (
    exists (
      select 1 from public.workout_plans p
      where p.id = workout_days.plan_id
        and p.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.workout_plans p
      where p.id = workout_days.plan_id
        and p.owner_id = (select auth.uid())
    )
  );

drop policy if exists workout_day_exercises_via_giorno on public.workout_day_exercises;
create policy workout_day_exercises_via_giorno on public.workout_day_exercises
  for all
  to authenticated
  using (
    exists (
      select 1
        from public.workout_days d
        join public.workout_plans p on p.id = d.plan_id
       where d.id = workout_day_exercises.day_id
         and p.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
        from public.workout_days d
        join public.workout_plans p on p.id = d.plan_id
       where d.id = workout_day_exercises.day_id
         and p.owner_id = (select auth.uid())
    )
  );

-- -----------------------------------------------------------------------------
-- trainer_settings — una riga, la propria
-- -----------------------------------------------------------------------------
drop policy if exists trainer_settings_proprietario on public.trainer_settings;
create policy trainer_settings_proprietario on public.trainer_settings
  for all
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
