-- supabase/migrations/0008_banner_effect.sql
--
-- Two more cosmetic slots on a student's friend card, on top of the colour
-- 0007 added:
--
--   banner  the animated strip across the top of the card
--   effect  the slime that drips out from under it
--
-- Both nullable: null means "not set" and renders exactly the card 0007
-- shipped, so every existing profile is unaffected without a backfill.
--
-- Three columns rather than one, because the three are genuinely independent.
-- A student can run a colour with nothing else, slime on a plain white card,
-- a strip with no slime, or all three. They are also free to *mismatch* — a
-- green slime under a red strip is allowed on purpose. Packing them into one
-- value would make "clear the slime but keep my strip" a parsing problem, and
-- would imply a co-ordination between them that deliberately does not exist.
--
-- Same format check as school (0006) and cosmetic (0007), and for the same
-- reason: shipping next term's preset should be a one-line change in
-- banners.ts / effects.ts, not a migration. The patterns are duplicated as
-- BANNER_ID_PATTERN and EFFECT_ID_PATTERN in those files, and their tests
-- assert every shipped id satisfies them, so the picker can never offer an id
-- the database refuses.
--
-- No RLS change. profiles_select is already `for select to authenticated
-- using (true)` so that username search works, and neither id is more
-- sensitive than the username sitting next to it.
--
-- Also no write restriction, deliberately — same position as 0007. Both
-- columns are client-writable through profiles_update while cosmetics are
-- free. When they move behind the paid Pass, revoke column-level update on
-- profiles(banner) and profiles(effect) from `authenticated` and set them
-- through a trigger or a security-definer function that checks the pass.
-- Not built here.

alter table public.profiles add column banner text;
alter table public.profiles add column effect text;

alter table public.profiles add constraint profiles_banner_format
  check (banner is null or banner ~ '^[a-z0-9-]{2,32}$');

alter table public.profiles add constraint profiles_effect_format
  check (effect is null or effect ~ '^[a-z0-9-]{2,32}$');
