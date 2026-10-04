-- Replace every future appointment linked to a client when their weekly
-- training preferences are saved. History in the past is preserved.
alter table public.clients
  add column training_days jsonb,
  add column training_until date;

create or replace function public.sostituisci_lezioni_cliente(
  p_client_id uuid,
  p_lezioni jsonb,
  p_training_days jsonb,
  p_training_until date
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if jsonb_typeof(p_lezioni) is distinct from 'array' then
    raise exception 'p_lezioni deve essere un array' using errcode = 'invalid_parameter_value';
  end if;
  if jsonb_array_length(p_lezioni) > 400 then
    raise exception 'Troppe lezioni in un colpo solo' using errcode = 'check_violation';
  end if;

  if p_training_days is not null and jsonb_typeof(p_training_days) is distinct from 'array' then
    raise exception 'p_training_days deve essere un array o null' using errcode = 'invalid_parameter_value';
  end if;

  update public.clients
     set training_days = p_training_days,
         training_until = p_training_until
   where id = p_client_id;
  if not found then
    raise exception 'Cliente non trovato' using errcode = 'no_data_found';
  end if;

  -- RLS also applies here (security invoker): a client outside the caller's
  -- scope cannot have its appointments replaced.
  delete from public.appointments
   where client_id = p_client_id
     and (appointment_date + start_time) > (now() at time zone 'Europe/Rome');

  insert into public.appointments
    (client_id, title, appointment_date, start_time, duration_minutes, notes)
  select p_client_id,
         l.title,
         l.appointment_date,
         l.start_time,
         coalesce(l.duration_minutes, 60),
         l.notes
    from jsonb_to_recordset(p_lezioni) as l(
      title text,
      appointment_date date,
      start_time time,
      duration_minutes integer,
      notes text
    );
end;
$$;

revoke all on function public.sostituisci_lezioni_cliente(uuid, jsonb, jsonb, date) from public, anon;
grant execute on function public.sostituisci_lezioni_cliente(uuid, jsonb, jsonb, date) to authenticated;
