# Spaces — from schedule comparison to group coordination

**Date:** 2026-10-17
**Status:** In progress on `feat/spaces`
**Builds on:** `2026-08-16-schedule-matcher-design.md`

## 1. What changes

Schedule Matcher compares weekly class schedules between friends. This adds
**Spaces**: a shared place for one group (a class section, a project team, a
club, roommates) with its own members, availability matching over real dates,
a calendar, tasks, polls, resources, notifications and an activity history.

One account, many Spaces. Everything inside a Space is visible to its members
only, enforced by Postgres row-level security — never by the UI alone.

Nothing that exists today is removed. Upload, the weekly grid, friends, the
1:1 and group compare views, cosmetics, school themes and onboarding keep
working unchanged. Two things move:

- `/` becomes the Home dashboard; the weekly grid moves to `/schedule`.
- The bottom tab bar becomes Home · Schedule · Spaces · Calendar · Tasks.
  Friends, Notifications and Settings move to a compact top bar, so every
  existing destination is still one tap away.

## 2. Conflict with the monetization plan

`2026-08-17-monetization-design.md` §3.2 puts "group compare 3–5 friends +
saved, named groups" behind the January Pass. Spaces are saved, named groups
with group availability, so they overlap that SKU directly.

Least disruptive resolution: Spaces ship **free and ungated**, the friends
group compare keeps its existing `MAX_GROUP_FRIENDS = 5`, and the only size
limit is an abuse bound (`MAX_SPACE_MEMBERS = 50`, enforced server-side). The
pricing decision is deferred to the owner before January; nothing here assumes
an entitlement check exists.

## 3. Time model

The existing schedule stores weekly wall-clock times (minutes from midnight,
ISO weekdays) and no dates. New features need real dates, so:

- `profiles.timezone` (IANA name) says which zone a student's weekly classes
  are in. Null means the default, `America/Toronto` (Montreal).
- One-off blocks, events, deadlines and poll slots are `timestamptz` instants.
- Every Space has a timezone used for its daily search window and for display.
- `src/domain/zonedTime.ts` converts wall-clock ↔ instant with `Intl` only (no
  date library). DST gaps resolve forward and overlaps resolve to the earlier
  instant, matching Temporal's `compatible` disambiguation.

## 4. Availability matching

`src/domain/availability.ts` is the engine. Inputs: members (weekly classes,
one-off busy/free blocks, events they are going to, preferences, timezone) and
a request (date range, daily window, duration, step, mode).

1. Expand each member's weekly classes into instants for every date in range,
   in **that member's** timezone. A one-off **free** block removes class time
   (class cancelled); a one-off **busy** block and accepted events add busy
   time. Precedence: busy block / event > free block > weekly class.
2. Generate candidate slots across the range in the **Space's** timezone,
   stepping through the daily window. Durations are absolute, so a slot that
   crosses a DST change is still the requested length.
3. A member is available for a slot when none of their busy intervals overlap
   it. Members with no schedule and members who hide their availability are
   **unknown** — never counted as free, always named in the result.
4. Mode `everyone` keeps slots where every member with data is free. Mode
   `most` ranks by attendance. When `everyone` finds nothing, the engine falls
   back to `most` and says who cannot make each alternative.
5. Ranking: attendance first, then preference misses (before a member's
   earliest time, after their latest, weekends when they avoid them), then
   earliest start. Suggestions are non-overlapping and capped per day so the
   list spreads across the range.
6. Every empty result carries a reason (`invalid_range`, `window_too_short`,
   `all_in_past`, `no_common_time`, `no_members`).

The interval primitives (`src/domain/intervals.ts`) are shared with the
existing weekly `computeGroupFree`, so there is one implementation of merge and
gap-finding in the app.

### 4.1 Privacy

Per Space, each member picks a share level:

| Level | What other members of that Space get |
|---|---|
| `hidden` | Nothing. They are "unknown" in matching. |
| `busy` (default) | Busy times only — no class names, block labels or event titles. |
| `details` | Busy times plus class names and one-off block labels. |

Availability is read through one `security definer` RPC,
`space_availability(space, from, to)`, which only answers a member of that
Space, only returns members of that Space, caps the range at 62 days, and
returns events from *other* Spaces as anonymous busy time. Direct reads of
`classes` keep the original friends-only policy.

## 5. Data model (migrations 0016–0021)

| Migration | Tables / functions |
|---|---|
| 0016_spaces | `spaces`, `space_members`, `space_invites` (links), `space_invitations` (direct), `space_activity`, `notifications`, `notification_preferences`, membership RPCs, `private` helpers |
| 0017_availability | `profiles.timezone`, `availability_preferences`, `availability_blocks`, `space_availability()` |
| 0018_events | `space_events`, `event_attendees`, `create_space_event()`, change notifications |
| 0019_tasks | `space_tasks` (assignments are tasks with subtasks), `task_assignees`, task RPCs |
| 0020_polls | `polls`, `poll_options`, `poll_votes`, `create_poll()`, `cast_vote()`, `close_poll()`, `get_poll_results()`, poll → event |
| 0021_resources_reminders | `space_resources`, `sync_my_reminders()` |

Rules that hold everywhere:

- Membership-gated reads use `private.is_space_member(space)`, a `security
  definer` helper in the `private` schema (not served by PostgREST; see 0003
  for why the grant must stay).
- Anything that changes membership or roles, casts votes, or writes
  notifications goes through an RPC that re-checks the caller's role.
  `space_members` has no client insert/delete policy at all.
- Activity rows and notifications are written only by server code, so they
  cannot be forged from the client.
- Roles: **owner** (exactly one, enforced by a partial unique index) manages
  settings, roles, ownership and deletion; **admin** manages invites, removes
  plain members, edits and closes anything; **member** takes part.
- Removing the owner's account promotes the longest-standing admin, else the
  longest-standing member; the last member leaving deletes the Space.

## 6. Notifications

In-app only. `notifications` is the outbox; a future email/push worker can
read it without schema changes. Rows are written by server code with a
`dedupe_key`, so an event edited five times leaves one unread "Event updated"
row rather than five. Preferences are six category toggles.

Reminders (task due within 24 h, event starting within 24 h) are generated by
`sync_my_reminders()`, which the client calls on open and every few minutes
while the app is visible. **There is no background job, email or push.** A
reminder appears the next time the student opens the app.

## 7. Not in this version

- File uploads (no Storage bucket exists by design, see the original spec
  §6.1); resources and tasks take links.
- External calendar sync / `.ics` import. The block table is shaped so an
  importer can write `availability_blocks` rows later.
- Push and email delivery, background reminder scheduling.
- Per-occurrence edits of a recurring event (the series is edited as a whole).
