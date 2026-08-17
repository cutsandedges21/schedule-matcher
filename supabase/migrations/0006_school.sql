-- supabase/migrations/0006_school.sql
--
-- A student's school, which picks the app's accent colour (src/domain/schools.ts)
-- and shows as a chip on their friends' screens. Nullable: null means "no school
-- chosen" and maps to the default slate theme.
--
-- A format check rather than an enum or a foreign key to a schools table:
-- adding a seventh college should be a one-line change in schools.ts, not a
-- migration. The pattern is duplicated as SCHOOL_ID_PATTERN in that file, and
-- schools.test.ts asserts every shipped id satisfies it, so the two cannot
-- drift into a state where the picker saves an id the database rejects.

alter table public.profiles add column school text;

alter table public.profiles add constraint profiles_school_format
  check (school is null or school ~ '^[a-z0-9-]{2,32}$');

-- No RLS change. profiles_select is already `for select to authenticated
-- using (true)` so that username search works, and a college name is no more
-- sensitive than the username sitting next to it.
