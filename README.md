# Form Fitness

Mobile-first workout tracker built with React, TypeScript, Vite, Tailwind, Supabase Auth, PostgreSQL, Recharts, and Lucide.

## Run locally

```sh
npm install
npm run dev
```

Without Supabase credentials, the app runs in device-local demo mode. Demo plans and schedules are editable, while completed, cancelled, and in-progress sessions persist in this browser's local storage.

## Supabase setup

1. Create a Supabase project and run `supabase/migrations/202611270001_fitness_tracker.sql`.
2. In Supabase Auth settings, disable public sign-ups. Create or invite the two users through the dashboard.
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to `.env.local`.

The migration enables RLS and lets authenticated household users read each other's profiles and activity while restricting changes to the owner. Session exercise names and target details are stored as snapshots so later plan edits do not rewrite history.

## Deployment

Deploy the Vite app to Vercel and set the same environment variables. `public/manifest.webmanifest` supplies the installable PWA metadata. Configure Supabase Auth's site URL and redirect URLs for the deployed origin.

## Current limitations

The browser demo mode is fully local. The initial scaffold includes the production database schema and Supabase email/password sign-in, but does not yet hydrate or write the workout screens against the Supabase tables. Configure data services before using this for shared, cross-device production records. Invitation-only creation must also be enabled in Supabase Auth settings.
