alter table public.projects
  add column if not exists budget numeric not null default 0,
  add column if not exists budget_spent numeric not null default 0;
