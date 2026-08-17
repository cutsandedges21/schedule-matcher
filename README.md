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

  This list is checked on the way *back*, not on the way out: an origin that is
  missing still gets you a normal Google sign-in page, and only then does the
  callback quietly redirect to the Site URL instead of where you started. It
  reads as "Google sign-in is broken" rather than as a config problem. If Vite
  ever prints `Port 5173 is in use, trying another one`, you are on 5174 and
  will hit exactly this — add the ports you actually use, or kill the stray
  server.

Sign-in passes `prompt=select_account` (`src/features/auth/LoginPage.tsx`).
Without it, signing out and tapping "Continue with Google" lands you straight
back in the account you just left: our session is gone, but Google's cookie is
not, so Google silently re-authorises its one signed-in user. On a shared
phone that makes a second account unreachable.

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

## School themes

Students pick their college in Settings and the app's accent colour follows —
Vanier red, Dawson blue, and so on. The table lives in `src/domain/schools.ts`
and is the only place to touch when adding a college; the id format check in
migration `0006_school.sql` is duplicated there as `SCHOOL_ID_PATTERN`, and
`schools.test.ts` asserts they agree, so the picker can never offer an id the
database refuses.

The colour reaches the UI as CSS custom properties (`--accent`,
`--accent-strong`, `--accent-soft`, `--accent-fg`) written onto `:root` by
`SchoolThemeEffect`, which Tailwind exposes as the `accent` colour family
(`bg-accent`, `text-accent-fg`, …). Never build these class names by
interpolation — the JIT scanner cannot see them and silently drops the styles,
which is the same trap documented in `src/domain/color.ts`.

Two colours are deliberately darker than the colleges' real brand values:
Champlain's teal and LaSalle's orange both fail (or barely scrape) WCAG AA
against white button text. `schools.test.ts` enforces 4.5:1 for every school,
so a new college with a pretty-but-illegible hex fails the suite.

**Class blocks in the schedule grid are not themed.** Their colours come from
`colorForClass()`, a hash of the class name, so the same course is the same
colour for every student — which is the whole mechanism that makes shared
classes obvious in the compare view. Theming them would break comparison.

Accent-only, by design: primary buttons, the active nav tab, the intro
progress bar, and the Settings swatches. A friend's school shows as a chip in
*their* colours (`SchoolChip`), while the app chrome stays on yours.

## Onboarding intro

Onboarding opens with a three-beat sequence — text plus image, each fading in,
holding, and fading out — that plays itself and then moves on to the install
step (`src/features/auth/AboutIntro.tsx`).

**There are no controls.** No next, no back, no skip, and tapping does
nothing; a hairline progress bar at the top is the only affordance. That is
deliberate, and it is why `slideshow.test.ts` asserts that `advance()` always
terminates and that the whole sequence stays under 12 seconds — with no escape
hatch, a beat that never ends is a student stuck on the first screen of the
app. Pace lives in `BEAT_TIMING` in `src/domain/slideshow.ts` (currently
8.85s end to end).

It runs once per account by construction: onboarding only mounts when the
signed-in user has no `profiles` row, and finishing it creates one. No flag,
nothing to keep in sync.

`prefers-reduced-motion: reduce` swaps the keyframes for an opacity-only
crossfade at the same pace (see the bottom of `src/index.css`).

`public/about/team-placeholder.svg` is a **placeholder** and says so on its
face. Replace it with a real photo of the team before launch.

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

Onboarding runs **intro → install → username**. The "add to home screen"
instructions (`src/components/InstallInstructions.tsx`) come *before* the
username so a student who follows them is running from their home screen by
the time they pick a name, instead of typing it into Safari and then being
asked to move. The step is skipped for anyone already running from an icon.

One consequence worth knowing: on iPhone a home-screen app gets its own
storage container, separate from Safari's, so a student who installs at this
step and switches over arrives **signed out** and finishes onboarding in the
installed app — including replaying the intro. The step says so in as many
words rather than letting it read as a bug. Android shares storage with
Chrome, so it does not happen there.

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
