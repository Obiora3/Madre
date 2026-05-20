create table if not exists public.events (
  id text primary key,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  user_name text not null default '',
  event_type text not null,
  entity_type text not null,
  entity_id text,
  entity_title text,
  created_at timestamptz not null default now()
);

create index if not exists events_agency_created on public.events (agency_id, created_at desc);

alter table public.events enable row level security;

create policy "Agency members can manage events"
  on public.events for all
  using (agency_id = (select agency_id from public.profiles where id = auth.uid()))
  with check (agency_id = (select agency_id from public.profiles where id = auth.uid()));
