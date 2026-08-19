-- supabase/analytics/errors.sql
--
-- Client errors from the last 7 days (supabase/migrations/0010_client_errors.sql),
-- grouped by message. count is "how many times"; students is "how many
-- distinct people it hit" — the number that actually decides whether to care.
-- A crash that fired 400 times for one looping student is a smaller problem
-- than one that fired twice for two different students.
--
--   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/run-sql.mjs <ref> supabase/analytics/errors.sql
--
-- Read-only.

select
  message,
  source,
  route,
  count(*)::int                        as occurrences,
  count(distinct user_id)::int         as students,
  min(created_at)                      as first_seen,
  max(created_at)                      as last_seen
from public.client_errors
where created_at >= now() - interval '7 days'
group by message, source, route
order by students desc, occurrences desc;
