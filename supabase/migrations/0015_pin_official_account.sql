-- supabase/migrations/0015_pin_official_account.sql
--
-- schedulematcher.info@gmail.com is friends with everyone (0013) and should
-- always render at the bottom of every friends list rather than wherever it
-- happens to fall in whatever order the friendships query returns. `pinned`
-- is a marker the client sorts on (see FriendsPage.tsx), not a display
-- property by itself.
--
-- Same shape as grant_shiny_to_beta (0012): a BEFORE INSERT trigger, because
-- this sets a column on the row being inserted rather than a side-effect
-- insert into another table (which is why 0013's grant_universal_friend is
-- AFTER INSERT instead). security definer for the same reason both of those
-- already are — reading auth.users.email needs privileges `authenticated`
-- does not have.
--
-- IF NOT EXISTS / DROP ... IF EXISTS throughout: this whole script is safe to
-- paste more than once, in case a previous run got partway through before
-- failing on something else — ADD COLUMN and CREATE TRIGGER both error on a
-- second run otherwise, unlike CREATE OR REPLACE FUNCTION and REVOKE, which
-- are already no-ops when re-applied.

alter table public.profiles add column if not exists pinned boolean not null default false;

revoke update (pinned) on public.profiles from anon, authenticated;

create or replace function public.grant_pinned_official()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from auth.users
    where id = new.id
      and lower(email) = 'schedulematcher.info@gmail.com'
  ) then
    new.pinned := true;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_grant_pinned_official on public.profiles;

create trigger profiles_grant_pinned_official
  before insert on public.profiles
  for each row execute function public.grant_pinned_official();

-- Back-fill: pin the account if its profile row already exists.
update public.profiles
set pinned = true
where id in (
  select id from auth.users where lower(email) = 'schedulematcher.info@gmail.com'
);
