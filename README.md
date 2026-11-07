# Madre (v2)

Project management for an agency team: projects, tasks, clients, project reports,
and email/WhatsApp alerts. Vite + React + Supabase, deployed on Vercel.

> v2 is a rebuild on the `v2` branch. The previous app stays on `main` until v2 replaces it.

## Stack

- **React 18 + Vite**, **React Router** (real URLs), **TanStack Query** (server data)
- **Tailwind CSS v4** — colour tokens live in `src/index.css` (`bg-surface`, `text-muted`, …), so light/dark works without per-component `dark:` classes
- **Supabase** — auth, Postgres with row-level security, storage for project files
- **Vercel** — static app + `api/` serverless functions

## Project structure

```
src/
  main.jsx              Providers (Query, Auth) and theme bootstrap
  App.jsx               Routes + sign-in / onboarding / app gate
  auth/AuthProvider.jsx Session, current member and workspace
  layouts/AppLayout.jsx Sidebar (desktop) and drawer (mobile)
  components/ui.jsx     Shared UI kit: Button, Input, Card, Avatar, Logo, …
  components/icons.jsx  Inline SVG icons
  pages/                One file per screen
  lib/                  supabase client, theme
api/notify.js           Email (Resend) + WhatsApp (Meta) delivery
supabase/migrations/    v2 schema (single migration)
```

## Data model

| Table | Purpose |
|---|---|
| `workspaces` | The agency. Has a `join_code` teammates use to join. |
| `members` | One per user (auto-created on sign-up). Role `admin` or `member`, WhatsApp number, alert preferences. |
| `clients` | Agency clients. |
| `projects` | Belongs to a workspace, optionally a client; has an owner, status, dates, budget. |
| `tasks` | Belongs to a project; assignee, status, priority, due date. |
| `comments` | On a project or a task. |
| `activity` | Written by database triggers on task/project/comment changes. Feeds reports and Home. |
| `notifications_sent` | Server-side log so each alert is sent once. |

Project files live in the private `project-files` storage bucket under `<workspace_id>/<project_id>/`.
Row-level security limits every member to their own workspace.

## Setting up

1. Create a **new** Supabase project for v2 (the live v1 database is left untouched until migration).
2. Apply the schema: paste `supabase/migrations/20261107000000_v2_schema.sql` into the SQL editor, or run
   `npx supabase link --project-ref <ref>` then `npm run supabase:db:push`.
3. In Supabase → Authentication → URL configuration, set the Site URL to your app URL (used by
   confirmation and password-reset emails).
4. Copy `.env.example` to `.env.local` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
5. `npm install` then `npm run dev`.

The first person to sign up chooses **Create workspace** and becomes admin. Everyone else signs up,
chooses **Join a team** and enters the code shown in Settings.

## Scripts

| Command | |
|---|---|
| `npm run dev` | Dev server on port 5174 (also serves `api/` routes locally) |
| `npm run build` | Production build to `dist/` |
| `npm run test:email` / `test:whatsapp` | Send a test alert |
