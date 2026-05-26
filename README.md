# Madre

Madre is a full-featured agency management platform built with Vite + React. It covers projects, tasks, clients, KPIs, timelines, reports, pitch pipelines, and AI-assisted workflows — all in a single-page app backed by Supabase and a pair of serverless API routes.

---

## Table of Contents

- [Project Structure](#project-structure)
- [Authentication & Agencies](#authentication--agencies)
- [Supabase](#supabase)
- [Outbound Notifications](#outbound-notifications)
  - [Email (Resend)](#email-resend)
  - [WhatsApp (Meta Cloud API)](#whatsapp-meta-cloud-api)
- [Local Development](#local-development)
- [Production Build](#production-build)
- [Deploying to Vercel](#deploying-to-vercel)

---

## Project Structure

```
src/
  App.jsx                  Main app shell, sidebar, topbar, providers
  pages/                   One file per feature screen + PageRouter + GlobalSearch
    Dashboard.jsx
    Projects.jsx / ProjectDetail.jsx
    Tasks.jsx
    Team.jsx
    Clients.jsx
    KPIs.jsx
    Timeline.jsx
    Reports.jsx
    AIBrief.jsx
    Drive.jsx
    Profitability.jsx
    PitchPipeline.jsx
    Benchmarking.jsx
    Departments.jsx
    DeliveryScores.jsx
    WhiteLabel.jsx          Settings, automations, roles, activity log
    Profile.jsx             User profile, WhatsApp number, agency setup
    _shared.js              Re-exports used by all pages
  components/
    common.jsx              Shared UI components (Avatar, Modal, Badge, …)
    AuthScreen.jsx          Sign-in / sign-up screen
  context/
    app-context.jsx         AppContext and useApp hook
  hooks/
    useAppData.js           Supabase + localStorage data layer
    useAuth.js              Authentication (Supabase or local fallback)
    useNotifications.js     In-app notification bell
    useOperationalAutomations.js  Deadline / overdue / blocked automation engine
    useWhiteLabelSettings.js      Agency settings with defaults
    useIsMobile.js
    useLocalStorage.js
  lib/
    supabaseClient.js
    helpers.js              Pipeline, status, date, and formatting utilities
    ai.js                   Claude API wrapper
    assignmentNotifications.js    Sends email on task / project assignment
    notificationHelpers.js  In-app notification builder
    fileStorage.js
  data/
    mockData.js             Empty collections (live data comes from Supabase)
  styles/
    formStyles.js
api/
  claude.js                 Serverless route — AI Brief feature
  notify.js                 Serverless route — email + WhatsApp notifications
```

---

## Authentication & Agencies

Sign-up and sign-in use Supabase Auth when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set. Without those variables the app falls back to a `localStorage`-only mode suitable for local testing.

After signing up, every user must either **create** or **join** an agency:

- **Create** — generates a unique 8-character invite code (e.g. `NOVA8K2X`) and provisions a new agency.
- **Join** — enter a code shared by an existing agency owner to link your account.

All data (projects, tasks, clients, etc.) is scoped to the agency. Team members added via the invite code share the same workspace in real time.

---

## Supabase

The project ships with a complete Supabase setup:

| File | Purpose |
|---|---|
| `src/lib/supabaseClient.js` | Vite Supabase client |
| `supabase/config.toml` | Local Supabase CLI config |
| `supabase/migrations/` | Schema + RLS policies for all tables |

**Required environment variables:**

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**Useful commands:**

```bash
npm run supabase:start      # Start local Supabase stack
npm run supabase:db:push    # Push migrations to your project
npm run supabase:stop       # Stop local stack
```

> **Optional — add a `phone` column to `profiles`:**
> The WhatsApp integration stores each user's phone number in Supabase `user_metadata`. If you also want it visible to teammates in the `profiles` table, run:
> ```sql
> alter table profiles add column if not exists phone text;
> ```

---

## Outbound Notifications

Madre can send alerts outside the app through two channels: **email** (via Resend) and **WhatsApp** (via Meta WhatsApp Cloud API). Both are routed through the `/api/notify` serverless function.

Enable each channel in **Settings → Outbound Channels** after adding the required environment variables.

### Automation triggers

When automations are enabled, Madre sends external notifications for:

| Trigger | Condition |
|---|---|
| Deadline warning | An open task enters the warning window (default: 24 h before due) |
| Overdue escalation | A task remains incomplete past the escalation threshold |
| Blocked task | A task is waiting on unfinished dependencies |

Assignment notifications (task/project assigned to a team member) are also sent when **Assignment Emails** is enabled.

---

### Email (Resend)

**Environment variables:**

```bash
RESEND_API_KEY=your_resend_api_key
NOTIFICATION_EMAIL_FROM=Madre <notifications@your-domain.com>
NOTIFICATION_REPLY_TO=support@your-domain.com
NOTIFICATION_EMAIL_TO=ops@your-domain.com        # fallback inbox for automation alerts
NOTIFICATION_BRAND_NAME=Madre
NOTIFICATION_APP_URL=https://madre.com.ng
NOTIFICATION_LOGO_URL=https://madre.com.ng/logo.png
```

**Email template**

Notification emails use a narrative format — each message opens with a personalised paragraph that reads like a colleague's message, describing what happened, why it matters, and what to do next. Task and project details (status, priority, due date, budget, assigned to, etc.) are listed below in a structured table, followed by a notes block if a description is present.

The template adapts its tone per notification type:

- **Task assigned** — names the project and client, calls out high/low priority, states the due date.
- **Project assigned** — summarises stage, timeline, and budget in prose.
- **Deadline approaching** — explains how much time is left and prompts early escalation of blockers.
- **Overdue** — direct urgency, asks for a status update or blocker flag.
- **Blocked** — explains the dependency situation and asks the recipient to coordinate.

**Avoiding the spam folder**

1. In Resend, verify the domain used by `NOTIFICATION_EMAIL_FROM`.
2. Add every SPF and DKIM DNS record shown in the Resend domain screen.
3. Add a DMARC TXT record (`p=none` while testing, harden later).
4. Use a subdomain dedicated to transactional mail, e.g. `notifications.your-domain.com`.
5. Keep `NOTIFICATION_REPLY_TO` pointing to a real monitored mailbox.
6. Disable click/open tracking in Resend domain settings for transactional emails.

**Smoke test:**

```bash
npm run test:email
# or target a specific address:
npm run test:email -- --to you@example.com
```

---

### WhatsApp (Meta Cloud API)

Madre sends WhatsApp alerts through the **Meta WhatsApp Business Cloud API**. Messages are routed to two recipient sources:

1. **Per-user phone numbers** — each team member can save their WhatsApp number in **Profile → WhatsApp Number**. When an automation fires, Madre looks up the assignee's current number and sends directly to them, even if the task was created before they added their number.
2. **Fallback recipient list** — `NOTIFICATION_WHATSAPP_TO` is a comma-separated list of numbers that always receive automation alerts regardless of task assignment.

#### Step 1 — Meta Business setup

1. Go to [developers.facebook.com](https://developers.facebook.com) and create or open an app.
2. Add the **WhatsApp** product to the app.
3. Under **WhatsApp → API Setup**, note your **Phone Number ID** and **Temporary Access Token** (or generate a permanent System User token for production).
4. Add a real phone number as a test recipient under **WhatsApp → API Setup → To**.

#### Step 2 — Create a message template (recommended for production)

1. In Meta Business Manager, go to **WhatsApp → Message Templates → Create**.
2. Category: **Utility** · Language: **English**
3. Suggested name: `madre_task_alert`
4. Body text with four variables:

   ```
   {{1}} alert for "{{2}}" on the {{3}} project. Due: {{4}}.
   ```

   The four variables map to: `alert label`, `task title`, `project name`, `due date`.
5. Submit for review. Approval usually takes a few minutes for utility templates.

> **Testing without a template:** set `WHATSAPP_ALLOW_TEXT=true` to send plain-text messages to numbers you have an existing conversation with. This bypasses template approval but only works in a test/sandbox context.

#### Step 3 — Environment variables

```bash
WHATSAPP_ACCESS_TOKEN=your_meta_access_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_GRAPH_VERSION=v25.0                       # optional, defaults to v25.0
NOTIFICATION_WHATSAPP_TO=2348012345678,44712345678 # fallback numbers, international format, no +
WHATSAPP_TEMPLATE_NAME=madre_task_alert            # name of your approved template
WHATSAPP_TEMPLATE_LANGUAGE=en                      # optional, defaults to en
WHATSAPP_ALLOW_TEXT=false                          # set true only for sandbox testing
```

> Phone numbers must be in **international format without the `+`**, e.g. `2348012345678` for a Nigerian number or `447911123456` for a UK number.

#### Step 4 — Enable in Settings

Go to **Settings → Outbound Channels** and toggle on **WhatsApp Alerts**. The settings panel shows the required environment variable reference. Make sure **Enable Automations** is also on so the automation engine runs.

#### Per-user phone numbers

Each team member goes to **Profile → Edit Details → WhatsApp Number** and enters their number in international format (e.g. `+2348012345678`). The `+` prefix is accepted here. Madre resolves the assignee's current number at send time, so historical tasks are automatically covered once a number is saved.

---

## Local Development

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Copy the environment template:**

   ```bash
   cp .env.example .env.local
   ```

   Fill in at minimum `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. All notification variables are optional for local development.

3. **Start the dev server:**

   ```bash
   npm run dev
   ```

The app runs at `http://localhost:5173` by default.

---

## Production Build

```bash
npm run build
```

Static output is written to `dist/`. The browser tab uses the Madre icon as the favicon (`public/favicon.png`).

---

## Deploying to Vercel

Madre is Vercel-ready out of the box.

| Setting | Value |
|---|---|
| Framework preset | Vite |
| Build command | `npm run build` |
| Output directory | `dist` |
| Serverless routes | `/api/claude`, `/api/notify` |

**Required environment variables in Vercel:**

```bash
# App
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
ANTHROPIC_API_KEY=your_anthropic_api_key

# Email (Resend)
RESEND_API_KEY=your_resend_api_key
NOTIFICATION_EMAIL_FROM=Madre <notifications@your-domain.com>
NOTIFICATION_REPLY_TO=support@your-domain.com
NOTIFICATION_EMAIL_TO=ops@your-domain.com

# WhatsApp (Meta Cloud API)
WHATSAPP_ACCESS_TOKEN=your_meta_access_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
NOTIFICATION_WHATSAPP_TO=2348012345678

# Branding (optional)
ANTHROPIC_MODEL=claude-sonnet-4-20250514
NOTIFICATION_BRAND_NAME=Madre
NOTIFICATION_APP_URL=https://madre.com.ng
NOTIFICATION_LOGO_URL=https://madre.com.ng/logo.png
WHATSAPP_TEMPLATE_NAME=madre_task_alert
WHATSAPP_TEMPLATE_LANGUAGE=en
```

After adding or changing environment variables, trigger a **Vercel redeploy** for them to take effect.
