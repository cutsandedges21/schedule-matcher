-- supabase/migrations/0010_client_errors.sql
--
-- Client-side error monitoring. ErrorBoundary (src/components/ErrorBoundary.tsx)
-- already catches render errors and shows a recovery page; this is the other
-- half — making sure a crash is visible to the operators, not just to the
-- one student who hit it and quietly uninstalled.
--
-- SAME SHAPE AS app_events (0009), on purpose, and for the same three reasons:
--
--   1. Law 25. This app stores schedules and a friend graph for Quebec
--      students, some of them minors. Error payloads routinely carry URLs,
--      ids and fragments of state — shipping that to a third-party processor
--      outside Quebec is a disclosure that needs its own assessment. Keeping
--      it in the database we already use avoids adding a processor at all.
--   2. Cost. Free-tier on purpose, no new vendor.
--   3. There is already exactly one way to do "insert-only, client-written,
--      operator-read" in this codebase. Reuse it rather than inventing a
--      second one.
--
-- WHAT THIS DELIBERATELY DOES NOT DO
--
-- No stack-trace scrubbing beyond truncation, and no attempt to redact
-- arbitrary text inside `message`/`stack` — those come straight from the
-- browser. What IS scrubbed is the one concrete, known leak: `route` is a
-- route *pattern* ("/compare"), never a resolved URL with a query string
-- ("/compare?with=alice,bob" is a friend graph). See src/domain/routePattern.ts.
-- Rate limiting and dedup live client-side (src/domain/errorReportGate.ts) —
-- this table trusts the client to have already collapsed a crash loop into a
-- handful of rows, the same way extraction_log trusts log_extraction().

create table public.client_errors (
  id          uuid primary key default gen_random_uuid(),
  -- auth.users, nullable: errors during onboarding happen before a profiles
  -- row exists, and an error on a signed-out screen has no user at all. A
  -- crash we cannot attribute is still a crash we need to see.
  user_id     uuid references auth.users(id) on delete cascade,
  message     text not null check (char_length(message) <= 500),
  stack       text check (stack is null or char_length(stack) <= 4000),
  route       text check (route is null or char_length(route) <= 100),
  source      text not null check (source in ('render', 'window', 'unhandledrejection')),
  created_at  timestamptz not null default now()
);

-- The one query this table exists to answer (supabase/analytics/errors.sql)
-- windows by time and groups by message; nothing here filters by user.
create index client_errors_created_at_idx on public.client_errors (created_at desc);

alter table public.client_errors enable row level security;

-- Insert your own rows, or an attributionless row while signed out /
-- mid-onboarding. Never someone else's.
create policy client_errors_insert on public.client_errors
  for insert to authenticated, anon
  with check (user_id = auth.uid() or user_id is null);

-- There is deliberately NO select policy — same reasoning as app_events
-- (0009): nobody needs to read this from the client, so `authenticated` and
-- `anon` can read nothing at all, not even their own rows. It is read only
-- through the Management API (scripts/run-sql.mjs), which connects as
-- `postgres` and bypasses RLS.
--
-- CONSEQUENCE FOR THE CLIENT, and it is not obvious: PostgREST returns the
-- inserted row when asked to, and doing so requires SELECT. So the insert
-- must NOT chain `.select()` — supabase-js sends `Prefer: return=minimal`
-- only when you leave it off. Chaining it turns every write into a silent
-- 401. src/lib/errorLog.ts says the same thing at the call site.
