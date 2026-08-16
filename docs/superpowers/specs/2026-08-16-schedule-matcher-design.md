# Schedule Matcher — Design

**Date:** 2026-08-16
**Status:** Approved
**Repo:** https://github.com/cutsandedges21/schedule-matcher.git

## 1. Overview

Students upload a screenshot of their class schedule. A vision model extracts it into
structured JSON. The student corrects anything misread, confirms, and from then on their
schedule lives in the app as a real weekly grid — never as the original image. Students add
friends and view each other's schedules, and can overlay two schedules to see shared classes
and mutual free time.

The problem being solved is social, not organizational: nobody should have to ask "what's your
schedule again?" or dig through old texts for a screenshot.

**Target scale:** ~2000 users. This is small. Correctness and simplicity outrank performance
tuning everywhere in this document.

**Primary platform: mobile web.** Students will use this on their phones, standing in a
hallway. Phone layout is the design target; desktop is the enhancement.

## 2. Goals

- Google sign-in, one account per student, unique public username.
- Upload a schedule screenshot; get back structured classes.
- Review and edit extracted classes before anything is saved.
- Display the confirmed schedule as a weekly grid.
- Send, accept, and decline friend requests; discover friends by username search or invite link.
- View a friend's schedule.
- Overlay your schedule with a friend's: shared classes and mutual free time.

## 3. Non-goals (v1)

Explicitly out of scope. Each would be its own spec.

- Multiple terms or semesters. One active schedule per student; re-uploading replaces it.
- Group comparison across 3+ people.
- Notifications, push, or email.
- Blocking or reporting users.
- Calendar export (`.ics`), Google Calendar sync.
- Assignment tracking, grades, GPA, or anything academic beyond meeting times.
- Native apps.
- Rotating A/B day schedules and period-based schedules. v1 targets college-style weekly
  schedules where a class meets at a fixed clock time on fixed weekdays.

## 4. Stack and topology

| Layer | Choice | Reason |
|---|---|---|
| Build | Vite | Next.js dev is unusably slow inside this OneDrive-synced folder (30–90s/page). Vite is not affected. |
| UI | React 19 + TypeScript + Tailwind | Matches the existing `client-tracker-app` conventions. |
| Routing | `react-router-dom` v7 | Same as `client-tracker-app`. |
| Backend | Supabase — Auth, Postgres + RLS, one Edge Function | Auth, DB, and a server-side secret holder in one service. |
| Vision | Google Gemini Flash | Free tier available; genuinely multimodal. |
| Validation | Zod | Shared schema between Edge Function and client. |
| Tests | Vitest | Pure-logic coverage where the real bugs are. |
| Hosting | Vercel, static SPA | No server needed; the only server-side code is the Edge Function. |

The Gemini API key lives exclusively in Supabase Edge Function secrets. It is never present in
the client bundle.

### 4.1 Why not DeepSeek

DeepSeek's hosted API (`api.deepseek.com`) is text-only; it accepts no image input. The
vision-capable DeepSeek models (DeepSeek-VL2, Janus) are open weights requiring self-hosting,
which is far out of proportion to this project. DeepSeek keys are not useful here.

Gemini is reached through a one-function `VisionProvider` interface so that swapping to another
provider later is a contained change rather than a refactor:

```ts
interface VisionProvider {
  extractSchedule(image: { base64: string; mimeType: string }): Promise<RawExtraction>;
}
```

### 4.2 Free-tier rate limits

Gemini free-tier quotas are per-project and visible only in the AI Studio rate-limit dashboard.
Total lifetime volume here is trivial (~4000 extractions for 2000 students), but uploads will
bunch heavily at the start of a term and may hit a daily cap.

The design does not assume the quota holds. Every extraction failure path lands the student in
the same editable form they would have reached on success, pre-filled empty. **A throttled key
degrades the experience; it never blocks a student from having a schedule.**

## 5. Mobile-first design principles

These are requirements, not suggestions. Design target is 390×844 (iPhone 14/15).

**Breakpoints.** Base styles are mobile. `sm:` (640px) and `lg:` (1024px) add progressive
enhancement. No style is written desktop-first and then walked back.

**Navigation.** Fixed bottom tab bar on mobile — Schedule / Friends / Profile — sized for thumb
reach, respecting `env(safe-area-inset-bottom)` for the iPhone home indicator. At `lg:` this
becomes a top header.

