-- Harden workspace roles, add persisted comments, and make project deletion non-destructive.

-- Comments are used by the app but were missing from the database schema.
create table if not exists public.comments (
  id text primary key,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  entity_type text not null check (entity_type in ('project', 'task')),
  entity_id text not null,
  user_id text,
  user_name text not null default '',
  user_email text,
  body text not null check (char_length(body) <= 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.comments
  add column if not exists agency_id uuid references public.agencies(id) on delete cascade,
  add column if not exists entity_type text,
  add column if not exists entity_id text,
  add column if not exists user_id text,
  add column if not exists user_name text not null default '',
  add column if not exists user_email text,
  add column if not exists body text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists comments_agency_entity_created
  on public.comments (agency_id, entity_type, entity_id, created_at);

drop trigger if exists set_comments_updated_at on public.comments;
create trigger set_comments_updated_at
  before update on public.comments
  for each row execute function public.set_updated_at();

alter table public.comments enable row level security;

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

create index if not exists events_agency_created
  on public.events (agency_id, created_at desc);

alter table public.events enable row level security;

-- Project children should match the product copy: keep tasks/KPIs and clear the link.
alter table public.tasks drop constraint if exists tasks_project_id_fkey;
alter table public.tasks
  add constraint tasks_project_id_fkey
  foreign key (project_id) references public.projects(id) on delete set null;

alter table public.kpis drop constraint if exists kpis_project_id_fkey;
alter table public.kpis
  add constraint kpis_project_id_fkey
  foreign key (project_id) references public.projects(id) on delete set null;

-- Role helpers used by RLS. SECURITY DEFINER avoids policy recursion on profiles.
create or replace function public.my_role()
returns text
language sql stable security definer set search_path = public
as $$
  select coalesce(nullif(lower(role), ''), 'member')
  from public.profiles
  where id = auth.uid()
$$;

create or replace function public.has_agency_role(p_roles text[])
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(public.my_role() = any(p_roles), false)
$$;

create or replace function public.can_manage_roles()
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.has_agency_role(array['owner', 'admin'])
$$;

create or replace function public.can_manage_workspace_settings()
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.has_agency_role(array['owner', 'admin'])
$$;

create or replace function public.can_manage_projects()
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.has_agency_role(array['owner', 'admin', 'manager'])
$$;

create or replace function public.can_manage_tasks()
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.has_agency_role(array['owner', 'admin', 'manager', 'member'])
$$;

-- Keep sensitive profile fields out of self-service updates.
create or replace function public.protect_profile_sensitive_fields()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_caller_role text := public.my_role();
  v_owner_count integer;
  v_trusted_rpc boolean := coalesce(current_setting('app.profile_admin_update', true) = 'on', false);
begin
  if new.email is distinct from old.email then
    if not v_trusted_rpc then
      raise exception 'Profile email cannot be changed from this table';
    end if;
  end if;

  if new.agency_id is distinct from old.agency_id then
    if not v_trusted_rpc then
      raise exception 'Profile agency cannot be changed from this table';
    end if;
  end if;

  if new.role is distinct from old.role then
    if not v_trusted_rpc and v_caller_role not in ('owner', 'admin') then
      raise exception 'Only owners and admins can change member roles';
    end if;

    if old.role = 'owner' and new.role <> 'owner' then
      select count(*) into v_owner_count
      from public.profiles
      where agency_id = old.agency_id and role = 'owner';

      if v_owner_count <= 1 then
        raise exception 'Cannot remove the last owner from this agency';
      end if;
    end if;

    if not v_trusted_rpc and (old.role = 'owner' or new.role = 'owner') and v_caller_role <> 'owner' then
      raise exception 'Only owners can assign or remove owner roles';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_profile_sensitive_fields on public.profiles;
create trigger protect_profile_sensitive_fields
  before update on public.profiles
  for each row execute function public.protect_profile_sensitive_fields();

-- Normalize historical roles into the roles the app displays/enforces.
select set_config('app.profile_admin_update', 'on', true);

update public.profiles
set role = 'member'
where role in ('user', '') or role is null;

update public.profiles p
set role = 'owner'
from public.agencies a
where a.owner_id = p.id
  and p.agency_id = a.id
  and p.role in ('admin', 'member');

select set_config('app.profile_admin_update', 'off', true);

-- Agency RPCs must assign durable database roles, not only auth metadata roles.
create or replace function public.create_agency(p_name text, p_code text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_agency_id uuid;
  v_uid uuid := auth.uid();
begin
  if exists (select 1 from public.agencies where code = upper(p_code)) then
    raise exception 'Agency code already in use. Please try a different code.';
  end if;

  insert into public.agencies (name, code, owner_id)
  values (p_name, upper(p_code), v_uid)
  returning id into v_agency_id;

  perform set_config('app.profile_admin_update', 'on', true);

  update public.profiles
  set agency_id = v_agency_id, role = 'owner'
  where id = v_uid;

  update public.clients     set agency_id = v_agency_id where owner_id = v_uid and agency_id is null;
  update public.projects    set agency_id = v_agency_id where owner_id = v_uid and agency_id is null;
  update public.tasks       set agency_id = v_agency_id where owner_id = v_uid and agency_id is null;
  update public.kpis        set agency_id = v_agency_id where owner_id = v_uid and agency_id is null;
  update public.departments set agency_id = v_agency_id where owner_id = v_uid and agency_id is null;
  update public.pitches     set agency_id = v_agency_id where owner_id = v_uid and agency_id is null;

  return v_agency_id;
end;
$$;

create or replace function public.join_agency(p_code text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_agency_id uuid;
  v_uid uuid := auth.uid();
begin
  select id into v_agency_id from public.agencies where code = upper(p_code);

  if v_agency_id is null then
    raise exception 'Agency code not found. Please check the code and try again.';
  end if;

  perform set_config('app.profile_admin_update', 'on', true);

  update public.profiles
  set agency_id = v_agency_id, role = 'member'
  where id = v_uid;

  update public.clients     set agency_id = v_agency_id where owner_id = v_uid and agency_id is null;
  update public.projects    set agency_id = v_agency_id where owner_id = v_uid and agency_id is null;
  update public.tasks       set agency_id = v_agency_id where owner_id = v_uid and agency_id is null;
  update public.kpis        set agency_id = v_agency_id where owner_id = v_uid and agency_id is null;
  update public.departments set agency_id = v_agency_id where owner_id = v_uid and agency_id is null;
  update public.pitches     set agency_id = v_agency_id where owner_id = v_uid and agency_id is null;

  return v_agency_id;
end;
$$;

create or replace function public.update_member_role(p_user_id uuid, p_role text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_agency_id uuid;
  v_caller_role text;
  v_target_role text;
  v_owner_count integer;
  v_next_role text := lower(trim(p_role));
begin
  if v_next_role is null or v_next_role not in ('owner', 'admin', 'manager', 'member', 'viewer') then
    raise exception 'Invalid role: %', p_role;
  end if;

  select agency_id, role into v_agency_id, v_caller_role
  from public.profiles
  where id = auth.uid();

  if v_agency_id is null or v_caller_role not in ('owner', 'admin') then
    raise exception 'Only owners and admins can change member roles';
  end if;

  select role into v_target_role
  from public.profiles
  where id = p_user_id and agency_id = v_agency_id;

  if v_target_role is null then
    raise exception 'Not authorized: member is not in your agency';
  end if;

  if (v_target_role = 'owner' or v_next_role = 'owner') and v_caller_role <> 'owner' then
    raise exception 'Only owners can assign or remove owner roles';
  end if;

  if v_target_role = 'owner' and v_next_role <> 'owner' then
    select count(*) into v_owner_count
    from public.profiles
    where agency_id = v_agency_id and role = 'owner';

    if v_owner_count <= 1 then
      raise exception 'Cannot remove the last owner from this agency';
    end if;
  end if;

  perform set_config('app.profile_admin_update', 'on', true);

  update public.profiles
  set role = v_next_role
  where id = p_user_id and agency_id = v_agency_id;
end;
$$;

grant execute on function public.update_member_role(uuid, text) to authenticated;
grant execute on function public.my_role() to authenticated;
grant execute on function public.has_agency_role(text[]) to authenticated;
grant execute on function public.can_manage_roles() to authenticated;
grant execute on function public.can_manage_workspace_settings() to authenticated;
grant execute on function public.can_manage_projects() to authenticated;
grant execute on function public.can_manage_tasks() to authenticated;

-- Replace broad "all agency members can manage everything" policies with role-aware policies.
drop policy if exists "Users can update their profile" on public.profiles;
drop policy if exists "Users can insert their profile" on public.profiles;
drop policy if exists "Users can read their profile" on public.profiles;
drop policy if exists "Agency members can read profiles" on public.profiles;

create policy "Agency members can read profiles" on public.profiles
  for select using (id = auth.uid() or agency_id = public.my_agency_id());

create policy "Users can insert their profile" on public.profiles
  for insert with check (auth.uid() = id);

create policy "Users can update editable profile fields" on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Agency members can manage clients" on public.clients;
drop policy if exists "Users can manage their clients" on public.clients;
drop policy if exists "Agency members can read clients" on public.clients;
drop policy if exists "Managers can insert clients" on public.clients;
drop policy if exists "Managers can update clients" on public.clients;
drop policy if exists "Managers can delete clients" on public.clients;
create policy "Agency members can read clients" on public.clients
  for select using (agency_id = public.my_agency_id());
create policy "Managers can insert clients" on public.clients
  for insert with check (agency_id = public.my_agency_id() and public.can_manage_projects());
create policy "Managers can update clients" on public.clients
  for update using (agency_id = public.my_agency_id() and public.can_manage_projects())
  with check (agency_id = public.my_agency_id() and public.can_manage_projects());
create policy "Managers can delete clients" on public.clients
  for delete using (agency_id = public.my_agency_id() and public.can_manage_projects());

drop policy if exists "Agency members can manage projects" on public.projects;
drop policy if exists "Users can manage their projects" on public.projects;
drop policy if exists "Agency members can read projects" on public.projects;
drop policy if exists "Managers can insert projects" on public.projects;
drop policy if exists "Managers can update projects" on public.projects;
drop policy if exists "Managers can delete projects" on public.projects;
create policy "Agency members can read projects" on public.projects
  for select using (agency_id = public.my_agency_id());
create policy "Managers can insert projects" on public.projects
  for insert with check (agency_id = public.my_agency_id() and public.can_manage_projects());
create policy "Managers can update projects" on public.projects
  for update using (agency_id = public.my_agency_id() and public.can_manage_projects())
  with check (agency_id = public.my_agency_id() and public.can_manage_projects());
create policy "Managers can delete projects" on public.projects
  for delete using (agency_id = public.my_agency_id() and public.can_manage_projects());

drop policy if exists "Agency members can manage tasks" on public.tasks;
drop policy if exists "Users can manage their tasks" on public.tasks;
drop policy if exists "Agency members can read tasks" on public.tasks;
drop policy if exists "Task contributors can insert tasks" on public.tasks;
drop policy if exists "Task contributors can update tasks" on public.tasks;
drop policy if exists "Managers can delete tasks" on public.tasks;
create policy "Agency members can read tasks" on public.tasks
  for select using (agency_id = public.my_agency_id());
create policy "Task contributors can insert tasks" on public.tasks
  for insert with check (agency_id = public.my_agency_id() and public.can_manage_tasks());
create policy "Task contributors can update tasks" on public.tasks
  for update using (agency_id = public.my_agency_id() and public.can_manage_tasks())
  with check (agency_id = public.my_agency_id() and public.can_manage_tasks());
create policy "Managers can delete tasks" on public.tasks
  for delete using (agency_id = public.my_agency_id() and public.can_manage_projects());

drop policy if exists "Agency members can manage kpis" on public.kpis;
drop policy if exists "Users can manage their kpis" on public.kpis;
drop policy if exists "Agency members can read kpis" on public.kpis;
drop policy if exists "Managers can insert kpis" on public.kpis;
drop policy if exists "Managers can update kpis" on public.kpis;
drop policy if exists "Managers can delete kpis" on public.kpis;
create policy "Agency members can read kpis" on public.kpis
  for select using (agency_id = public.my_agency_id());
create policy "Managers can insert kpis" on public.kpis
  for insert with check (agency_id = public.my_agency_id() and public.can_manage_projects());
create policy "Managers can update kpis" on public.kpis
  for update using (agency_id = public.my_agency_id() and public.can_manage_projects())
  with check (agency_id = public.my_agency_id() and public.can_manage_projects());
create policy "Managers can delete kpis" on public.kpis
  for delete using (agency_id = public.my_agency_id() and public.can_manage_projects());

drop policy if exists "Agency members can manage departments" on public.departments;
drop policy if exists "Users can manage their departments" on public.departments;
drop policy if exists "Agency members can read departments" on public.departments;
drop policy if exists "Admins can insert departments" on public.departments;
drop policy if exists "Admins can update departments" on public.departments;
drop policy if exists "Admins can delete departments" on public.departments;
create policy "Agency members can read departments" on public.departments
  for select using (agency_id = public.my_agency_id());
create policy "Admins can insert departments" on public.departments
  for insert with check (agency_id = public.my_agency_id() and public.can_manage_workspace_settings());
create policy "Admins can update departments" on public.departments
  for update using (agency_id = public.my_agency_id() and public.can_manage_workspace_settings())
  with check (agency_id = public.my_agency_id() and public.can_manage_workspace_settings());
create policy "Admins can delete departments" on public.departments
  for delete using (agency_id = public.my_agency_id() and public.can_manage_workspace_settings());

drop policy if exists "Agency members can manage pitches" on public.pitches;
drop policy if exists "Users can manage their pitches" on public.pitches;
drop policy if exists "Agency members can read pitches" on public.pitches;
drop policy if exists "Managers can insert pitches" on public.pitches;
drop policy if exists "Managers can update pitches" on public.pitches;
drop policy if exists "Managers can delete pitches" on public.pitches;
create policy "Agency members can read pitches" on public.pitches
  for select using (agency_id = public.my_agency_id());
create policy "Managers can insert pitches" on public.pitches
  for insert with check (agency_id = public.my_agency_id() and public.can_manage_projects());
create policy "Managers can update pitches" on public.pitches
  for update using (agency_id = public.my_agency_id() and public.can_manage_projects())
  with check (agency_id = public.my_agency_id() and public.can_manage_projects());
create policy "Managers can delete pitches" on public.pitches
  for delete using (agency_id = public.my_agency_id() and public.can_manage_projects());

drop policy if exists "Agency members can manage activities" on public.activities;
drop policy if exists "Users can manage their activities" on public.activities;
drop policy if exists "Agency members can read activities" on public.activities;
drop policy if exists "Workspace contributors can insert activities" on public.activities;
drop policy if exists "Admins can delete activities" on public.activities;
create policy "Agency members can read activities" on public.activities
  for select using (agency_id = public.my_agency_id());
create policy "Workspace contributors can insert activities" on public.activities
  for insert with check (agency_id = public.my_agency_id() and public.can_manage_tasks());
create policy "Admins can delete activities" on public.activities
  for delete using (agency_id = public.my_agency_id() and public.can_manage_workspace_settings());

drop policy if exists "Agency members can manage comments" on public.comments;
drop policy if exists "Agency members can read comments" on public.comments;
drop policy if exists "Comment contributors can insert comments" on public.comments;
drop policy if exists "Authors and managers can update comments" on public.comments;
drop policy if exists "Authors and managers can delete comments" on public.comments;
create policy "Agency members can read comments" on public.comments
  for select using (agency_id = public.my_agency_id());
create policy "Comment contributors can insert comments" on public.comments
  for insert with check (agency_id = public.my_agency_id() and public.can_manage_tasks());
create policy "Authors and managers can update comments" on public.comments
  for update using (
    agency_id = public.my_agency_id()
    and (user_id::text = auth.uid()::text or public.can_manage_projects())
  )
  with check (
    agency_id = public.my_agency_id()
    and (user_id::text = auth.uid()::text or public.can_manage_projects())
  );
create policy "Authors and managers can delete comments" on public.comments
  for delete using (
    agency_id = public.my_agency_id()
    and (user_id::text = auth.uid()::text or public.can_manage_projects())
  );

drop policy if exists "Agency members can manage events" on public.events;
drop policy if exists "Agency members can read events" on public.events;
drop policy if exists "Workspace contributors can insert events" on public.events;
drop policy if exists "Admins can delete events" on public.events;
create policy "Agency members can read events" on public.events
  for select using (agency_id = public.my_agency_id());
create policy "Workspace contributors can insert events" on public.events
  for insert with check (agency_id = public.my_agency_id() and public.can_manage_tasks());
create policy "Admins can delete events" on public.events
  for delete using (agency_id = public.my_agency_id() and public.can_manage_workspace_settings());
