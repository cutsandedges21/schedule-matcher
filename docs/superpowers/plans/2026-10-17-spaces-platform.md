# Spaces platform — implementation plan

Design: `docs/superpowers/specs/2026-10-17-spaces-platform-design.md`
Branch: `feat/spaces`

Checks after every step: `npx tsc -b`, `npm test` (domain + components + DB).

## Status at handoff (2026-10-17)

- **Backend complete and tested in PGlite**: migrations 0016–0019 (spaces,
  availability + events, tasks + polls, resources + reminders). 0017 merged
  availability and events into one file; 0018 holds tasks AND polls; 0019 is
  resources + reminders. **None are applied to the live project yet** — apply
  0016 → 0019 in order (SQL Editor, or `scripts/run-sql.mjs` with a token).
- **Domain complete with tests**: zonedTime, intervals (shared with
  computeGroupFree), availability engine, events, spaces.
- **UI built**: nav (Home / Schedule / Spaces + top bar), Home, Spaces list,
  create, join link, space overview / members / settings, notifications +
  settings.
- **UI not built yet**: Find a time page, space + personal calendar, event
  form/detail, availability settings (`/schedule/availability`), tasks pages,
  polls pages, resources page, `tasks.ts` / `polls.ts` domain helpers. When a
  page lands, add its tab back to NAV_TABS / SPACE_TABS and its route in
  App.tsx (routePattern.ts already lists them).

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
- [ ] `intervals.ts`, `zonedTime.ts` (DST tests), `availability.ts` (realistic cases)
- [ ] 0017_availability.sql + 0018_events.sql + DB tests
- [ ] Availability settings page (timezone, preferences, one-off blocks)
- [ ] Find a time (plan an event) + heatmap
- [ ] Space calendar, personal calendar, event form, event detail + RSVP + conflicts

## Phase 4 — Tasks and polls
- [ ] 0019_tasks.sql, 0020_polls.sql + DB tests (permissions, voting rules, anonymous results)
- [ ] `tasks.ts`, `polls.ts` domain + tests
- [ ] Space tasks, assignments with progress, My Tasks
- [ ] Polls: general + schedule (suggested from availability), vote, close, tie handling, poll → event

## Phase 5 — Resources and notifications
- [ ] 0021_resources_reminders.sql + DB tests
- [ ] Resources page, notification preferences, reminder sync, activity feed

## Phase 6 — Polish and verification
- [ ] Dashboard complete, empty states, responsive pass
- [ ] `supabase/tests/spaces_rls_check.sql` for the live project
- [ ] README: Spaces section, migration order, env
- [ ] Full typecheck, tests, build; browser pass
