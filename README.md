# AgencyFlow

AgencyFlow is a Vite + React single-page app with a serverless API route for AI-assisted workflows.

## Project Structure

- `src/App.jsx` contains the main app shell and providers.
- `src/pages/` contains one file per feature screen, plus the page router and search entrypoints.
- `src/components/common.jsx` contains shared UI components.
- `src/components/AuthScreen.jsx` and `src/hooks/useAuth.js` provide local sign-in/sign-up for the demo app.
- `src/context/`, `src/hooks/`, `src/data/`, `src/lib/`, and `src/styles/` hold app state, mock data, utilities, API helpers, and style helpers.
- Root `App.jsx` is a compatibility re-export for older imports.

## Authentication

Authentication is local to the browser and stored in `localStorage`, matching the app's mock data layer. You can sign up with a new account, or sign in again later from the same browser.

When `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are present, sign in and sign up use Supabase Auth instead.

## Supabase

The project includes:

- `src/lib/supabaseClient.js` for the Vite Supabase client.
- `supabase/config.toml` for local Supabase CLI settings.
- `supabase/migrations/20260512140000_create_agencyflow_schema.sql` for the app tables and RLS policies.

Required Vite environment variables:

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Useful commands:

```bash
npm run supabase:start
npm run supabase:db:push
npm run supabase:stop
```

## Outbound Notifications

Operational automation alerts can also be sent through email and WhatsApp. Enable the channels in Settings -> Automations after adding provider secrets to `.env.local` or your Vercel project.

Email uses Resend:

```bash
RESEND_API_KEY=your_resend_api_key
NOTIFICATION_EMAIL_FROM=Madre <notifications@your-domain.com>
NOTIFICATION_REPLY_TO=support@your-domain.com
NOTIFICATION_EMAIL_TO=ops@your-domain.com
NOTIFICATION_BRAND_NAME=Madre
NOTIFICATION_APP_URL=https://madre.com.ng
NOTIFICATION_LOGO_URL=https://madre.com.ng/logo.png
```

`NOTIFICATION_REPLY_TO` should be a real monitored mailbox on the same verified domain. `NOTIFICATION_BRAND_NAME` customizes the email subject prefix. `NOTIFICATION_APP_URL` adds the website CTA button in notification emails. `NOTIFICATION_LOGO_URL` adds the logo shown at the top of notification emails.

If emails arrive in spam, fix the sender/domain trust before changing app logic:

- In Resend, verify the domain used by `NOTIFICATION_EMAIL_FROM`.
- Add every SPF and DKIM DNS record shown in the Resend domain screen.
- Add a DMARC TXT record for the same domain, starting with `p=none` while testing.
- Use a domain or subdomain dedicated to transactional email, for example `notifications.your-domain.com`.
- Avoid `no-reply` senders; keep `NOTIFICATION_REPLY_TO` set to a mailbox people can answer.
- In Resend domain settings, disable click tracking and open tracking for these transactional emails if they are enabled.
- After DNS changes, wait for propagation, redeploy Vercel, send `npm run test:email -- --to you@example.com`, then inspect the message headers for `spf=pass`, `dkim=pass`, and `dmarc=pass`.

After adding those values, send a direct smoke-test email:

```bash
npm run test:email
```

You can override the recipient for one run:

```bash
npm run test:email -- --to you@example.com
```

When Assignment Emails are enabled in Settings -> Automations, Madre sends a Resend email directly to the assigned user when:

- a new project is created with a team member assigned
- a new task is created with a team member assigned
- an existing project or task is newly assigned to a different team member
- a task is assigned to a department; every department member with an email receives the alert

These assignment emails do not use `NOTIFICATION_EMAIL_TO`; that fallback inbox is reserved for automation alerts.

WhatsApp uses Meta WhatsApp Cloud API:

```bash
WHATSAPP_ACCESS_TOKEN=your_meta_whatsapp_access_token
WHATSAPP_PHONE_NUMBER_ID=your_whatsapp_phone_number_id
WHATSAPP_GRAPH_VERSION=v25.0
NOTIFICATION_WHATSAPP_TO=2348012345678
WHATSAPP_TEMPLATE_NAME=madre_task_alert
WHATSAPP_TEMPLATE_LANGUAGE=en
WHATSAPP_ALLOW_TEXT=false
```

For production, keep Supabase auth configured so `/api/notify` can verify the signed-in user before sending. WhatsApp business-initiated alerts should use an approved template with four body variables: alert label, task title, project, and due date.

## Local Development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Add local environment variables:

   ```bash
   cp .env.example .env.local
   ```

3. Start the app:

   ```bash
   npm run dev
   ```

## Production Build

```bash
npm run build
```

The static app is emitted to `dist/`.

## Deploying To Vercel

This project is Vercel-ready:

- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Serverless AI route: `/api/claude`
- Serverless notification route: `/api/notify`

Set these environment variables in Vercel before deploying:

```bash
ANTHROPIC_API_KEY=your_anthropic_api_key
ANTHROPIC_MODEL=claude-sonnet-4-20250514
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
RESEND_API_KEY=your_resend_api_key
NOTIFICATION_EMAIL_FROM=Madre <notifications@your-domain.com>
NOTIFICATION_REPLY_TO=support@your-domain.com
NOTIFICATION_BRAND_NAME=Madre
NOTIFICATION_APP_URL=https://madre.com.ng
NOTIFICATION_LOGO_URL=https://madre.com.ng/logo.png
```

`ANTHROPIC_MODEL`, `NOTIFICATION_REPLY_TO`, `NOTIFICATION_BRAND_NAME`, `NOTIFICATION_APP_URL`, and `NOTIFICATION_LOGO_URL` are optional. Assignment emails require the Supabase and Resend variables above, followed by a Vercel redeploy.
