# Handoff prompt — friends-list cosmetics (test build)

Paste everything below the line into a fresh Claude Code session opened in
`schedule-matcher/`.

---

## Task

Build a **testable MVP of profile cosmetics** in this repo. A student picks a
cosmetic in Settings, and **their friends see it applied to their card on the
Friends page**, in place of today's plain white box.

This is the visual and data plumbing only, so I can verify it with two test
accounts.

### Explicitly out of scope

- **No Stripe, no payments, no paywall, no entitlement check.** Cosmetics are
  free to everyone for now. This is deliberate — it ships behind a paid Pass in
  January, but I need to see and test it first.
- Do not touch `colorForClass()` or class-block colours in the schedule grid.
  Those are hashed from the course name so the same class is the same colour
  for every student, which is the entire mechanism that makes shared classes
  visible in compare view. Theming them would break comparison.

## Context

Mobile-first Vite + React 19 + TS + Tailwind SPA on Supabase. Students upload a
class-schedule screenshot, Gemini extracts it, they correct it, it renders as a
weekly grid, and friends compare schedules. Supabase project ref
`sjsywoptzbugfiqisdhh`.

**Read `README.md` first** — it documents the traps in this codebase, several
of which apply directly here.

## Work

### 1. Migration `supabase/migrations/0007_cosmetic.sql`

Mirror `0006_school.sql` exactly — read it first, it is the template, including
the habit of explaining *why* in a header comment.

```sql
alter table public.profiles add column cosmetic text;

alter table public.profiles add constraint profiles_cosmetic_format
  check (cosmetic is null or cosmetic ~ '^[a-z0-9-]{2,32}$');
```

**No RLS change is needed.** `profiles_select` is already
`for select to authenticated using (true)` so username search works — a
cosmetic id is no more sensitive than the username beside it. Say so in the
comment, as `0006_school.sql` does.

Applying it: `node scripts/run-sql.mjs sjsywoptzbugfiqisdhh supabase/migrations/0007_cosmetic.sql`,
which needs `SUPABASE_ACCESS_TOKEN` exported. **Neither the Supabase MCP nor
the logged-in `npx supabase` CLI can reach this project ref** — don't burn time
retrying them. If the token isn't set, ask me for it or tell me to paste the
SQL into the dashboard SQL editor.

### 2. `src/domain/cosmetics.ts`

Mirror `src/domain/schools.ts` in structure and in commenting style.

```ts
export interface Cosmetic {
  /** Stored verbatim in profiles.cosmetic. Must match COSMETIC_ID_PATTERN. */
  id: string;
  name: string;
  /** Friend-card background. */
  background: string;
  /** Friend-card border. */
  border: string;
  /** Username and display name drawn on `background`. */
  fg: string;
}

/** The same pattern `profiles_cosmetic_format` enforces (migration 0007). */
export const COSMETIC_ID_PATTERN = /^[a-z0-9-]{2,32}$/;

export const COSMETICS: readonly Cosmetic[] = [/* 6–10 presets */];

export function cosmeticById(id: string | null): Cosmetic | null;
```

**A curated preset list, not a colour picker.** Presets can be contrast-tested
in CI, cannot be set to white-on-white, keep the app's visual identity intact,
and let me drip-feed a new one each term. Six to ten is plenty.

Keep backgrounds **light**. The card carries a `SchoolChip` rendered in dark
text on a light tint, and a dark cosmetic background would swallow it.

### 3. `src/domain/__tests__/cosmetics.test.ts`

Mirror `schools.test.ts`. Assert:

1. Every id satisfies `COSMETIC_ID_PATTERN` — this is what stops the picker
   offering an id the check constraint rejects.
2. Ids are unique.
3. `fg` on `background` clears **4.5:1** (WCAG AA). `schools.test.ts` already
   does this for schools; reuse the same contrast helper.
4. Every school's `accentSoft` chip stays legible on every cosmetic
   `background` — the two render on the same card. Pick a documented rule
   (e.g. a minimum luminance floor for backgrounds) and comment why.

