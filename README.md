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
| `node scripts/run-sql.mjs <ref> supabase/analytics/phase0.sql` | The Phase 0 monetization numbers |

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

## Phase 0 analytics

`app_events` (migration `0009`) plus the existing `extraction_log` answer the
four questions in §6 of `docs/superpowers/specs/2026-08-17-monetization-design.md`.
Read them all at once with:

```bash
node scripts/run-sql.mjs <ref> supabase/analytics/phase0.sql
```

The load-bearing one is the distribution of **group compare sizes**. January's
paid tier is priced on what share of students would have hit a two-friend cap,
and you cannot measure demand for a wall that does not exist — so group compare
stays free to all five this term and the size is recorded instead.

Three things about the table are easy to undo by accident:

- **It stores counts, not relationships.** A row says "this student looked at a
  group of four" and never who the four were. Holding more would turn a
  counting table into a map of who hangs out with whom.
- **There is no `select` policy, deliberately.** Students cannot read the table
  at all; it is read through the Management API, which connects as `postgres`
  and bypasses RLS. The consequence is that the client must never chain
  `.select()` onto the insert — PostgREST would need SELECT to return the row,
  and every write would 401 silently. Both `src/lib/analytics.ts` and the
  migration header say so.
- **Logging never breaks the app.** Every call in `src/lib/analytics.ts` is
  fire-and-forget and swallows its errors, so the client runs fine before the
  migration is applied and when an ad blocker eats the request.

Group size is logged on a `GROUP_LOG_SETTLE_MS` debounce and only once the grid
has rendered. The selection lives in the query string and changes on every tap,
so eager logging would record 1, then 2, then 3 as a student assembles a group
of three — inflating precisely the small sizes the cap question turns on.

Term boundaries live in `src/domain/terms.ts` (winter Jan–May, summer Jun–Jul,
fall Aug–Dec) and are duplicated in `phase0.sql`, which cannot import them.
`terms.test.ts` pins the numbers so the two cannot drift unnoticed. Both sides
read Montreal local time, not UTC — a term ticks over at midnight where the
student is.

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

## Profile cosmetics

Students pick a card colour in Settings and it paints **their** card on their
friends' Friends page — the plain white box otherwise. The presets live in
`src/domain/cosmetics.ts`, the only place to touch when adding one; the id
format check in migration `0007_cosmetic.sql` is duplicated there as
`COSMETIC_ID_PATTERN`, and `cosmetics.test.ts` asserts they agree, exactly as
schools do.

A curated preset list rather than a colour picker: presets are contrast-tested
in CI, cannot be set to white-on-white, and keep the app looking like one app.

Applied with **inline styles** in `FriendCard.tsx`, for the same two reasons as
`SchoolChip` — the `accent` Tailwind family holds the *viewer's* school, and a
friend's colours must not repaint the viewer's chrome; and class names are
never built by interpolation. A friend with no cosmetic, or one storing a
preset since retired, renders today's plain card unchanged.

Backgrounds are all deliberately **light**. A friend card carries a `SchoolChip`
too — dark `accentStrong` text on a light `accentSoft` tint — and the two tints
sit within a shade of each other, so on a themed card the chip's pill
effectively disappears and the card itself ends up carrying the chip's text.
`cosmetics.test.ts` states that as the rule: every school's `accentStrong` must
clear 4.5:1 against every cosmetic background, which floors background
luminance around 0.61. A pretty-but-dark preset fails the suite.

Not shown in friend search or pending requests, on purpose — those are lists of
people you have not connected to yet, and the school chip is already scoped the
same way. The data is there via `PROFILE_COLUMNS` if that call is reversed.

### Banners and effects

Two more slots, added by migration `0008_banner_effect.sql`: a `banner` (an
animated gradient strip, `src/domain/banners.ts`) and an `effect` (animated
marks below it, `src/domain/effects.ts`). All three slots are independent and
may be null in any combination; the two do not co-ordinate, so a green effect
under a red strip is allowed.

An effect preset bakes **shape and colour together** — `Downpour` is rain in
tide blue, and there is no second rain a shade away. One colour per shape,
asserted in `effects.test.ts`: two near-identical presets are not two products,
they are one product and a support question.

Both bands are fixed-height boxes in **normal flow**, never overlays, and they
clip their own contents. That single fact is why nothing in `effects.ts` needs
a contrast rule against the card's text — a mark cannot reach the username, so
there is no pairing to measure — and it is what stops an effect spilling onto
the friend in the row below. The slot previously held a dripping-slime effect
that drew `#2B9540` green behind `#6B5320` brown at **2.4:1**; it stayed legible
only because the band could not reach the text. Make the band absolute and that
protection is gone.

Effect colours are held to **3:1** against white and every cosmetic background,
not 4.5:1 — the WCAG bar for a non-text graphic (1.4.11), since the marks are
decoration and carry no information. The test exists to catch a preset that is
simply invisible on the card it lands on.

The travelling keyframes (`effect-rain`, `effect-bubble` in `src/index.css`)
are tuned to reach opacity 0 exactly at `EFFECT_BAND_PX`. Change the band
height without retuning them and marks get sliced in half at full opacity
instead of fading out. Sparkles never travel, so they are exempt.

`prefers-reduced-motion: reduce` stops all of it. The travelling marks are
hidden rather than frozen — a rain streak parked halfway down the band reads as
a rendering artefact, where a still sparkle reads as a star, so sparkles hold
their bright pose instead.

While cosmetics are in private beta the pickers are limited to the accounts in
`src/domain/beta.ts`. **That hides the UI and nothing more** — `profiles_update`
still permits the write from any account. Rendering is deliberately ungated: an
effect only has value because other people see it.

**`profiles.cosmetic` is client-writable.** `profiles_update` lets a student set
any column on their own row, which is what makes cosmetics free to everyone
today. When they move behind the paid Pass this column has to be locked —
revoke column-level update on `profiles(cosmetic)` from `authenticated`, and
write it through a trigger or a security-definer setter that checks the Pass.
Nothing in the app performs an entitlement check.

## Onboarding intro

After the install step comes a three-beat sequence — text plus image, each
fading in, holding, and fading out — that plays itself and then moves on to the
username step (`src/features/auth/AboutIntro.tsx`).

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

Onboarding runs **install → intro → username**. The "add to home screen"
instructions (`src/components/InstallInstructions.tsx`) come first so that
everything after them happens in the app the student is actually going to keep
using. The step is skipped for anyone already running from an icon, who starts
at the intro instead.

The reason install leads rather than merely preceding the username: on iPhone a
home-screen app gets its own storage container, separate from Safari's, so a
student who installs and switches over arrives **signed out** and finishes
onboarding in the installed app. When the intro ran first, that meant watching
the whole nine-second sequence in Safari and then watching it again in the app.
Leading with install means they see it once, in the right place. The step says
the sign-in is coming in as many words rather than letting it read as a bug.
Android shares storage with Chrome, so it does not happen there.

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
