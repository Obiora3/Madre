-- Madre v2 demo data — placeholder team, clients, projects and tasks for testing.
-- Safe to re-run: it deletes the previous demo data first.
-- Run in the Supabase SQL editor (or automatically on Supabase preview branches).
--
-- All demo users sign in with password:  MadreDemo2026!
--   ada@example.com      Ada Obi          Creative Director    (admin)
--   tunde@example.com    Tunde Bakare     Account Manager
--   chioma@example.com   Chioma Eze       Designer
--   ifeanyi@example.com  Ifeanyi Okafor   Copywriter
--   zainab@example.com   Zainab Musa      Social Media Manager
-- Workspace join code: DEMO2026
-- Dates are relative to the day you run this, so overdue / due-soon cases stay current.

begin;

-- ── reset previous demo data ─────────────────────────────────────────────────
delete from public.workspaces where id = '20000000-0000-4000-8000-000000000001';
delete from auth.users where id::text like '10000000-0000-4000-8000-%';

-- Seeded history is written explicitly below with realistic actors and times,
-- so the automatic activity/completed_at triggers are paused for this script.
alter table public.tasks    disable trigger log_task_activity;
alter table public.tasks    disable trigger tasks_completed_at;
alter table public.projects disable trigger log_project_activity;
alter table public.comments disable trigger log_comment_activity;

