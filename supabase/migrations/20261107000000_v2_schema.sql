-- Madre v2 schema. Intended for a fresh Supabase project.
-- Every row belongs to a workspace; members see only their own workspace.

create extension if not exists "pgcrypto";

-- ── helpers ──────────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── workspaces ───────────────────────────────────────────────────────────────
create table public.workspaces (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  join_code  text not null unique,
  logo_url   text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── members (one row per auth user) ──────────────────────────────────────────
create table public.members (
  id              uuid primary key references auth.users(id) on delete cascade,
  workspace_id    uuid references public.workspaces(id) on delete set null,
  name            text not null,
  email           text not null,
  role            text not null default 'member' check (role in ('admin', 'member')),
  job_title       text,
  avatar_url      text,
  whatsapp        text,
  notify_email    boolean not null default true,
  notify_whatsapp boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index members_workspace_idx on public.members (workspace_id);

-- ── clients ──────────────────────────────────────────────────────────────────
create table public.clients (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  name          text not null,
  contact_name  text,
  contact_email text,
  contact_phone text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index clients_workspace_idx on public.clients (workspace_id);

-- ── projects ─────────────────────────────────────────────────────────────────
create table public.projects (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_id    uuid references public.clients(id) on delete set null,
  owner_id     uuid references public.members(id) on delete set null,
  title        text not null,
  description  text,
  status       text not null default 'active'
               check (status in ('planning', 'active', 'on_hold', 'done')),
  priority     text not null default 'medium'
               check (priority in ('low', 'medium', 'high', 'urgent')),
  start_date   date,
  due_date     date,
  budget       numeric,
  created_by   uuid references public.members(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index projects_workspace_idx on public.projects (workspace_id);

-- ── tasks ────────────────────────────────────────────────────────────────────
create table public.tasks (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id   uuid not null references public.projects(id) on delete cascade,
  assignee_id  uuid references public.members(id) on delete set null,
  title        text not null,
  description  text,
  status       text not null default 'todo'
               check (status in ('todo', 'in_progress', 'review', 'blocked', 'done')),
  priority     text not null default 'medium'
               check (priority in ('low', 'medium', 'high', 'urgent')),
  due_date     date,
  position     double precision not null default 0,
  completed_at timestamptz,
  created_by   uuid references public.members(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index tasks_workspace_idx on public.tasks (workspace_id);
create index tasks_project_idx   on public.tasks (project_id);
create index tasks_assignee_idx  on public.tasks (assignee_id);
create index tasks_due_idx       on public.tasks (due_date) where status <> 'done';

-- ── comments ─────────────────────────────────────────────────────────────────
create table public.comments (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id   uuid not null references public.projects(id) on delete cascade,
  task_id      uuid references public.tasks(id) on delete cascade,
  author_id    uuid references public.members(id) on delete set null,
  body         text not null,
  created_at   timestamptz not null default now()
);
create index comments_project_idx on public.comments (project_id);

-- ── activity (written by triggers; feeds reports and the Home feed) ──────────
create table public.activity (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id   uuid references public.projects(id) on delete cascade,
  task_id      uuid references public.tasks(id) on delete set null,
  actor_id     uuid references public.members(id) on delete set null,
  kind         text not null,
  summary      text not null,
  meta         jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index activity_workspace_idx on public.activity (workspace_id, created_at desc);
create index activity_project_idx   on public.activity (project_id, created_at desc);

-- ── notifications_sent (idempotency log for email/WhatsApp alerts) ───────────
create table public.notifications_sent (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  recipient_id uuid not null references public.members(id) on delete cascade,
  kind         text not null,
  entity_id    uuid not null,
  channel      text not null check (channel in ('email', 'whatsapp')),
  dedupe_key   text not null,
  created_at   timestamptz not null default now(),
  unique (recipient_id, channel, dedupe_key)
);

-- ── updated_at triggers ──────────────────────────────────────────────────────
create trigger set_updated_at before update on public.workspaces for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.members    for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.clients    for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.projects   for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.tasks      for each row execute function public.set_updated_at();

-- ── keep tasks.completed_at in sync with status ──────────────────────────────
create or replace function public.tasks_completed_at()
returns trigger language plpgsql as $$
begin
  if new.status = 'done' and (tg_op = 'INSERT' or old.status <> 'done') then
    new.completed_at = now();
  elsif new.status <> 'done' then
    new.completed_at = null;
  end if;
  return new;
end;
$$;
create trigger tasks_completed_at before insert or update of status on public.tasks
  for each row execute function public.tasks_completed_at();

-- ── new auth user → member row ───────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.members (id, name, email)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'name', ''), split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── access helpers ───────────────────────────────────────────────────────────
create or replace function public.my_workspace_id()
returns uuid language sql stable security definer set search_path = public as $$
  select workspace_id from public.members where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from public.members where id = auth.uid()), false)
$$;

-- ── workspace RPCs ───────────────────────────────────────────────────────────
create or replace function public.create_workspace(p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id   uuid;
  v_code text;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if public.my_workspace_id() is not null then
    raise exception 'You already belong to a workspace';
  end if;

  loop
    v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    exit when not exists (select 1 from workspaces where join_code = v_code);
  end loop;

  insert into workspaces (name, join_code, created_by)
  values (trim(p_name), v_code, auth.uid())
  returning id into v_id;

  update members set workspace_id = v_id, role = 'admin' where id = auth.uid();
  return v_id;
end;
$$;

create or replace function public.join_workspace(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if public.my_workspace_id() is not null then
    raise exception 'You already belong to a workspace';
  end if;

  select id into v_id from workspaces where join_code = upper(trim(p_code));
  if v_id is null then raise exception 'Workspace code not found'; end if;

  update members set workspace_id = v_id, role = 'member' where id = auth.uid();
  return v_id;
end;
$$;

create or replace function public.set_member_role(p_member uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only admins can change roles'; end if;
  if p_role not in ('admin', 'member') then raise exception 'Invalid role'; end if;
  if p_member = auth.uid() and p_role <> 'admin'
     and not exists (select 1 from members where workspace_id = public.my_workspace_id()
                     and role = 'admin' and id <> auth.uid()) then
    raise exception 'A workspace needs at least one admin';
  end if;
  update members set role = p_role
  where id = p_member and workspace_id = public.my_workspace_id();
end;
$$;

create or replace function public.remove_member(p_member uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only admins can remove members'; end if;
  if p_member = auth.uid() then raise exception 'You cannot remove yourself'; end if;
  update members set workspace_id = null, role = 'member'
  where id = p_member and workspace_id = public.my_workspace_id();
end;
$$;

-- Members may edit their own profile but not move workspace or change role.
create or replace function public.members_guard()
returns trigger language plpgsql as $$
begin
  -- Inside the security-definer RPCs current_user is the owner, so they pass.
  if current_user = 'authenticated'
     and (new.workspace_id is distinct from old.workspace_id or new.role is distinct from old.role) then
    raise exception 'Use the workspace functions to change workspace or role';
  end if;
  return new;
end;
$$;
create trigger members_guard before update on public.members
  for each row execute function public.members_guard();

-- ── activity triggers ────────────────────────────────────────────────────────
create or replace function public.log_task_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_kind    text;
  v_summary text;
  v_meta    jsonb := '{}'::jsonb;
begin
  if tg_op = 'INSERT' then
    v_kind := 'task_created';
    v_summary := 'created task "' || new.title || '"';
  elsif new.status is distinct from old.status then
    v_kind := 'task_status';
    v_summary := 'moved "' || new.title || '" to ' || replace(new.status, '_', ' ');
    v_meta := jsonb_build_object('from', old.status, 'to', new.status);
  elsif new.assignee_id is distinct from old.assignee_id then
    v_kind := 'task_assigned';
    v_summary := case when new.assignee_id is null
      then 'unassigned "' || new.title || '"'
      else 'assigned "' || new.title || '" to ' ||
           coalesce((select name from members where id = new.assignee_id), 'someone') end;
    v_meta := jsonb_build_object('from', old.assignee_id, 'to', new.assignee_id);
  elsif new.due_date is distinct from old.due_date then
    v_kind := 'task_due';
    v_summary := 'changed the due date of "' || new.title || '"';
    v_meta := jsonb_build_object('from', old.due_date, 'to', new.due_date);
  else
    return new;
  end if;

  insert into activity (workspace_id, project_id, task_id, actor_id, kind, summary, meta)
  values (new.workspace_id, new.project_id, new.id, auth.uid(), v_kind, v_summary, v_meta);
  return new;
end;
$$;
create trigger log_task_activity after insert or update on public.tasks
  for each row execute function public.log_task_activity();

create or replace function public.log_project_activity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into activity (workspace_id, project_id, actor_id, kind, summary)
    values (new.workspace_id, new.id, auth.uid(), 'project_created', 'created the project');
  elsif new.status is distinct from old.status then
    insert into activity (workspace_id, project_id, actor_id, kind, summary, meta)
    values (new.workspace_id, new.id, auth.uid(), 'project_status',
            'changed project status to ' || replace(new.status, '_', ' '),
            jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  return new;
end;
$$;
create trigger log_project_activity after insert or update on public.projects
  for each row execute function public.log_project_activity();

create or replace function public.log_comment_activity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into activity (workspace_id, project_id, task_id, actor_id, kind, summary)
  values (new.workspace_id, new.project_id, new.task_id, new.author_id, 'comment', 'commented');
  return new;
end;
$$;
create trigger log_comment_activity after insert on public.comments
  for each row execute function public.log_comment_activity();

-- ── row level security ───────────────────────────────────────────────────────
alter table public.workspaces         enable row level security;
alter table public.members            enable row level security;
alter table public.clients            enable row level security;
alter table public.projects           enable row level security;
alter table public.tasks              enable row level security;
alter table public.comments           enable row level security;
alter table public.activity           enable row level security;
alter table public.notifications_sent enable row level security;

create policy "read own workspace" on public.workspaces
  for select using (id = public.my_workspace_id());
create policy "admins update workspace" on public.workspaces
  for update using (id = public.my_workspace_id() and public.is_admin());

create policy "read self and teammates" on public.members
  for select using (id = auth.uid() or workspace_id = public.my_workspace_id());
create policy "update own profile" on public.members
  for update using (id = auth.uid());

-- Shared work data: any workspace member can read and write.
do $$
declare t text;
begin
  foreach t in array array['clients', 'projects', 'tasks'] loop
    execute format('create policy "workspace read"   on public.%I for select using (workspace_id = public.my_workspace_id())', t);
    execute format('create policy "workspace insert" on public.%I for insert with check (workspace_id = public.my_workspace_id())', t);
    execute format('create policy "workspace update" on public.%I for update using (workspace_id = public.my_workspace_id()) with check (workspace_id = public.my_workspace_id())', t);
    execute format('create policy "workspace delete" on public.%I for delete using (workspace_id = public.my_workspace_id())', t);
  end loop;
end $$;

create policy "workspace read" on public.comments
  for select using (workspace_id = public.my_workspace_id());
create policy "post as self" on public.comments
  for insert with check (workspace_id = public.my_workspace_id() and author_id = auth.uid());
create policy "edit own" on public.comments
  for update using (author_id = auth.uid());
create policy "delete own or admin" on public.comments
  for delete using (workspace_id = public.my_workspace_id() and (author_id = auth.uid() or public.is_admin()));

create policy "workspace read" on public.activity
  for select using (workspace_id = public.my_workspace_id());

-- notifications_sent is written only by the server (service role).

-- ── storage: project files at <workspace_id>/<project_id>/<file> ─────────────
insert into storage.buckets (id, name, public)
values ('project-files', 'project-files', false)
on conflict (id) do nothing;

create policy "workspace files read" on storage.objects
  for select using (bucket_id = 'project-files'
    and (storage.foldername(name))[1] = public.my_workspace_id()::text);
create policy "workspace files insert" on storage.objects
  for insert with check (bucket_id = 'project-files'
    and (storage.foldername(name))[1] = public.my_workspace_id()::text);
create policy "workspace files delete" on storage.objects
  for delete using (bucket_id = 'project-files'
    and (storage.foldername(name))[1] = public.my_workspace_id()::text);
