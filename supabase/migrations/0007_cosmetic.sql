-- supabase/migrations/0007_cosmetic.sql
--
-- A student's chosen profile cosmetic, which paints their card on their
-- friends' Friends page (src/domain/cosmetics.ts). Nullable: null means "no
-- cosmetic chosen" and renders exactly today's plain white card, so every
-- existing profile keeps the look it has now without a backfill.
--
-- A format check rather than an enum or a foreign key to a cosmetics table,
-- for the same reason as school in 0006: shipping next term's preset should be
-- a one-line change in cosmetics.ts, not a migration. The pattern is
-- duplicated as COSMETIC_ID_PATTERN in that file, and cosmetics.test.ts
-- asserts every shipped id satisfies it, so the two cannot drift into a state
-- where the picker saves an id the database rejects.
--
-- No RLS change. profiles_select is already `for select to authenticated
-- using (true)` so that username search works, and a cosmetic id is no more
-- sensitive than the username sitting next to it.
--
-- Also no write restriction, deliberately: profiles_update lets a student set
-- any column on their own row, so cosmetics are free to everyone and settable
-- straight from the client. That is correct while they are free. When they
-- move behind the paid Pass this column has to be locked — revoke column-level
-- update on profiles(cosmetic) from `authenticated`, and set it instead
-- through a trigger or a security-definer function that checks the student
-- actually holds a Pass. Not built here.

alter table public.profiles add column cosmetic text;

alter table public.profiles add constraint profiles_cosmetic_format
  check (cosmetic is null or cosmetic ~ '^[a-z0-9-]{2,32}$');