### 4. Profile plumbing — four edits, all in lockstep

This is the step most likely to go wrong. The comment on `PROFILE_COLUMNS` in
`src/domain/mappers.ts` spells out why: the column list is embedded twice
inside the `requester:profiles!…()` / `addressee:profiles!…()` joins in
`useFriends.ts`, which a grep for `from('profiles')` does not surface. **Miss a
site and it fails silently** — the screen just sees `undefined`, with no error
anywhere.

- `ProfileRow` (`mappers.ts`) → add `cosmetic: string | null`
- `PROFILE_COLUMNS` (`mappers.ts`) → append `, cosmetic`
- `rowToProfile` (`mappers.ts`) → map `cosmetic: row.cosmetic`
- `Profile` (`src/domain/types.ts`) → add `cosmetic: string | null`

Done correctly, this propagates automatically to `useFriends`,
`searchProfiles`, and `findProfileByInviteCode`.

### 5. Render it on the friend card

Today, `FriendsPage.tsx` line ~101:

```tsx
<li className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
```

Apply the cosmetic with **inline styles**, following the precedent in
`src/features/theme/SchoolChip.tsx`. Two reasons, both already documented in
this codebase:

1. These are *another student's* colours. The Tailwind `accent` family holds
   the **viewer's** school, and repainting the viewer's chrome in a friend's
   colours makes "whose screen am I on" genuinely ambiguous. `SchoolChip` uses
   inline styles for exactly this reason.
2. **Never build Tailwind class names by interpolation.** The JIT scanner
   cannot see them and silently drops the styles — see `src/domain/color.ts`
   and the README.

Keep the Tailwind classes for layout; override only `backgroundColor` and
`borderColor` when a cosmetic is set. **A null cosmetic must render exactly
today's look** (`bg-white`, `border-slate-200`) with no visual change.

`FriendsPage.tsx` is already long — extract a `FriendCard.tsx` rather than
growing it further.

### 6. Settings picker

Mirror the existing school picker in Settings: a row of swatches, current
selection ringed, plus a "None" option. Saves to `profiles.cosmetic` through
the existing `profiles_update` policy (a user may update their own row).

## How I'll test it

Two accounts, which **must be accepted friends** — send a request from A,
accept on B.

1. Account A: Settings → pick a cosmetic.
2. Account B: Friends page → A's card renders with it.
3. Set A back to None → card returns to plain white.

Notes:

- The app blocks anything wider than 639px (`ABOVE_MOBILE_QUERY` in
  `src/domain/viewport.ts`). Use device emulation, or the "Continue on this
  screen anyway" escape hatch in `DesktopNotice`.
- Easiest two-account setup on iPhone: on iOS a home-screen PWA gets its own
  storage container separate from Safari's, so sign in as A in the installed
  app and B in Safari.
- **You cannot drive Google OAuth from an agent session** — I do the browser
  testing by hand. Tell me what to click.
- Decide and tell me whether the cosmetic should also show in friend **search
  results** and **pending requests**. They share `PROFILE_COLUMNS` so it's
  nearly free, and showing it there advertises the feature — but it may be
  noise. Your call, just flag it.

## Known traps

1. `SUPABASE_ACCESS_TOKEN` is likely unset and the MCP/CLI cannot reach this
   project. Ask rather than retry.
2. Missing a `PROFILE_COLUMNS` site fails **silently**.
3. Never interpolate Tailwind class names.
4. **`profiles_update` lets any user set their own `cosmetic` from the
   client.** That's convenient for this test and correct for now — but note it
   in a comment, because once cosmetics sit behind the paid Pass the column
   must be locked (revoke column-level update from `authenticated`, plus a
   trigger or security-definer setter that checks the pass). Out of scope
   today; do not build it.
5. RLS policy expressions execute with the **querying role's** privileges, not
   the table owner's. Relevant if you touch policies at all — you shouldn't
   need to.

Run `npm test` and `npm run build` before telling me it's done.
