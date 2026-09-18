-- Feed iCalendar (.ics) di sola lettura per iscrizione da Apple/Google/Outlook
-- Calendar. Non richiede login interattivo (quei client non sanno fare OAuth
-- per una sottoscrizione): l'autenticazione è il token stesso nell'URL, quindi
-- va trattato come un segreto rigenerabile, non come l'anon key (pubblica per
-- definizione) o la password del trainer.

alter table public.trainer_settings
  add column if not exists calendar_feed_token text unique
    default encode(gen_random_bytes(24), 'hex');

-- Backfill per righe già esistenti create prima di questa colonna (idempotente:
-- innocuo se eseguito su un database dove trainer_settings è ancora vuota).
update public.trainer_settings
set calendar_feed_token = encode(gen_random_bytes(24), 'hex')
where calendar_feed_token is null;

-- security invoker: gira con i permessi di chi chiama, non un privilegio
-- elevato fisso — auth.uid() nel where/insert è quindi sempre quello del
-- trainer autenticato che ha premuto "Rigenera", mai altri.
create or replace function public.rigenera_token_calendario()
returns text
language plpgsql
security invoker
set search_path = public
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

-- Stessa convenzione di sicurezza di 0004_functions.sql: la funzione è
-- eseguibile solo da chi ha fatto login (auth.uid() altrimenti è null e
-- l'update/insert non troverebbe/creerebbe nulla di sensato).
revoke all on function public.rigenera_token_calendario() from public, anon;
grant execute on function public.rigenera_token_calendario() to authenticated;
