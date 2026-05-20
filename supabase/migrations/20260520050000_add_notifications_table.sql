create table if not exists public.notifications (
  id              uuid        default gen_random_uuid() primary key,
  agency_id       uuid        not null references public.agencies(id) on delete cascade,
  recipient_email text        not null,
  type            text        not null,
  title           text        not null,
  body            text        not null default '',
  entity_type     text,
  entity_id       text,
  read            boolean     not null default false,
  created_at      timestamptz not null default now()
);

alter table public.notifications enable row level security;

-- Users read only their own notifications
drop policy if exists "notifications_select" on public.notifications;
create policy "notifications_select" on public.notifications
  for select using (
    recipient_email = (select email from public.profiles where id = auth.uid())
  );

-- Any agency member can create notifications for teammates
drop policy if exists "notifications_insert" on public.notifications;
create policy "notifications_insert" on public.notifications
  for insert with check (agency_id = my_agency_id());

-- Users can mark their own notifications read
drop policy if exists "notifications_update" on public.notifications;
create policy "notifications_update" on public.notifications
  for update using (
    recipient_email = (select email from public.profiles where id = auth.uid())
  );

-- Users can delete (dismiss) their own notifications
drop policy if exists "notifications_delete" on public.notifications;
create policy "notifications_delete" on public.notifications
  for delete using (
    recipient_email = (select email from public.profiles where id = auth.uid())
  );

-- Enable realtime delivery
alter publication supabase_realtime add table public.notifications;
