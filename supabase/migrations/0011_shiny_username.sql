-- supabase/migrations/0011_shiny_username.sql
--
-- The looped shiny-gold animation on a student's username, awarded for
-- purchasing a cosmetic (src/features/friends/ProfileCard.tsx). Unlike
-- cosmetic/banner/effect there is no picker for this — a student cannot
-- choose it themselves — so it is locked to server-side writes from the
-- moment it exists rather than inheriting the "free during beta, lock later"
-- trust-the-client gap those three accepted (see 0007's header). Nobody but
-- us (via this migration, and later a purchase webhook or security-definer
-- setter) is ever meant to set it.

alter table public.profiles add column shiny_username boolean not null default false;

-- profiles_select is `for select to authenticated using (true)`, so this is
-- readable the moment it exists — friends have to see it for it to mean
-- anything, same reasoning as cosmetic/banner/effect.
--
-- profiles_update lets a student write any column on their own row, which
-- would let anyone grant themselves the badge from devtools. Column-level
-- REVOKE stacks on top of RLS rather than replacing it: RLS still decides
-- which *row* is theirs to touch, this decides which *column* they may not.
revoke update (shiny_username) on public.profiles from anon, authenticated;

-- Turn it on for the three private-beta testers (src/domain/beta.ts) as a
-- stand-in for "purchased a cosmetic" until a real purchase flow exists.
-- profiles has no email column — auth.users does — so the match goes through
-- the id the two tables share.
update public.profiles
set shiny_username = true
where id in (
  select id from auth.users
  where lower(email) in (
    'andreas.retsinas70@gmail.com',
    'schedulematcher.info@gmail.com',
    'sportsdude3133@gmail.com'
  )
);
