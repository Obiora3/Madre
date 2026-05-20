create table if not exists public.files (
  id               uuid        default gen_random_uuid() primary key,
  agency_id        uuid        not null references public.agencies(id) on delete cascade,
  name             text        not null,
  description      text        not null default '',
  storage_path     text        not null,
  file_size        bigint      not null default 0,
  mime_type        text        not null default '',
  category         text        not null default 'general',
  department_name  text,
  project_id       text,
  uploaded_by_name  text       not null default '',
  uploaded_by_email text       not null default '',
  created_at       timestamptz not null default now()
);

alter table public.files enable row level security;

drop policy if exists "Agency members can manage files" on public.files;
create policy "Agency members can manage files" on public.files
  for all
  using (agency_id = my_agency_id())
  with check (agency_id = my_agency_id());

-- Storage bucket (private, 50 MB per file)
insert into storage.buckets (id, name, public, file_size_limit)
values ('agency-files', 'agency-files', false, 52428800)
on conflict (id) do nothing;

drop policy if exists "storage_agency_files_insert" on storage.objects;
create policy "storage_agency_files_insert"
  on storage.objects for insert
  with check (bucket_id = 'agency-files' and auth.role() = 'authenticated');

drop policy if exists "storage_agency_files_select" on storage.objects;
create policy "storage_agency_files_select"
  on storage.objects for select
  using (bucket_id = 'agency-files' and auth.role() = 'authenticated');

drop policy if exists "storage_agency_files_delete" on storage.objects;
create policy "storage_agency_files_delete"
  on storage.objects for delete
  using (bucket_id = 'agency-files' and auth.role() = 'authenticated');
