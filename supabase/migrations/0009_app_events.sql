-- supabase/migrations/0009_app_events.sql
--
-- Phase 0 instrumentation for the monetization plan
-- (docs/superpowers/specs/2026-08-17-monetization-design.md §6).
--
-- The plan prices a paid tier in January off what students actually do this
-- fall, and the load-bearing number is the *distribution of group-compare
-- sizes*: what share of students would have hit a two-friend cap. You cannot
-- measure demand for a wall that does not exist, so group compare stays free
-- to all five this term and we record the size instead.
--
-- Three of the four Phase 0 metrics need no new table:
--
--   extractions per term   extraction_log already has (user_id, created_at)
--   friend-graph density   friendships joined to profiles.school
--   retention              needs an "opened the app" signal — the 'open' kind below
--
-- WHAT THIS DELIBERATELY DOES NOT STORE
--
-- No usernames, no friend ids, no class data, no device or IP. A compare row
-- says "this user looked at a group of four" and nothing about who the four
-- were. That is the whole of what §6 needs, and holding more would turn a
-- counting table into a social graph of who hangs out with whom — which is
-- both a different thing to defend under Law 25 and not something we need.
--
-- One table rather than three, because the three kinds share every column that
-- matters and differ only in whether friend_count applies. Splitting them
-- would triple the RLS policies and the indexes to express the same fact.

create table public.app_events (
  id            uuid primary key default gen_random_uuid(),
  -- auth.users, not profiles, for the same reason extraction_log does it in
  -- 0001: a student who has signed in but not finished onboarding has no
  -- profiles row yet, and an FK to profiles would raise on their first 'open'.
  user_id       uuid not null references auth.users(id) on delete cascade,
  kind          text not null check (kind in ('open', 'compare_pair', 'compare_group')),
  -- Number of friends in the group, excluding the viewer. Only 'compare_group'
  -- carries one; 'compare_pair' is 1:1 by construction and 'open' has none.
  --
  -- The 1..20 bound is a sanity check on a bad client, NOT the business rule.
  -- MAX_GROUP_FRIENDS lives in src/domain/constants.ts and raising it must not
  -- require a migration — same philosophy as the format checks in 0006-0008.
  friend_count  smallint check (friend_count between 1 and 20),
  created_at    timestamptz not null default now(),

  constraint app_events_friend_count_scope check (
    (kind = 'compare_group') = (friend_count is not null)
  )
);

-- The Phase 0 queries all filter by kind over a date window, then group. The
-- per-user index serves the retention query, which walks one user's history.
create index app_events_kind_time_idx on public.app_events (kind, created_at desc);
create index app_events_user_time_idx on public.app_events (user_id, created_at desc);

alter table public.app_events enable row level security;

-- Insert your own rows, and nothing else.
create policy app_events_insert on public.app_events
  for insert to authenticated with check (user_id = auth.uid());

-- There is deliberately NO select policy, so `authenticated` can read nothing
-- at all — not even its own rows. Nobody needs to: this table is written by
-- the client and read only by us, through the Management API in
-- scripts/run-sql.mjs, which connects as `postgres` and bypasses RLS.
--
-- CONSEQUENCE FOR THE CLIENT, and it is not obvious: PostgREST returns the
-- inserted row when asked to, and doing so requires SELECT. So the insert must
-- NOT chain `.select()` — supabase-js sends `Prefer: return=minimal` only when
-- you leave it off. Chaining it turns every write into a 401 and silently
-- kills the whole dataset. src/lib/analytics.ts says the same thing at the
-- call site.