-- ── users (the auth trigger creates their members rows) ──────────────────────
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000', u.id::uuid, 'authenticated', 'authenticated', u.email,
  extensions.crypt('MadreDemo2026!', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', jsonb_build_object('name', u.name),
  now() - interval '90 days', now(), '', '', '', ''
from (values
  ('10000000-0000-4000-8000-000000000001', 'ada@example.com',     'Ada Obi'),
  ('10000000-0000-4000-8000-000000000002', 'tunde@example.com',   'Tunde Bakare'),
  ('10000000-0000-4000-8000-000000000003', 'chioma@example.com',  'Chioma Eze'),
  ('10000000-0000-4000-8000-000000000004', 'ifeanyi@example.com', 'Ifeanyi Okafor'),
  ('10000000-0000-4000-8000-000000000005', 'zainab@example.com',  'Zainab Musa')
) as u(id, email, name);

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select id::text, id, jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users where id::text like '10000000-0000-4000-8000-%';

-- ── workspace + members ──────────────────────────────────────────────────────
insert into public.workspaces (id, name, join_code, created_by, created_at)
values ('20000000-0000-4000-8000-000000000001', 'Madre Demo Agency', 'DEMO2026',
        '10000000-0000-4000-8000-000000000001', now() - interval '90 days');

update public.members m set
  workspace_id = '20000000-0000-4000-8000-000000000001',
  role = v.role,
  job_title = v.job_title,
  whatsapp = v.whatsapp
from (values
  ('10000000-0000-4000-8000-000000000001', 'admin',  'Creative Director',    '2348000000001'),
  ('10000000-0000-4000-8000-000000000002', 'member', 'Account Manager',      '2348000000002'),
  ('10000000-0000-4000-8000-000000000003', 'member', 'Designer',             null),
  ('10000000-0000-4000-8000-000000000004', 'member', 'Copywriter',           null),
  ('10000000-0000-4000-8000-000000000005', 'member', 'Social Media Manager', null)
) as v(id, role, job_title, whatsapp)
where m.id = v.id::uuid;

-- ── clients ──────────────────────────────────────────────────────────────────
insert into public.clients (id, workspace_id, name, contact_name, contact_email, contact_phone, notes, created_at)
select c.id::uuid, '20000000-0000-4000-8000-000000000001', c.name, c.contact, c.email, c.phone, c.notes,
       now() - interval '80 days'
from (values
  ('30000000-0000-4000-8000-000000000001', 'Palmwood Foods',     'Kemi Adeyemi', 'kemi@palmwood.example',    '+234 800 000 1001', 'Retainer client since 2024.'),
  ('30000000-0000-4000-8000-000000000002', 'Ankara & Co.',       'Femi Johnson', 'femi@ankara.example',      '+234 800 000 1002', 'E-commerce fashion brand.'),
  ('30000000-0000-4000-8000-000000000003', 'BrightPath Fintech', 'Ngozi Uche',   'ngozi@brightpath.example', '+234 800 000 1003', null),
  ('30000000-0000-4000-8000-000000000004', 'Greenleaf Pharmacy', 'Sani Bello',   'sani@greenleaf.example',   null,                'New client — pitch won last month.')
) as c(id, name, contact, email, phone, notes);

-- ── projects ─────────────────────────────────────────────────────────────────
-- (n, client, owner, title, status, priority, start offset, due offset, budget, created days ago, description)
insert into public.projects (id, workspace_id, client_id, owner_id, created_by, title, description, status, priority,
                             start_date, due_date, budget, created_at)
select ('40000000-0000-4000-8000-00000000000' || p.n)::uuid,
       '20000000-0000-4000-8000-000000000001',
       case when p.client is null then null else ('30000000-0000-4000-8000-00000000000' || p.client)::uuid end,
       ('10000000-0000-4000-8000-00000000000' || p.owner)::uuid,
       ('10000000-0000-4000-8000-00000000000' || p.owner)::uuid,
       p.title, p.description, p.status, p.priority,
       current_date + p.start_off, current_date + p.due_off, p.budget,
       now() - make_interval(days => p.created_ago)
from (values
  (1, 1, 2, 'Jollof Fest Campaign', 'active',  'high',   -30,  14, 4500000, 32, 'Integrated campaign for the Jollof Fest product launch: key visual, social, radio and influencers.'),
  (2, 2, 1, 'Website Redesign',     'active',  'urgent', -45,   5, 6000000, 46, 'Full redesign of the Ankara & Co. online store ahead of the festive season.'),
  (3, 3, 5, 'App Launch Social',    'active',  'medium', -10,  30, 2500000, 11, 'Social content and community plan for the BrightPath app launch.'),
  (4, 4, 1, 'Brand Refresh',        'planning','medium',   7,  60, 3800000,  3, 'Logo, colour and packaging refresh for Greenleaf Pharmacy.'),
  (5, 1, 2, 'Q3 Product Shoot',     'done',    'medium', -90, -20, 1500000, 90, 'Studio shoot for the Q3 product range.'),
  (6, 3, 2, 'Investor Deck',        'on_hold', 'high',   -20,  10, null,    21, 'Series A investor deck design. Waiting on metrics from the client.')
) as p(n, client, owner, title, status, priority, start_off, due_off, budget, created_ago, description);

-- ── tasks ────────────────────────────────────────────────────────────────────
-- (project, assignee, title, status, priority, due offset, completed days ago, created days ago)
insert into public.tasks (workspace_id, project_id, assignee_id, title, status, priority, due_date,
                          position, completed_at, created_by, created_at)
select '20000000-0000-4000-8000-000000000001',
       ('40000000-0000-4000-8000-00000000000' || t.p)::uuid,
       ('10000000-0000-4000-8000-00000000000' || t.a)::uuid,
       t.title, t.status, t.priority, current_date + t.due_off,
       row_number() over (partition by t.p order by t.ord),
       case when t.done_ago is not null then now() - make_interval(days => t.done_ago) end,
       pr.owner_id,
       now() - make_interval(days => t.created_ago)
from (values
  (1,  1, 4, 'Write campaign key messages',            'done',        'high',   -12, 13,   28),
  (2,  1, 3, 'Design key visual',                      'done',        'high',    -8,  7,   25),
  (3,  1, 5, 'Plan Instagram rollout calendar',        'in_progress', 'medium',   3, null, 20),
  (4,  1, 3, 'Produce 10 social adaptations',          'in_progress', 'high',     6, null, 15),
  (5,  1, 2, 'Get client sign-off on visuals',         'review',      'urgent',   1, null, 10),
  (6,  1, 5, 'Book influencer partners',               'blocked',     'high',    -2, null, 18),
  (7,  1, 4, 'Radio script (30s)',                     'todo',        'medium',  10, null,  5),
  (8,  2, 3, 'Homepage wireframes',                    'done',        'high',   -30, 32,   44),
  (9,  2, 3, 'Design system & components',             'done',        'high',   -15, 16,   40),
  (10, 2, 1, 'Review product page designs',            'review',      'urgent',  -1, null, 12),
  (11, 2, 4, 'Write product descriptions',             'in_progress', 'medium',   2, null, 14),
  (12, 2, 2, 'Collect product photography from client','blocked',     'high',    -4, null, 20),
  (13, 2, 3, 'Checkout page design',                   'todo',        'high',     4, null,  6),
  (14, 2, 1, 'Final QA and launch',                    'todo',        'urgent',   5, null,  3),
  (15, 3, 5, 'Content pillars & tone of voice',        'done',        'medium',  -3,  4,    9),
  (16, 3, 4, 'Launch week captions',                   'in_progress', 'medium',   7, null,  6),
  (17, 3, 3, 'Motion graphics for app features',       'todo',        'medium',  12, null,  4),
  (18, 3, 5, 'Community management plan',              'todo',        'low',     20, null,  2),
  (19, 3, 2, 'Approve paid media budget',              'todo',        'high',     0, null,  3),
  (20, 4, 1, 'Kick-off workshop',                      'todo',        'medium',   8, null,  2),
  (21, 4, 3, 'Competitor brand audit',                 'todo',        'medium',  15, null,  2),
  (22, 4, 2, 'Confirm scope and timeline',             'in_progress', 'high',     3, null,  3),
  (23, 5, 3, 'Shot list',                              'done',        'medium', -60, 62,   85),
  (24, 5, 2, 'Book studio',                            'done',        'medium', -55, 56,   85),
  (25, 5, 3, 'Retouch final images',                   'done',        'high',   -25, 24,   70),
  (26, 5, 2, 'Deliver assets to client',               'done',        'high',   -20, 20,   60),
  (27, 6, 2, 'Gather Q2 metrics from client',          'blocked',     'high',    -6, null, 18),
  (28, 6, 4, 'Draft investor narrative',               'in_progress', 'high',     4, null, 15),
  (29, 6, 3, 'Slide design',                           'todo',        'medium',   8, null, 10)
) as t(ord, p, a, title, status, priority, due_off, done_ago, created_ago)
join public.projects pr on pr.id = ('40000000-0000-4000-8000-00000000000' || t.p)::uuid;

-- ── comments ─────────────────────────────────────────────────────────────────
insert into public.comments (workspace_id, project_id, task_id, author_id, body, created_at)
select '20000000-0000-4000-8000-000000000001', t.project_id, t.id,
       ('10000000-0000-4000-8000-00000000000' || c.author)::uuid, c.body,
       now() - make_interval(hours => c.hours_ago)
from (values
  ('Book influencer partners', 5, 'Two of the five influencers want higher fees. Waiting on Palmwood to approve the extra budget.', 50),
  ('Book influencer partners', 2, 'Chasing Kemi on this today.', 30),
  ('Collect product photography from client', 2, 'Femi says the photos are coming Monday. This is blocking the product pages.', 70),
  ('Review product page designs', 1, 'Looks great overall. Please increase contrast on the size selector.', 20),
  ('Gather Q2 metrics from client', 4, 'Can''t finalise the narrative until we have these numbers.', 90),
  ('Design key visual', 2, 'Client loved it. Approved without changes!', 170)
) as c(task_title, author, body, hours_ago)
join public.tasks t on t.title = c.task_title and t.workspace_id = '20000000-0000-4000-8000-000000000001';

insert into public.comments (workspace_id, project_id, author_id, body, created_at)
values
  ('20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002',
   '10000000-0000-4000-8000-000000000001', 'Launch date is fixed — we cannot slip past the due date on this one.', now() - interval '4 days'),
  ('20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000006',
   '10000000-0000-4000-8000-000000000002', 'Putting this on hold until BrightPath sends the Q2 numbers.', now() - interval '5 days');

-- ── activity history (what the triggers would have written) ──────────────────
insert into public.activity (workspace_id, project_id, actor_id, kind, summary, created_at)
select workspace_id, id, owner_id, 'project_created', 'created the project', created_at
from public.projects where workspace_id = '20000000-0000-4000-8000-000000000001';

insert into public.activity (workspace_id, project_id, actor_id, kind, summary, meta, created_at)
values ('20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000005',
        '10000000-0000-4000-8000-000000000002', 'project_status', 'changed project status to done',
        '{"from":"active","to":"done"}', now() - interval '19 days'),
       ('20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000006',
        '10000000-0000-4000-8000-000000000002', 'project_status', 'changed project status to on hold',
        '{"from":"active","to":"on_hold"}', now() - interval '5 days');

-- created
insert into public.activity (workspace_id, project_id, task_id, actor_id, kind, summary, created_at)
select workspace_id, project_id, id, created_by, 'task_created', 'created task "' || title || '"', created_at
from public.tasks where workspace_id = '20000000-0000-4000-8000-000000000001';

-- started (everything past "todo" was picked up a day after creation)
insert into public.activity (workspace_id, project_id, task_id, actor_id, kind, summary, meta, created_at)
select workspace_id, project_id, id, assignee_id, 'task_status', 'moved "' || title || '" to in progress',
       '{"from":"todo","to":"in_progress"}', created_at + interval '1 day'
from public.tasks where workspace_id = '20000000-0000-4000-8000-000000000001' and status <> 'todo';

-- latest status change for review / blocked / done
insert into public.activity (workspace_id, project_id, task_id, actor_id, kind, summary, meta, created_at)
select workspace_id, project_id, id, assignee_id, 'task_status',
       'moved "' || title || '" to ' || status,
       jsonb_build_object('from', 'in_progress', 'to', status),
       coalesce(completed_at, now() - interval '2 days')
from public.tasks
where workspace_id = '20000000-0000-4000-8000-000000000001' and status in ('review', 'blocked', 'done');

insert into public.activity (workspace_id, project_id, task_id, actor_id, kind, summary, created_at)
select workspace_id, project_id, task_id, author_id, 'comment', 'commented', created_at
from public.comments where workspace_id = '20000000-0000-4000-8000-000000000001';

-- ── restore triggers ─────────────────────────────────────────────────────────
alter table public.tasks    enable trigger log_task_activity;
alter table public.tasks    enable trigger tasks_completed_at;
alter table public.projects enable trigger log_project_activity;
alter table public.comments enable trigger log_comment_activity;

commit;
