# Spaces platform — implementation plan

Design: `docs/superpowers/specs/2026-10-17-spaces-platform-design.md`
Branch: `feat/spaces`

Checks after every step: `npx tsc -b`, `npm test` (domain + components + DB).

## Status (2026-10-20)

All phases built. Migrations 0016–0019 applied live by Moss on 2026-10-20.
Not verified in a signed-in browser session (Google sign-in cannot be driven
from an agent): the first real use may surface UI bugs the tests cannot see.

## Phase 1 — Inspect and plan
- [x] Inspect repo, record architecture and conflicts (design doc §1–2)
- [x] PGlite DB test harness (`supabase/tests/db/harness.ts`) running every migration

## Phase 2 — Spaces and membership
- [x] 0016_spaces.sql: spaces, members, invites, invitations, activity, notifications, RPCs
- [x] DB tests: isolation, roles, invites (expiry / max uses / revoke), leave, transfer, owner deletion
- [x] `src/domain/spaces.ts` (roles, permission matrix, kinds) + tests
- [x] Navigation: Home at `/`, schedule at `/schedule`, 5 tabs + top bar
- [x] Spaces list / create / join-by-link / Space layout / members / settings
- [x] Notifications page (invites land here)

## Phase 3 — Availability and events
- [x] `intervals.ts`, `zonedTime.ts` (DST tests), `availability.ts` (realistic cases)
- [x] 0017_availability_events.sql + DB tests
- [x] Availability settings page (timezone, preferences, one-off blocks)
- [x] Find a time (plan an event) + heatmap
- [x] Space calendar, personal calendar, event form, event detail + RSVP + conflicts

## Phase 4 — Tasks and polls
- [x] 0018_tasks_polls.sql + DB tests (permissions, voting rules, anonymous results)
- [x] `tasks.ts`, `polls.ts` domain + tests
- [x] Space tasks, assignments with progress, My Tasks
- [x] Polls: general + schedule (suggested from availability), vote, close, tie handling, poll → event

## Phase 5 — Resources and notifications
- [x] 0019_resources_reminders.sql + DB tests
- [x] Resources page, notification preferences, reminder sync, activity feed

## Phase 6 — Polish and verification
- [x] Dashboard complete, empty states, responsive pass
- [ ] `supabase/tests/spaces_rls_check.sql` for the live project (not written; PGlite tests cover the same rules)
- [x] README: Spaces section, migration order, env
- [x] Full typecheck, tests, build
- [ ] Signed-in browser pass (needs Moss: Google sign-in)
