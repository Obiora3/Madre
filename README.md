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

Authentication is local to the browser and stored in `localStorage`, matching the app's mock data layer. You can sign up with a new account, sign in again later from the same browser, or use the demo account:

```text
Email: adaeze@agency.io
Password: agencyflow
```

When `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are present, sign in and sign up use Supabase Auth instead.

## Supabase

The project includes:

- `src/lib/supabaseClient.js` for the Vite Supabase client.
- `supabase/config.toml` for local Supabase CLI settings.
- `supabase/migrations/20260512140000_create_agencyflow_schema.sql` for the app tables and RLS policies.

Required Vite environment variables:

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Useful commands:

```bash
npm run supabase:start
npm run supabase:db:push
npm run supabase:stop
```

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

Set these environment variables in Vercel before deploying:

```bash
ANTHROPIC_API_KEY=your_anthropic_api_key
ANTHROPIC_MODEL=claude-sonnet-4-20250514
```

`ANTHROPIC_MODEL` is optional. If omitted, the API route uses the model shown above.
