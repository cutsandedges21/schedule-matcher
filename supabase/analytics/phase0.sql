-- supabase/analytics/phase0.sql
--
-- The four Phase 0 numbers from §6 of
-- docs/superpowers/specs/2026-08-17-monetization-design.md, as one result set:
--
--   1  extractions per student this term      -> is 3/term the right free cap?
--   2  largest group compared per student     -> is 2 friends the right free cap?
--   3  friends per student, by school         -> network density, per campus
--   4  week-4 retention                       -> does anyone come back?
--
--   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/run-sql.mjs <ref> supabase/analytics/phase0.sql
--
-- ONE statement on purpose. The Management API returns rows for the last
-- statement it runs, so a file of four separate SELECTs would silently report
-- only the fourth. Everything is unioned into (metric, bucket, value) instead,
-- with value as text because the four metrics count different things.
--
-- Read-only. Nothing here writes, so it is safe to run against production
-- whenever, including mid-term.
--
-- The term boundaries below duplicate TERM_BOUNDARIES in src/domain/terms.ts,
-- which SQL cannot import. terms.test.ts pins those numbers so the pair cannot
-- drift unnoticed — if you move a boundary, move it in both places.
-- 'America/Toronto' throughout, for the same reason terms.ts reads local time:
-- a term ticks over at midnight where the student is, not at midnight UTC.

with bounds as (
  select
    case when m >= 8 then make_date(y, 8, 1)
         when m >= 6 then make_date(y, 6, 1)
         else            make_date(y, 1, 1) end as term_start,
    case when m >= 8 then make_date(y + 1, 1, 1)
         when m >= 6 then make_date(y, 8, 1)
         else            make_date(y, 6, 1) end as term_end
  from (
    select extract(year  from (now() at time zone 'America/Toronto'))::int as y,
           extract(month from (now() at time zone 'America/Toronto'))::int as m
  ) parts
),

-- 1 -------------------------------------------------------------------------
extractions_per_user as (
  select e.user_id, count(*)::int as n
  from public.extraction_log e cross join bounds b
  where (e.created_at at time zone 'America/Toronto') >= b.term_start
    and (e.created_at at time zone 'America/Toronto') <  b.term_end
  group by e.user_id
),
m_extractions as (
  select '1. extractions per student, this term'      as metric,
         case when n >= 5 then '5+' else n::text end   as bucket,
         count(*)::text                                as value
  from extractions_per_user
  group by 2
),
-- The decision this exists to settle: does a 3/term free cap bite real users?
m_extraction_cap as (
  select '1b. students over the 3/term free cap'                     as metric,
         'count'                                                     as bucket,
         count(*) filter (where n > 3)::text || ' of ' || count(*)::text as value
  from extractions_per_user
),

-- 2 -------------------------------------------------------------------------
-- Max per student, not per event: the question is whether a cap would ever
-- have bitten them, so the largest group they assembled is the one that counts.
group_max as (
  select a.user_id, max(a.friend_count)::int as max_friends
  from public.app_events a cross join bounds b
  where a.kind = 'compare_group'
    and (a.created_at at time zone 'America/Toronto') >= b.term_start
    and (a.created_at at time zone 'America/Toronto') <  b.term_end
  group by a.user_id
),
m_group_sizes as (
  select '2. largest group compared, per student' as metric,
         max_friends::text || ' friends'          as bucket,
         count(*)::text                           as value
  from group_max
  group by 2
),
-- The headline Phase 0 number. This is what prices the Pass.
m_group_cap as (
  select '2b. students over the 2-friend free cap'                             as metric,
         'count'                                                               as bucket,
         count(*) filter (where max_friends > 2)::text || ' of ' || count(*)::text as value
  from group_max
),

-- 3 -------------------------------------------------------------------------
friend_counts as (
  select p.id, p.school, (
    select count(*)
    from public.friendships f
    where f.status = 'accepted'
      and (f.requester_id = p.id or f.addressee_id = p.id)
  )::int as friends
  from public.profiles p
),
m_density as (
  select '3. friends per student, by school'                         as metric,
         coalesce(school, '(none set)')                               as bucket,
         count(*)::text || ' students, median '
           || (percentile_cont(0.5) within group (order by friends))::numeric(10,1)::text as value
  from friend_counts
  group by 2
),

-- 4 -------------------------------------------------------------------------
-- Only students who have had time to churn. Anyone who joined in the last four
-- weeks has not had a fourth week yet, and counting them would drag the rate
-- down for no reason.
cohort as (
  select p.id, (p.created_at at time zone 'America/Toronto')::date as joined
  from public.profiles p
  where p.created_at < now() - interval '28 days'
),
retained as (
  select c.id, exists (
    select 1
    from public.app_events a
    where a.user_id = c.id
      and a.kind = 'open'
      and (a.created_at at time zone 'America/Toronto')::date >= c.joined + 21
      and (a.created_at at time zone 'America/Toronto')::date <  c.joined + 28
  ) as week4
  from cohort c
),
m_retention as (
  select '4. active in week 4, of students 28+ days old'             as metric,
         'count'                                                     as bucket,
         count(*) filter (where week4)::text || ' of ' || count(*)::text as value
  from retained
)

select * from m_extractions
union all select * from m_extraction_cap
union all select * from m_group_sizes
union all select * from m_group_cap
union all select * from m_density
union all select * from m_retention
order by metric, bucket;
