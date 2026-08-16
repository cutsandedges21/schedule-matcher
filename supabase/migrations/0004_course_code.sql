-- supabase/migrations/0004_course_code.sql
--
-- Omnivox schedule blocks carry a course code + section (e.g. "420-SF3-RE
-- sec.00001") alongside the (often truncated) course name. Course names alone
-- are ambiguous — two different classes can render the same truncated name —
-- so code + section is the reliable signal for "this is literally the same
-- class," which the shared-class matching in src/domain/compare.ts now uses
-- when both sides have one. This migration only adds the columns and extends
-- replace_schedule to persist them; existing rows get NULL for both, which
-- falls back to the pre-existing name-based matching untouched.

alter table public.classes
  add column course_code text,
  add column section     text;

-- Re-create replace_schedule (defined in 0002_rls.sql) to also insert
-- course_code/section from the jsonb payload. Everything else — the
-- security invoker, search_path, auth.uid() null guard, and btrim(name) —
-- is carried over unchanged from 0002; only the two new columns are added.
create or replace function public.replace_schedule(p_classes jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'replace_schedule requires an authenticated user';
  end if;

  delete from public.classes where user_id = v_uid;

  insert into public.classes (
    user_id, name, instructor, room, course_code, section,
    days, start_minute, end_minute, color, sort_order
  )
  select
    v_uid,
    btrim(elem->>'name'),
    nullif(btrim(elem->>'instructor'), ''),
    nullif(btrim(elem->>'room'), ''),
    nullif(btrim(elem->>'course_code'), ''),
    nullif(btrim(elem->>'section'), ''),
    (
      select coalesce(array_agg(d::smallint), array[]::smallint[])
      from jsonb_array_elements_text(elem->'days') as d
    ),
    (elem->>'start_minute')::smallint,
    (elem->>'end_minute')::smallint,
    elem->>'color',
    coalesce((elem->>'sort_order')::smallint, 0)
  from jsonb_array_elements(p_classes) as elem;
  -- jsonb_array_elements() over an empty array yields zero rows, so an empty
  -- p_classes correctly deletes everything above and inserts nothing here.
end;
$$;