**Touch targets.** Minimum 44×44 CSS px for every interactive element. Day-toggle chips, time
inputs, and request accept/decline buttons are the ones most at risk.

**iOS input zoom.** All form inputs use `font-size: 16px` minimum to prevent Safari's automatic
zoom-on-focus. `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`.
Pinch zoom is *not* disabled — that's an accessibility regression.

**Cellular budget.** Route-level code splitting via `React.lazy`. Target initial JS under 200 KB
gzipped. No animation library in v1 unless a specific interaction demands it.

**Colour is never the only signal.** Class blocks carry text labels; shared-class and
mutual-free states carry badges and icons, not just tint. Block colours meet 4.5:1 contrast
against their text.

## 6. Data model

Three domain tables plus one operational table. All timestamps `timestamptz default now()`.

```
profiles
  id            uuid PK, references auth.users(id) on delete cascade
  username      citext unique not null          -- 3-20 chars, [a-z0-9_]
  display_name  text
  avatar_url    text
  invite_code   text unique not null            -- short random, for share links
  created_at    timestamptz

classes
  id            uuid PK default gen_random_uuid()
  user_id       uuid not null references profiles(id) on delete cascade
  name          text not null
  instructor    text
  room          text
  days          smallint[] not null             -- ISO weekday, 1=Mon .. 7=Sun
  start_minute  smallint not null               -- minutes from midnight, 0..1439
  end_minute    smallint not null
  color         text not null                   -- palette key, deterministic (see 9.3)
  sort_order    smallint not null default 0
  created_at    timestamptz
  check (end_minute > start_minute)
  check (start_minute >= 0 and end_minute <= 1440)   -- 1440 = midnight end
  check (array_length(days, 1) between 1 and 7)

friendships
  id            uuid PK default gen_random_uuid()
  requester_id  uuid not null references profiles(id) on delete cascade
  addressee_id  uuid not null references profiles(id) on delete cascade
  status        text not null check (status in ('pending','accepted'))
  created_at    timestamptz
  responded_at  timestamptz
  check (requester_id <> addressee_id)

  -- one row per unordered pair, in either direction
  create unique index friendships_pair_uniq on friendships
    (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
```

Supporting table for rate limiting:

```
extraction_log
  id         uuid PK
  user_id    uuid not null references profiles(id) on delete cascade
  created_at timestamptz
  index on (user_id, created_at desc)
```

### 6.1 Design decisions in the model

**Times are integers, not timestamps.** Minutes from midnight. No timezone arithmetic, no
`Date` parsing bugs, trivially comparable, and grid layout is pure arithmetic. Rendering to
"10:00 AM" is a display concern.

**One row is one meeting block.** A class meeting MWF 10:00–10:50 is a single row with
`days = {1,3,5}`. A class meeting MWF 10:00 *and* Tue 14:00 becomes **two rows** with the same
name. This is how schedule printouts present it, the extractor is instructed to emit it that
way, and the edit form makes it correctable. The alternative — a normalized `class_meetings`
child table — is more faithful but roughly doubles the edit-form complexity for a case the flat
model already handles correctly.

**Decline deletes the row.** There is no `declined` status, so a declined user can request
again. At 2000 users this is acceptable; blocking is a v2 concern noted in §12.

**The screenshot is never stored.** There is no Storage bucket and no image column. The image
travels to the Edge Function and is discarded after the model call. This makes "never display
the raw screenshot" structurally impossible to violate, and eliminates the retention, privacy,
and access-control questions that a bucket of students' schedule images would create.

## 7. Row-level security

RLS is enabled on all four tables. No table is readable without a policy.

**Helper**, needed to avoid policy recursion when `classes` policies consult `friendships`:

```sql
create function are_friends(a uuid, b uuid) returns boolean
  language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from friendships
    where status = 'accepted'
      and ((requester_id = a and addressee_id = b)
        or (requester_id = b and addressee_id = a))
  );
$$;
```

| Table | Select | Insert | Update | Delete |
|---|---|---|---|---|
| `profiles` | any authenticated user (username search needs it) | own row only, `id = auth.uid()` | own row only | none |
| `classes` | `user_id = auth.uid()` OR `are_friends(auth.uid(), user_id)` | `user_id = auth.uid()` | own only | own only |
| `friendships` | rows where you are requester or addressee | only as requester (`requester_id = auth.uid()`), status must be `pending` | addressee only, `pending → accepted` only | either party |
| `extraction_log` | own rows | Edge Function (service role) only | none | none |

