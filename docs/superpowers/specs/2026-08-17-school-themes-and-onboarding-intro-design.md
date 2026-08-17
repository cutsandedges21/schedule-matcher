# School themes + onboarding intro sequence

Date: 2026-08-17

Two independent features that share one theme: making the app feel like it
belongs to the student using it.

1. **School themes** — pick your CEGEP in Settings, the app's accent colour
   becomes your school's.
2. **Onboarding intro** — an auto-playing three-beat sequence that opens
   onboarding, explaining the problem and who built this.

---

## 1. School themes

### 1.1 What a school is

`src/domain/schools.ts` is the single source of truth. It lives in `domain/`
rather than `features/` because that is the directory the vitest config already
covers (`environment: 'node'`, `include: src/**/__tests__/**/*.test.ts`), and
the colour table is exactly the kind of thing worth a test.

```ts
export interface School {
  /** Stored verbatim in profiles.school. Must match /^[a-z0-9-]{2,32}$/. */
  id: string;
  name: string;
  /** Base accent. Primary buttons, active nav tab, progress bar fill. */
  accent: string;
  /** Pressed state. Hand-picked, not computed. */
  accentStrong: string;
  /** Light tint. Swatch rings, school chips. */
  accentSoft: string;
  /** Text/icon colour drawn on top of `accent`. */
  accentFg: string;
}
```

### 1.2 The roster

| id | Name | accent | accentStrong | accentSoft | accentFg | contrast on accent |
|---|---|---|---|---|---|---|
| `default` | No school | `#0F172A` | `#334155` | `#F1F5F9` | `#FFFFFF` | 17.9:1 |
| `vanier` | Vanier College | `#C8102E` | `#A00D24` | `#FDECEF` | `#FFFFFF` | 5.9:1 |
| `dawson` | Dawson College | `#005EB8` | `#004A93` | `#E8F1FB` | `#FFFFFF` | 6.4:1 |
| `john-abbott` | John Abbott College | `#2E7D46` | `#246337` | `#E9F4ED` | `#FFFFFF` | 5.1:1 |
| `marianopolis` | Marianopolis College | `#5B2D8E` | `#46226E` | `#F0EAF7` | `#FFFFFF` | 9.5:1 |
| `champlain` | Champlain College | `#006B65` | `#00544F` | `#E5F2F1` | `#FFFFFF` | 6.4:1 |
| `lasalle` | LaSalle College | `#B84204` | `#953603` | `#FCEDE6` | `#FFFFFF` | 5.5:1 |

`default` reproduces today's look exactly — `bg-slate-900` with
`active:bg-slate-700` — so a user who never touches the picker sees no change.

Two colours were deliberately darkened from the schools' literal brand values
to clear WCAG AA (4.5:1) with white text: Champlain's teal (`#00857D` measures
4.51:1, too close to the line to trust) and LaSalle's orange (`#E35205`
measures 3.84:1 and genuinely fails). Brand fidelity loses to legibility on a
phone in daylight.

All four shades are explicit hex constants. No `color-mix()` — Safari only
shipped it in 16.2, and this is a phone-first app.

### 1.3 How the colour reaches the UI

CSS custom properties, never interpolated Tailwind class names. `color.ts:16`
already documents why the latter breaks: the JIT scanner cannot see a class
name built by string concatenation and silently drops the style.

**`src/index.css`** declares the `default` school's values on `:root`, so the
app renders correctly before any profile has loaded and on `/login`, which
sits outside the authenticated tree entirely:

```css
:root {
  --accent: #0F172A;
  --accent-strong: #334155;
  --accent-soft: #F1F5F9;
  --accent-fg: #FFFFFF;
}
```

**`tailwind.config.js`** maps those to a colour family:

```js
colors: {
  accent: {
    DEFAULT: 'var(--accent)',
    strong: 'var(--accent-strong)',
    soft: 'var(--accent-soft)',
    fg: 'var(--accent-fg)',
  },
}
```

Bare `var()` (rather than the `rgb(... / <alpha-value>)` form) means opacity
modifiers like `bg-accent/50` will not work. Nothing in this design needs one.

**`src/domain/schools.ts`** exports the pure half:

```ts
/** Unknown or null id falls back to `default` — never throws, never blanks. */
export function schoolById(id: string | null | undefined): School;

/** The CSS custom-property map for a school. Pure, therefore testable. */
export function themeVariables(school: School): Record<string, string>;
```

