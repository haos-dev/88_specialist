-- =============================================================================
-- 0004 — Funzioni chiamate dall'app via `supabase.rpc(...)`
--
-- Tutte `security invoker` (il default): girano con i permessi di chi chiama,
-- quindi le policy RLS di 0002 continuano ad applicarsi. Non sono una
-- scorciatoia attorno alla sicurezza, sono una scorciatoia attorno alla
-- latenza e alla mancanza di transazioni lato client.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- [B1] rinnova_scheda
--
-- PRD §3.3: "Rinnova scheda: duplica con nuove date". Duplicare significa
-- copiare anche i giorni e gli esercizi dentro ai giorni — una scheda
-- rinnovata vuota non serve a nessuno.
--
-- Fatto dal client sarebbero almeno tre round-trip non transazionali: se il
-- secondo fallisce resta una scheda a metà nel database. Qui è una
-- transazione sola.
--
-- Non archivia l'originale: Rinnova e Archivia sono azioni indipendenti
-- (PRD §3.3), e ritrovarsi due schede attive è il comportamento voluto.
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
  -- La select passa da RLS: se la scheda non è dell'utente, non la trova.
  select * into v_originale
    from public.workout_plans
   where id = p_plan_id;

  if not found then
    raise exception 'Scheda non trovata' using errcode = 'no_data_found';
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

-- -----------------------------------------------------------------------------
-- [B2] riordina_giorni / riordina_esercizi
--
-- Dopo un drag&drop vanno riscritte le posizioni dei fratelli che si sono
-- spostati. L'app manda solo quelli cambiati, in due array paralleli, e qui
-- diventano un unico UPDATE ... FROM: una chiamata, una transazione, invece di
-- N update indipendenti che possono riuscire a metà e lasciare un ordine
-- incoerente.
--
-- `p_plan_id` / `p_day_id` non servirebbero a fare l'update, ma vincolano
-- l'operazione a un solo contenitore: senza, un id sbagliato riordinerebbe il
-- giorno di un'altra scheda.
-- -----------------------------------------------------------------------------
create or replace function public.riordina_giorni(
  p_plan_id    uuid,
  p_ids        uuid[],
  p_posizioni  integer[]
)
returns void
language plpgsql
as $$
begin
  if array_length(p_ids, 1) is distinct from array_length(p_posizioni, 1) then
    raise exception 'ids e posizioni hanno lunghezze diverse' using errcode = 'data_exception';
  end if;

  update public.workout_days d
     set day_order = nuovo.posizione
    from unnest(p_ids, p_posizioni) as nuovo(id, posizione)
   where d.id = nuovo.id
     and d.plan_id = p_plan_id;
end;
$$;

create or replace function public.riordina_esercizi(
  p_day_id     uuid,
  p_ids        uuid[],
  p_posizioni  integer[]
)
returns void
language plpgsql
as $$
begin
  if array_length(p_ids, 1) is distinct from array_length(p_posizioni, 1) then
    raise exception 'ids e posizioni hanno lunghezze diverse' using errcode = 'data_exception';
  end if;

  -- PRD §3.3: si riordina solo dentro il proprio giorno. Il vincolo su
  -- `day_id` rende impossibile spostare una riga in un altro giorno da qui.
  update public.workout_day_exercises r
     set order_index = nuovo.posizione
    from unnest(p_ids, p_posizioni) as nuovo(id, posizione)
   where r.id = nuovo.id
     and r.day_id = p_day_id;
end;
$$;

-- Le funzioni sono chiamabili solo da chi ha fatto login; RLS fa il resto.
revoke all on function public.rinnova_scheda(uuid, text, date, date) from public, anon;
revoke all on function public.riordina_giorni(uuid, uuid[], integer[]) from public, anon;
revoke all on function public.riordina_esercizi(uuid, uuid[], integer[]) from public, anon;

grant execute on function public.rinnova_scheda(uuid, text, date, date) to authenticated;
grant execute on function public.riordina_giorni(uuid, uuid[], integer[]) to authenticated;
grant execute on function public.riordina_esercizi(uuid, uuid[], integer[]) to authenticated;
