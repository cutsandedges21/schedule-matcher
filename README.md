# Schedule Matcher

Upload a screenshot of your class schedule, correct anything the reader misses,
and share a real weekly schedule with friends.

## Setup

```bash
npm install
cp .env.local.example .env.local   # fill in your Supabase URL and anon key
npm run dev
```

## Supabase

Apply the migrations in `supabase/migrations/` in numeric order — either via
`npx supabase db push`, or by pasting them into the dashboard SQL Editor.

```bash
export SUPABASE_ACCESS_TOKEN=sbp_...          # account/tokens in the dashboard

# Vision keys. GEMINI_API_KEYS is a comma-separated pool: the Edge Function
# tries each in turn and advances only on a 429, so one key hitting its
# free-tier daily cap at term start does not take extraction down.
npx supabase secrets set --project-ref <ref> GEMINI_API_KEYS=key1,key2,key3
npx supabase functions deploy extract-schedule --project-ref <ref>

# Prove a non-friend cannot read another student's schedule. Run this after
# ANY change to a policy or to are_friends.
node scripts/run-sql.mjs <ref> supabase/tests/rls_check.sql
```

`scripts/run-sql.mjs` goes through the Management API, so it needs only the
access token — no database password and no local `psql`.

### Google auth

Two different URL settings, and conflating them is the usual cause of a broken
sign-in:

- **Google Cloud → Credentials → Authorized redirect URIs** must be the
  *Supabase* callback, `https://<ref>.supabase.co/auth/v1/callback`. This never
  changes.
- **Supabase → Auth → URL Configuration → Redirect URLs** are your *app*
  origins. Sign-in preserves the path the user was trying to reach (so invite
  links survive OAuth), which means these need the `/**` wildcard:
  `http://localhost:5173/**`, `https://<app>.vercel.app/**`.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm test` | Domain unit tests |
| `npm run build` | Type check and production build |
| `npm run icons` | Redraw the home-screen icons in `public/` |
| `node scripts/run-sql.mjs <ref> <file.sql>` | Run SQL via the Management API |

## Phones only

Anything wider than 639px (`ABOVE_MOBILE_QUERY` in `src/domain/viewport.ts`)
gets `DesktopNotice` instead of the app — the grid, the day chips and the
compare view are all laid out for a phone. There is no exemption for a phone
held in landscape; the notice asks those students to rotate back.

The notice offers a "Continue on this screen anyway" escape hatch, kept in
`sessionStorage` so it lasts one browsing session and no longer. Delete the
button in `DesktopNotice` if you want the wall to be absolute.

## Home-screen install

Onboarding ends on "add to home screen" instructions for both iPhone and
Android (`src/components/InstallInstructions.tsx`), skipped for anyone already
running from a home-screen icon.

On Android, Chrome fires `beforeinstallprompt` when the page qualifies as
installable. `src/lib/installPrompt.ts` catches that event at startup — before
onboarding mounts, since it only fires once — and onboarding turns it into a
one-tap install button. Qualifying needs all of `public/manifest.webmanifest`,
the PNG icons, and HTTPS; iOS ignores the manifest entirely and reads the
`apple-*` tags in `index.html` instead.

The icons are drawn by `npm run icons` (no image dependency — it writes PNGs
straight from `node:zlib`) and the output is committed, so builds never need
to run it.

## Docs

- Design: `docs/superpowers/specs/2026-08-16-schedule-matcher-design.md`
- Plan: `docs/superpowers/plans/2026-08-16-schedule-matcher.md`