**`src/features/theme/SchoolThemeEffect.tsx`** is the impure half: a
render-nothing component mounted inside `AuthProvider` that watches
`profile?.school`, writes `themeVariables()` onto `document.documentElement`,
and syncs `<meta name="theme-color">` so the Android URL bar and the iOS PWA
status bar match the school.

### 1.4 Where the accent actually appears

Accent-only, by decision. Four places:

- **`Button`**, `primary` variant: `bg-accent text-accent-fg
  active:bg-accent-strong`. `disabled:bg-slate-400` stays slate on purpose —
  a disabled button tinted with the school colour reads as enabled-but-odd.
- **`BottomNav`**, active tab: `text-accent` (inactive stays `text-slate-400`).
- **Onboarding intro** progress hairline fill.
- **Settings** school swatches and the selected-row ring.

**Explicitly not themed: the class blocks in the schedule grid.** Their
colours come from `colorForClass()`, a hash of the normalised class name, so
that the same course gets the same colour for every student with no
coordination — which is the entire mechanism that makes shared classes
visually obvious in the compare view. Theming them would break comparison.

### 1.5 Storage

`supabase/migrations/0006_school.sql`:

```sql
alter table public.profiles add column school text;

alter table public.profiles add constraint profiles_school_format
  check (school is null or school ~ '^[a-z0-9-]{2,32}$');
```

A format check, not an enum or a foreign key to a schools table. Adding a
seventh school should be a one-line code change, not a migration. `null` means
no school chosen and maps to `default`.

No RLS change. `profiles_select` is already `for select to authenticated using
(true)` so that username search works, and a school name is no more sensitive
than the username sitting next to it.

### 1.6 Prerequisite cleanup: `PROFILE_COLUMNS`

The select list `'id, username, display_name, avatar_url, invite_code'` is
duplicated verbatim in five places:

- `src/features/auth/AuthProvider.tsx:51`
- `src/features/friends/useFriends.ts:133` and `:145`
- `src/features/friends/FriendSchedulePage.tsx:31`
- `src/features/compare/ComparePage.tsx:41`

Adding a column means editing all five and getting all five right; miss one
and that screen silently sees `school: undefined`, i.e. an untinted chip with
no error anywhere. Extract `PROFILE_COLUMNS` into `src/domain/mappers.ts`
alongside `ProfileRow` — the two are already the same fact stated twice — and
have all five call sites use it. Do this **before** adding `school`, so the
new column lands in exactly one place.

Scope is limited to that one constant. No other refactoring.

### 1.7 Settings UI

A new "School" section above the existing "About" list, matching its visual
language (`rounded-2xl border border-slate-200 bg-white`, `min-h-touch` rows):

- One row per school: a filled colour dot, the school name, and a checkmark
  on the selected row.
- Radio semantics (`role="radiogroup"` on the list, `aria-checked` per row) so
  it is announced correctly.
- Tapping saves immediately via `profiles.update({ school })` and calls
  `refreshProfile()`.
- **Optimistic**: the theme flips on tap. On failure, revert to the previous
  selection and show an inline error in the section. No modal, no toast
  infrastructure — this app has neither.

### 1.8 Friends see your school

With `school` in `PROFILE_COLUMNS`, a small chip (colour dot + short school
name) renders on:

- friend rows in `FriendsPage`
- the header of `FriendSchedulePage`

Chips use the *other* student's school colour. The app chrome always stays on
*your* accent — viewing a Dawson friend's schedule must not repaint your app
blue, which would be disorienting and make "whose screen am I on" ambiguous.

Profiles with `school = null` render no chip at all.

---

## 2. Onboarding intro sequence

### 2.1 Shape

`OnboardingPage`'s `step` state goes from `'username' | 'install'` to
`'intro' | 'username' | 'install'`, starting at `'intro'`.

Three **beats**. Each is one line of text plus one image. A beat fades and
rises in, holds, then fades and rises out; the next takes its place. After the
third beat exits, the sequence advances to the username step on its own.

**There are no controls.** No next, no back, no dots, no skip, and tapping does
nothing. The sequence plays start to finish. This is deliberate: the point is
that every new user actually reads the pitch.

### 2.2 Timing

One table in `src/domain/slideshow.ts` so the pace is tunable in a single
place:

| Phase | Duration |
|---|---|
| enter — fade in + 12px rise | 400ms |
| hold | 2200ms |
| exit — fade out + 12px rise | 350ms |

2950ms per beat, **8850ms** for the full sequence.

Under `prefers-reduced-motion: reduce` the translate is dropped and beats
crossfade on opacity alone. Durations are unchanged — the sequence still
auto-advances at the same pace.

