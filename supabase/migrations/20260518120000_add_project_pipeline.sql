alter table public.projects
  add column if not exists pipeline_id text not null default 'standard-delivery';
