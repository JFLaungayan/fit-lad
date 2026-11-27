# Form Fitness

Mobile-first workout tracker built with React, TypeScript, Vite, Tailwind, Supabase Auth, PostgreSQL, Recharts, and Lucide.

## Run locally

```sh
npm install
npm run dev
```

Without Supabase credentials, the app supports local sign-up and sign-in for trying the interface. Accounts and workout data remain in that browser only; they do not sync to another device.

## Supabase setup

1. Create a Supabase project and run the migrations in `supabase/migrations/` in filename order.
2. In Supabase Auth settings, enable email/password sign-ups and choose whether new users need email confirmation.
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to `.env.local`. The legacy `VITE_SUPABASE_ANON_KEY` is also accepted. Never put a Supabase secret/service-role key in a `VITE_` variable.

The migrations enable RLS so users can read and change only their own routines, schedules, and workout data. Session exercise names and target details are stored as snapshots so later plan edits do not rewrite history. The app now loads and saves normalized workout records to Supabase after sign-in.

## Deployment

Deploy the Vite app to Vercel and set the same environment variables. `public/manifest.webmanifest` supplies the installable PWA metadata. Configure Supabase Auth's site URL and redirect URLs for the deployed origin.

## Current limitations

Without Supabase credentials, local accounts and workout records stay in the browser. With Supabase configured, authentication and workout records are stored in Supabase and follow the account across devices.
