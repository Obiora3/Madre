alter table public.tasks
  add column if not exists blocked_by  text[]  not null default '{}',
  add column if not exists subtasks    jsonb   not null default '[]',
  add column if not exists recurrence  text    not null default 'none';
