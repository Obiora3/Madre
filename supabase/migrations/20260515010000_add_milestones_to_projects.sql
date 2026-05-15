alter table public.projects
  add column if not exists milestones jsonb not null default '[]'::jsonb;
