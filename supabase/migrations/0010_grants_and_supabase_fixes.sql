-- =============================================================================
-- 0010 — Grant espliciti per la Data API + search_path di pgcrypto
--
-- Due problemi che su un Postgres "nudo" non si vedono e su un progetto
-- Supabase creato oggi rompono l'app al primo accesso. Riprodotti entrambi
-- applicando 0001–0009 a un Postgres configurato come Supabase (pgcrypto
-- nello schema `extensions`, ruoli API senza grant di default).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Grant sulle tabelle
--
-- Fino a maggio 2026 Supabase concedeva in automatico select/insert/update/
-- delete su ogni tabella di `public` ad anon, authenticated e service_role.
-- I progetti creati dal 30 maggio 2026 non lo fanno più: una tabella senza
-- grant espliciti risponde "permission denied" a qualunque query della
-- Data API, prima ancora che la RLS venga valutata.
-- https://github.com/orgs/supabase/discussions/45329
--
-- - authenticated: l'app. Tutto il CRUD; cosa vede lo decide la RLS (0002).
-- - service_role: la Edge Function del feed .ics e lo script di seed. Salta
--   la RLS, ma i grant di tabella le servono comunque.
-- - anon: niente. L'app non ha pagine pubbliche e il feed passa dalla
--   service_role. Senza grant, anche un errore futuro in una policy RLS non
--   può esporre dati a chi non ha fatto login.
--
-- Su un progetto che i grant li ha già (creato prima di maggio 2026) queste
-- righe non cambiano nulla. Una tabella aggiunta in futuro va aggiunta qui.
-- -----------------------------------------------------------------------------
grant usage on schema public to authenticated, service_role;

grant select, insert, update, delete on
  public.clients,
  public.exercises,
  public.workout_plans,
  public.workout_days,
  public.workout_day_exercises,
  public.trainer_settings,
  public.appointments
to authenticated, service_role;

-- Nessuna sequenza da concedere: tutte le chiavi sono uuid.

-- -----------------------------------------------------------------------------
-- rigenera_token_calendario (0006)
--
-- Chiama gen_random_bytes, che viene da pgcrypto. Su Supabase pgcrypto vive
-- nello schema `extensions`, e con `set search_path = public` la funzione non
-- la trova: "function gen_random_bytes(integer) does not exist" al primo
-- clic su "Genera link" nelle Impostazioni. Il default della colonna
-- calendar_feed_token non ha il problema: Postgres risolve la funzione una
-- volta, quando la colonna viene creata.
--
-- `extensions` in coda al search_path: su un Postgres dove pgcrypto sta in
-- `public` lo schema non esiste e Postgres lo ignora.
-- -----------------------------------------------------------------------------
create or replace function public.rigenera_token_calendario()
returns text
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  nuovo_token text := encode(gen_random_bytes(24), 'hex');
begin
  update public.trainer_settings
  set calendar_feed_token = nuovo_token
  where owner_id = auth.uid();

  if not found then
    -- Stesso caso limite dell'audit A7: la riga potrebbe non esistere ancora
    -- se il trigger di creazione non è mai scattato per questo account.
    insert into public.trainer_settings (owner_id, calendar_feed_token)
    values (auth.uid(), nuovo_token);
  end if;

  return nuovo_token;
end;
$$;

-- `create or replace` conserva i privilegi esistenti; ripetuti per chiarezza.
revoke all on function public.rigenera_token_calendario() from public, anon;
grant execute on function public.rigenera_token_calendario() to authenticated;
