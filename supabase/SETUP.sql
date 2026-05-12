-- ═══════════════════════════════════════════════════════════════════════════
-- AgencyFlow — Complete Database Setup
-- Paste the ENTIRE file into Supabase → SQL Editor and click RUN.
-- Safe to run multiple times.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ── Core tables (create if missing) ──────────────────────────────────────

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  role text not null default 'user',
  department text,
  department_id text,
  job_title text,
  skills text[] not null default '{}',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clients (
  id text primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  brand text,
  industry text,
  primary_contact jsonb not null default '{}'::jsonb,
  status text not null default 'Active',
  health_score integer not null default 70,
  notes text,
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id text primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  client_id text references public.clients(id) on delete set null,
  description text,
  stage text not null default 'Brief',
  priority text not null default 'Medium',
  assigned_to jsonb not null default '{}'::jsonb,
  start_date date,
  due_date date,
  status text not null default 'Active',
  progress integer not null default 0,
  kpi_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id text primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  project_id text references public.projects(id) on delete cascade,
  description text,
  assigned_to jsonb not null default '{}'::jsonb,
  status text not null default 'To Do',
  priority text not null default 'Medium',
  due_date date,
  estimated_hours numeric not null default 0,
  actual_hours numeric not null default 0,
  dependency_type text,
  depends_on text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.kpis (
  id text primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  project_id text references public.projects(id) on delete cascade,
  client_name text,
  category text,
  target_value numeric not null default 0,
  current_value numeric not null default 0,
  unit text,
  status text not null default 'Not Started',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.departments (
  id text primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  colour text,
  description text,
  lead text,
  members text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pitches (
  id text primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  prospect_company text,
  contact_name text,
  contact_email text,
  industry text,
  stage text not null default 'Lead',
  estimated_value numeric not null default 0,
  currency text not null default 'USD',
  win_probability integer not null default 50,
  pitch_type text,
  owner text,
  decision_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activities (
  id text primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type text not null,
  description text not null,
  user_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.white_label_settings (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  agency_name text not null default 'AgencyFlow',
  tagline text not null default 'Your Agency, Delivered.',
  primary_colour text not null default '#7C3AED',
  accent_colour text not null default '#A78BFA',
  dark_sidebar boolean not null default true,
  hide_attribution boolean not null default false,
  updated_at timestamptz not null default now()
);

-- ── Agencies table ────────────────────────────────────────────────────────

create table if not exists public.agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  owner_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Add agency_id columns ─────────────────────────────────────────────────

alter table public.profiles    add column if not exists agency_id uuid references public.agencies(id) on delete set null;
alter table public.clients     add column if not exists agency_id uuid references public.agencies(id) on delete cascade;
alter table public.projects    add column if not exists agency_id uuid references public.agencies(id) on delete cascade;
alter table public.tasks       add column if not exists agency_id uuid references public.agencies(id) on delete cascade;
alter table public.kpis        add column if not exists agency_id uuid references public.agencies(id) on delete cascade;
alter table public.departments add column if not exists agency_id uuid references public.agencies(id) on delete cascade;
alter table public.pitches     add column if not exists agency_id uuid references public.agencies(id) on delete cascade;
alter table public.activities  add column if not exists agency_id uuid references public.agencies(id) on delete cascade;

-- ── Triggers ─────────────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

do $$
declare t text;
begin
  foreach t in array array['profiles','clients','projects','tasks','kpis','departments','pitches','agencies'] loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', t, t);
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end; $$;

-- ── Auto-create profile + white_label_settings on sign-up ────────────────

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, email, role, department, department_id, job_title, skills, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'admin'),
    coalesce(new.raw_user_meta_data->>'department', 'Leadership'),
    coalesce(new.raw_user_meta_data->>'department_id', 'd1'),
    coalesce(new.raw_user_meta_data->>'job_title', 'Account Owner'),
    array(select jsonb_array_elements_text(coalesce(new.raw_user_meta_data->'skills', '["Client Services"]'::jsonb))),
    new.raw_user_meta_data->>'avatar_url'
  ) on conflict (id) do nothing;

  insert into public.white_label_settings (owner_id)
  values (new.id) on conflict (owner_id) do nothing;

  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Helper: returns calling user's agency_id ─────────────────────────────

create or replace function public.my_agency_id()
returns uuid language sql stable security definer set search_path = public as $$
  select agency_id from public.profiles where id = auth.uid()
$$;

-- ── RPC: create agency + claim all existing records ───────────────────────

create or replace function public.create_agency(p_name text, p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_uid uuid := auth.uid();
begin
  if exists (select 1 from agencies where code = upper(p_code)) then
    raise exception 'Agency code already in use.';
  end if;

  insert into agencies (name, code, owner_id) values (p_name, upper(p_code), v_uid) returning id into v_id;

  update profiles    set agency_id = v_id where id = v_uid;
  update clients     set agency_id = v_id where owner_id = v_uid and agency_id is null;
  update projects    set agency_id = v_id where owner_id = v_uid and agency_id is null;
  update tasks       set agency_id = v_id where owner_id = v_uid and agency_id is null;
  update kpis        set agency_id = v_id where owner_id = v_uid and agency_id is null;
  update departments set agency_id = v_id where owner_id = v_uid and agency_id is null;
  update pitches     set agency_id = v_id where owner_id = v_uid and agency_id is null;

  return v_id;
end; $$;

-- ── RPC: join agency + claim all existing records ─────────────────────────

create or replace function public.join_agency(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_uid uuid := auth.uid();
begin
  select id into v_id from agencies where code = upper(p_code);
  if v_id is null then raise exception 'Agency code not found.'; end if;

  update profiles    set agency_id = v_id where id = v_uid;
  update clients     set agency_id = v_id where owner_id = v_uid and agency_id is null;
  update projects    set agency_id = v_id where owner_id = v_uid and agency_id is null;
  update tasks       set agency_id = v_id where owner_id = v_uid and agency_id is null;
  update kpis        set agency_id = v_id where owner_id = v_uid and agency_id is null;
  update departments set agency_id = v_id where owner_id = v_uid and agency_id is null;
  update pitches     set agency_id = v_id where owner_id = v_uid and agency_id is null;

  return v_id;
end; $$;

-- ── Enable RLS on all tables ──────────────────────────────────────────────

alter table public.profiles            enable row level security;
alter table public.clients             enable row level security;
alter table public.projects            enable row level security;
alter table public.tasks               enable row level security;
alter table public.kpis                enable row level security;
alter table public.departments         enable row level security;
alter table public.pitches             enable row level security;
alter table public.activities          enable row level security;
alter table public.white_label_settings enable row level security;
alter table public.agencies            enable row level security;

-- ── RLS: agencies ─────────────────────────────────────────────────────────

drop policy if exists "Agency members can read their agency" on public.agencies;
drop policy if exists "Users can create an agency"           on public.agencies;
drop policy if exists "Agency owner can update their agency" on public.agencies;

create policy "Agency members can read their agency" on public.agencies
  for select using (id = my_agency_id());
create policy "Users can create an agency" on public.agencies
  for insert with check (owner_id = auth.uid());
create policy "Agency owner can update their agency" on public.agencies
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ── RLS: profiles ─────────────────────────────────────────────────────────

drop policy if exists "Users can read their profile"      on public.profiles;
drop policy if exists "Agency members can read profiles"  on public.profiles;
drop policy if exists "Users can insert their profile"    on public.profiles;
drop policy if exists "Users can update their profile"    on public.profiles;

create policy "Agency members can read profiles" on public.profiles
  for select using (id = auth.uid() or agency_id = my_agency_id());
create policy "Users can insert their profile" on public.profiles
  for insert with check (auth.uid() = id);
create policy "Users can update their profile" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- ── RLS: data tables (full agency-wide access) ───────────────────────────

drop policy if exists "Users can manage their clients"      on public.clients;
drop policy if exists "Agency members can manage clients"   on public.clients;
create policy "Agency members can manage clients" on public.clients
  for all using (agency_id = my_agency_id()) with check (agency_id = my_agency_id());

drop policy if exists "Users can manage their projects"     on public.projects;
drop policy if exists "Agency members can manage projects"  on public.projects;
create policy "Agency members can manage projects" on public.projects
  for all using (agency_id = my_agency_id()) with check (agency_id = my_agency_id());

drop policy if exists "Users can manage their tasks"        on public.tasks;
drop policy if exists "Agency members can manage tasks"     on public.tasks;
create policy "Agency members can manage tasks" on public.tasks
  for all using (agency_id = my_agency_id()) with check (agency_id = my_agency_id());

drop policy if exists "Users can manage their kpis"         on public.kpis;
drop policy if exists "Agency members can manage kpis"      on public.kpis;
create policy "Agency members can manage kpis" on public.kpis
  for all using (agency_id = my_agency_id()) with check (agency_id = my_agency_id());

drop policy if exists "Users can manage their departments"  on public.departments;
drop policy if exists "Agency members can manage departments" on public.departments;
create policy "Agency members can manage departments" on public.departments
  for all using (agency_id = my_agency_id()) with check (agency_id = my_agency_id());

drop policy if exists "Users can manage their pitches"      on public.pitches;
drop policy if exists "Agency members can manage pitches"   on public.pitches;
create policy "Agency members can manage pitches" on public.pitches
  for all using (agency_id = my_agency_id()) with check (agency_id = my_agency_id());

drop policy if exists "Users can manage their activities"   on public.activities;
drop policy if exists "Agency members can manage activities" on public.activities;
create policy "Agency members can manage activities" on public.activities
  for all using (agency_id = my_agency_id()) with check (agency_id = my_agency_id());

drop policy if exists "Users can manage their white label settings" on public.white_label_settings;
create policy "Users can manage their white label settings" on public.white_label_settings
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ── Backfill: assign agency_id to any records that are missing it ─────────

update public.clients c     set agency_id = p.agency_id from public.profiles p where c.owner_id  = p.id and c.agency_id  is null and p.agency_id is not null;
update public.projects pr   set agency_id = p.agency_id from public.profiles p where pr.owner_id = p.id and pr.agency_id is null and p.agency_id is not null;
update public.tasks t       set agency_id = p.agency_id from public.profiles p where t.owner_id  = p.id and t.agency_id  is null and p.agency_id is not null;
update public.kpis k        set agency_id = p.agency_id from public.profiles p where k.owner_id  = p.id and k.agency_id  is null and p.agency_id is not null;
update public.departments d set agency_id = p.agency_id from public.profiles p where d.owner_id  = p.id and d.agency_id  is null and p.agency_id is not null;
update public.pitches pi    set agency_id = p.agency_id from public.profiles p where pi.owner_id = p.id and pi.agency_id is null and p.agency_id is not null;

-- ── Diagnostic: run this to confirm the setup ─────────────────────────────
select 'agencies'               as label, count(*)::text as count from public.agencies
union all
select 'profiles with agency_id',          count(*)::text from public.profiles    where agency_id is not null
union all
select 'projects with agency_id',          count(*)::text from public.projects    where agency_id is not null
union all
select 'projects WITHOUT agency_id',       count(*)::text from public.projects    where agency_id is null
union all
select 'clients with agency_id',           count(*)::text from public.clients     where agency_id is not null
union all
select 'clients WITHOUT agency_id',        count(*)::text from public.clients     where agency_id is null;
