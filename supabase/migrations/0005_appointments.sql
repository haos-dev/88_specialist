create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  client_id uuid references public.clients (id) on delete set null,
  title text not null check (length(btrim(title)) > 0),
  appointment_date date not null,
  start_time time not null,
  duration_minutes integer not null default 60 check (duration_minutes between 15 and 480),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists appointments_owner_date_idx
  on public.appointments (owner_id, appointment_date, start_time);

alter table public.appointments enable row level security;

drop policy if exists appointments_proprietario on public.appointments;
create policy appointments_proprietario on public.appointments
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));