`profiles` being world-readable to authenticated users is deliberate — username search requires
it. The table holds only username, display name, avatar, and invite code. Nothing sensitive
lives there.

## 8. Extraction pipeline

Edge Function `extract-schedule` (Deno, JWT required).

1. **Authenticate.** Reject without a valid Supabase JWT.
2. **Rate limit.** Count `extraction_log` rows for this user in the last hour; reject with
   `429` and a reset time if ≥ 10. Insert a row on accept. This protects a shared free-tier key
   from one user burning the daily quota.
3. **Validate input.** `{ imageBase64, mimeType }`. Reject non-image MIME types and payloads
   over 5 MB.
4. **Call Gemini** with `responseMimeType: "application/json"` and an explicit `responseSchema`.
   Structured output, not prose parsing. The prompt instructs the model to return an empty array
   rather than guess when the image is not a schedule, and to split a class into multiple entries
   when it meets at different times on different days.
5. **Normalize and validate.** Parse times to minutes from midnight; drop entries failing
   `end > start`, empty `days`, or empty `name`, recording each drop as a warning.
6. **Return** `{ classes, warnings }`.

**The Edge Function writes no `classes` rows.** Extraction and persistence are separate steps.
The client renders the result in the editable review form; only an explicit Confirm writes to
the database, in a single transaction that deletes the previous schedule and inserts the new one.

The client re-validates the response against the shared Zod schema before rendering. The
function is trusted for availability, not for correctness.

## 9. Screens and components

### 9.1 Routes

| Route | Purpose |
|---|---|
| `/login` | Google sign-in |
| `/onboarding` | Choose username; shown until the profile is complete |
| `/` | My schedule grid; empty state offers upload |
| `/upload` | Upload → extract → review/edit → confirm |
| `/friends` | Friend list, pending requests, username search, invite link |
| `/u/:username` | A friend's schedule grid |
| `/compare/:username` | Overlay of my schedule and theirs |
| `/invite/:code` | Resolves an invite code and sends a friend request |

An authenticated user without a complete profile is redirected to `/onboarding` from any route.

### 9.2 Upload flow (mobile-first)

- Primary action is a full-width tap target opening the photo library
  (`<input type="file" accept="image/*">`) — the screenshot is already in their camera roll.
- Secondary action captures a photo (`capture="environment"`) for students photographing a
  printed schedule.
- Paste-from-clipboard is supported as a desktop convenience.
- **Client-side downscale before upload.** Canvas-resize so the long edge is ≤ 1600 px, re-encode
  as JPEG at quality 0.85. Phone screenshots are large; this keeps cellular uploads fast and
  stays well inside the 5 MB cap without hurting extraction accuracy.
- Extraction takes several seconds. A full-screen progress state with a cancel action covers it.

### 9.3 Review and edit form (mobile-first)

- One **card per class**, stacked vertically. Not a table — tables are unusable at 390 px.
- Days chosen with seven toggle chips (M T W T F S S), each ≥ 44 px.
- Times use native `<input type="time">`, which gives the OS wheel picker on mobile.
- Fields the model could not fill are left blank and flagged amber; they are optional, not errors.
- Add-class and delete-class actions per card.
- A sticky bottom bar holds "Save schedule", positioned above the tab bar and safe-area inset.

**Colour assignment** is a deterministic hash of the normalized class name into a fixed palette.
The same class gets the same colour for every student, which makes shared classes visually
obvious in the compare view without any extra coordination.

### 9.4 `<ScheduleGrid>`

One component renders my schedule and a friend's. Layout math is a pure function
`computeLayout(classes, days) → PositionedBlock[]` — testable without a DOM.

**The time axis is fixed at 08:00–18:00** — `DAY_START_MINUTE = 480`, `DAY_END_MINUTE = 1080`,
a 600-minute window. It does not auto-fit to the data. A fixed axis means every schedule renders
at the same scale, so the compare view always aligns without re-layout, the mobile day column
keeps a constant height with no shift when swiping between days, and mutual-free-time has a
fixed window to search.

