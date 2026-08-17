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

# Account deletion, route 2 of 2 (optional if migration 0005 is applied —
# see "Deleting an account" below). Uses the supported admin API.
npx supabase functions deploy delete-account --project-ref <ref>

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

## Deleting an account

Removing an `auth.users` row needs privileges the browser's publishable key
never has, so "Delete my account" in Settings needs one of two things to exist
server-side. The client tries them in this order and stops at the first that
works:

1. **`public.delete_account()`** — `supabase/migrations/0005_delete_account.sql`.
   A `security definer` function that deletes `auth.users where id = auth.uid()`.
   It takes no arguments, so a caller can only ever delete themselves. Applying
   it needs nothing but SQL Editor access, which is why it goes first.
2. **The `delete-account` Edge Function** — the supported admin-API route, but
   deploying it needs a management access token.

Either way everything else goes by `ON DELETE CASCADE`: profile, classes,
friendships (both directions), extraction log, and the auth-side sessions and
identities.

Route 1 depends on the function's owner being able to delete from `auth.users`.
That is true for `postgres`, which is what the SQL Editor and `db push` run as,
but check before relying on it:

```sql
select has_table_privilege('postgres', 'auth.users', 'DELETE') as can_delete;
```

If that comes back `false`, deploy the Edge Function instead. When neither is
in place the button reports a generic failure and logs both underlying errors
to the browser console.

## Comparing

Two entry points, on purpose:

- `/compare/:username` — the original 1:1 view. Two lanes, full class names,
  shared classes spanning the full width.
- `/compare?with=alice,bob` — up to `MAX_GROUP_FRIENDS` (5) friends plus you.
  The selection lives in the query string so back steps through it and a group
  is shareable as a link. Usernames in `with=` that are not accepted friends
  are dropped: their classes come back empty under RLS, which would make the
  group look freer than it is.

Six lanes on a phone leaves ~50px each, so the group grid leads with the
summary — everyone-free windows and classes in common — and treats the grid as
a shape you tap into rather than read. Anyone in the group with no saved
schedule is called out explicitly, because "no classes" and "free all week"
are the same thing to `computeGroupFree` and only one of them is true.

## Legal pages

`/privacy` and `/terms` render **outside** `MobileOnly` and outside
`AuthProvider` (see `src/App.tsx`) — a policy you cannot open on a laptop, or
before you have an account, is not much of a policy. Both are linked from
Settings.

They ship with deliberate placeholders. Before launch, replace
`OPERATOR_NAME`, `CONTACT_EMAIL` and `JURISDICTION` in
`src/features/legal/LegalLayout.tsx` and bump `LAST_UPDATED`.

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
