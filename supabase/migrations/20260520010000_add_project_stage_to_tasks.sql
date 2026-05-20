alter table public.tasks
  add column if not exists project_stage text not null default '';