**Outlier handling.** A class falling outside 08:00–18:00 (an early lab, a night section) must
never be silently hidden — that would be data loss the student can't see. The axis extends
outward to the nearest hour needed to contain it, and only for the schedules being displayed.
08:00–18:00 is the guaranteed minimum window, not a hard clamp.

- Weekend columns appear only when a class lands on them.
- **Mobile (base):** a single day column with a sticky horizontal day selector, defaulting to
  today. Swipe left/right changes day.
- **Desktop (`lg:`):** the full Mon–Fri week. Same layout function, different `days` argument.

### 9.5 `<CompareGrid>`

- Shared classes (same normalized name and overlapping time) render as one merged full-width
  block with a "shared" badge.
- Non-shared classes render in two lanes at 50% width — mine left, theirs right.
- Mutual free time renders as a tinted full-width band: any window ≥ 30 minutes within
  08:00–18:00 where neither student has a class. The window is the fixed axis, not the union of
  both schedules' active hours — "both free 08:00–09:30" is useful information even if neither
  student has an early class.
- Below the grid, a text summary — "3 shared classes · Both free Mon 12:00–13:30, Wed 14:00–15:00"
  — which is often the only part a student actually needs, and reads well on a phone.

## 10. Error handling

| Condition | Behaviour |
|---|---|
| Gemini unavailable or 429 | "Try again in N minutes" plus an **Enter manually** button into the same edit form |
| Per-user rate limit hit | Countdown message; manual entry still available |
| No classes found in image | Empty review form with a warning banner; retry or manual entry |
| Partially extracted class | Missing fields blank and flagged amber; saving is allowed |
| Malformed model response | Caught by Zod; treated as "no classes found" and logged |
| Image over 5 MB after downscale | Rejected client-side with a clear message before upload |
| Friend request to an existing pair | Unique index rejects it; UI reports the existing state |
| Viewing a friend who has no schedule | Empty state: "They haven't added their schedule yet" |
| Class falls outside 08:00–18:00 | Axis extends to contain it; never clipped or dropped (§9.4) |
| Network offline | Toast; the edit form retains unsaved state |

## 11. Testing

Vitest, focused on the pure logic where the real bugs live:

- Time parsing and normalization — 12h/24h, "10:00 AM", "1:15p", "13:00", malformed input.
- Zod schema acceptance and rejection, using fixture payloads captured from real extractor output.
- `computeLayout` — overlapping blocks, single-day and full-week inputs, blocks sitting exactly
  on the 08:00 and 18:00 boundaries, and **classes outside 08:00–18:00 correctly extending the
  axis rather than being clipped or dropped**.
- Shared-class detection — name normalization, partial time overlap, same name at different times.
- Mutual-free-block computation — the 30-minute floor, adjacent blocks, no-overlap cases,
  one empty schedule, and free time at the leading and trailing edges of the fixed window.
- Friendship pair canonicalization.

RLS policies are verified with a SQL test script asserting that a non-friend cannot read another
user's `classes`.

End-to-end coverage with Playwright is optional for v1; if written, it runs at a 390 px viewport.

## 12. Deliberate simplifications and known risks

| Decision | Risk accepted | Why acceptable |
|---|---|---|
| Flat `classes` model, no `class_meetings` table | A lecture+lab pair appears as two same-named rows | Matches how schedules print; edit form corrects it; halves form complexity |
| No screenshot storage | Cannot re-run extraction on the original image | Re-upload is cheap; removes the entire privacy surface |
| Decline deletes the row | A declined user can re-request | No blocking in v1; acceptable at this scale, revisit if abused |
| `profiles` readable by all authenticated users | Usernames are enumerable | Required for search; nothing sensitive stored |
| Single active schedule | No term history | Matches the actual question being answered: "what's your schedule *now*?" |
| Free-tier Gemini quota | Extraction may throttle at term start | Manual-entry fallback means the app never hard-blocks |

## 13. Deployment and secrets

- **Vercel**, static SPA build. `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are public by
  design and safe in the bundle; RLS is what protects the data.
- **Supabase Edge Function secret:** `GEMINI_API_KEY`. Never referenced from client code.
- **Google OAuth** client configured in Supabase Auth with Vercel preview and production
  redirect URLs.
- Migrations live in `supabase/migrations/` and are applied via the Supabase CLI.