### 2.3 Progress hairline

A 2px, three-segment bar pinned to the very top of the screen. The segment for
the current beat fills left-to-right over that beat's full duration; completed
segments stay filled; upcoming segments sit at `bg-slate-200`. Fill colour is
`bg-accent`.

It is not a control — it cannot be tapped and carries `aria-hidden`. Its only
job is to tell someone with no skip button that this is finite and roughly how
much is left.

### 2.4 The beats

1. **The problem.** *"Everyone's schedule is a different screenshot."*
   Overlapping screenshot cards with chat bubbles — "when r u free", "wait send
   yours again", "r u done at 3".
2. **The fix.** *"Upload yours once. See where you overlap."*
   A small week grid with one shared free window lit up.
3. **Who we are.** *"We're students who got tired of that."*
   Team photo placeholder.

Exact copy is finalised during implementation; the beat count, order and
subject matter are fixed here.

### 2.5 Assets

`public/about/problem.svg`, `public/about/overlap.svg`,
`public/about/team-placeholder.svg`.

Hand-written SVG, committed. The team one visibly reads "team photo goes
here" so a forgotten swap is obvious in the app rather than a broken-image
icon. README gains a line naming the file to replace.

### 2.6 Why no seen-flag

Onboarding only mounts when the signed-in user has no `profiles` row
(`RequireAuth`). Finishing onboarding creates that row. The sequence is
therefore once-per-account by construction — no extra column, no
localStorage key, nothing to keep in sync.

### 2.7 Split for testability

`src/domain/slideshow.ts` (pure, node-env testable):

```ts
export type BeatPhase = 'enter' | 'hold' | 'exit';
export interface Beat { text: string; image: string; alt: string }

export const BEAT_TIMING: Record<BeatPhase, number>;
export const ABOUT_BEATS: readonly Beat[];

/** Next (index, phase), or null when the sequence is over. */
export function advance(
  index: number,
  phase: BeatPhase
): { index: number; phase: BeatPhase } | null;

/** 0..1 progress through a given segment, for the hairline. */
export function segmentProgress(phase: BeatPhase, elapsed: number): number;
```

`src/features/auth/AboutIntro.tsx` is then a thin renderer: a `useEffect`
timeout chain driving `advance()`, and Tailwind transition classes keyed off
the current phase. It calls an `onDone` prop; `OnboardingPage` passes
`() => setStep('username')`.

---

## 3. Testing

New pure-domain tests, matching the existing `src/domain/__tests__/` setup.

**`schools.test.ts`**
- Every school has four colours, each a valid `#RRGGBB`.
- Ids are unique and every id matches `/^[a-z0-9-]{2,32}$/` — the same regex
  the migration's check constraint enforces, so code and schema cannot drift.
- `schoolById(null)`, `schoolById(undefined)` and `schoolById('deleted-school')`
  all return `default`. A school removed from the code must not white-screen
  someone whose profile still stores it.
- **Contrast:** relative luminance of `accentFg` against `accent` is ≥ 4.5:1
  for every school. This is what catches a bad hex before it ships.
- `themeVariables()` returns exactly the four `--accent*` keys with the
  school's values.

**`slideshow.test.ts`**
- `ABOUT_BEATS` has three entries, each with non-empty `text`, `image` and
  `alt`.
- Every `image` path starts with `/about/`.
- `advance()` walks the full sequence and terminates — starting at
  `(0, 'enter')` and iterating reaches `null` in a bounded number of steps,
  visiting each beat's three phases in order. This is the guard against an
  intro that traps a user forever, which matters more than usual given there
  is no skip.
- Total runtime (`3 × sum(BEAT_TIMING)`) stays under a 12s ceiling.
- `segmentProgress()` is 0 at the start of `enter` and 1 at the end of `exit`,
  and monotonic in between.

**Manual verification**, at phone width in a real browser:
- The intro plays end to end and lands on the username step by itself.
- Picking each school in Settings repaints buttons and the active nav tab, and
  survives a reload.
- A friend with a school set shows a chip; one without shows nothing.
- `npm test` and `npm run build` both pass.

---

## 4. Deferred — revisit after this ships

**Move the install instructions earlier in onboarding.** Today the order is
intro → username → install. Putting install first would mean a student is
running from the home-screen icon before they have typed anything, so the
username they pick is entered in the installed app rather than in Safari — no
"where did my progress go" when they switch. Untested and out of scope here;
flagged for a follow-up.
