-- ── agencies ────────────────────────────────────────────────────────────────
create table if not exists public.agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  owner_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_agencies_updated_at on public.agencies;
create trigger set_agencies_updated_at
  before update on public.agencies
  for each row execute function public.set_updated_at();

-- ── helper: returns the calling user's agency_id ─────────────────────────────
create or replace function public.my_agency_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select agency_id from public.profiles where id = auth.uid()
$$;

-- ── add agency_id to profiles and all data tables ────────────────────────────
alter table public.profiles   add column if not exists agency_id uuid references public.agencies(id) on delete set null;
alter table public.clients    add column if not exists agency_id uuid references public.agencies(id) on delete cascade;
alter table public.projects   add column if not exists agency_id uuid references public.agencies(id) on delete cascade;
alter table public.tasks      add column if not exists agency_id uuid references public.agencies(id) on delete cascade;
alter table public.kpis       add column if not exists agency_id uuid references public.agencies(id) on delete cascade;
alter table public.departments add column if not exists agency_id uuid references public.agencies(id) on delete cascade;
alter table public.pitches    add column if not exists agency_id uuid references public.agencies(id) on delete cascade;
alter table public.activities add column if not exists agency_id uuid references public.agencies(id) on delete cascade;

-- ── RPC: create a new agency and link the calling user ───────────────────────
create or replace function public.create_agency(p_name text, p_code text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_agency_id uuid;
begin
  if exists (select 1 from agencies where code = upper(p_code)) then
    raise exception 'Agency code already in use. Please try a different code.';
  end if;

  insert into agencies (name, code, owner_id)
  values (p_name, upper(p_code), auth.uid())
  returning id into v_agency_id;

  update profiles set agency_id = v_agency_id where id = auth.uid();

  return v_agency_id;
end;
$$;

-- ── RPC: join an existing agency by code ─────────────────────────────────────
create or replace function public.join_agency(p_code text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_agency_id uuid;
begin
  select id into v_agency_id from agencies where code = upper(p_code);

  if v_agency_id is null then
    raise exception 'Agency code not found. Please check the code and try again.';
  end if;

  update profiles set agency_id = v_agency_id where id = auth.uid();

  return v_agency_id;
end;
$$;

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.agencies enable row level security;

drop policy if exists "Agency members can read their agency" on public.agencies;
create policy "Agency members can read their agency" on public.agencies
  for select using (id = my_agency_id());

drop policy if exists "Users can create an agency" on public.agencies;
create policy "Users can create an agency" on public.agencies
  for insert with check (owner_id = auth.uid());

drop policy if exists "Agency owner can update their agency" on public.agencies;
create policy "Agency owner can update their agency" on public.agencies
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- profiles: allow reading all members of the same agency
drop policy if exists "Users can read their profile" on public.profiles;
drop policy if exists "Agency members can read profiles" on public.profiles;
create policy "Agency members can read profiles" on public.profiles
  for select using (id = auth.uid() or agency_id = my_agency_id());

-- data tables: switch from per-user to per-agency access
drop policy if exists "Users can manage their clients" on public.clients;
create policy "Agency members can manage clients" on public.clients
  for all using (agency_id = my_agency_id()) with check (agency_id = my_agency_id());

drop policy if exists "Users can manage their projects" on public.projects;
create policy "Agency members can manage projects" on public.projects
  for all using (agency_id = my_agency_id()) with check (agency_id = my_agency_id());

drop policy if exists "Users can manage their tasks" on public.tasks;
create policy "Agency members can manage tasks" on public.tasks
  for all using (agency_id = my_agency_id()) with check (agency_id = my_agency_id());

drop policy if exists "Users can manage their kpis" on public.kpis;
create policy "Agency members can manage kpis" on public.kpis
  for all using (agency_id = my_agency_id()) with check (agency_id = my_agency_id());

drop policy if exists "Users can manage their departments" on public.departments;
create policy "Agency members can manage departments" on public.departments
  for all using (agency_id = my_agency_id()) with check (agency_id = my_agency_id());

drop policy if exists "Users can manage their pitches" on public.pitches;
create policy "Agency members can manage pitches" on public.pitches
  for all using (agency_id = my_agency_id()) with check (agency_id = my_agency_id());

drop policy if exists "Users can manage their activities" on public.activities;
create policy "Agency members can manage activities" on public.activities
  for all using (agency_id = my_agency_id()) with check (agency_id = my_agency_id());
