-- supabase/migrations/0012_shiny_username_auto_grant.sql
--
-- 0011's seed was one-time: it set shiny_username = true for the three
-- private-beta accounts (src/domain/beta.ts) that existed at that moment.
-- Deleting and recreating one of those accounts makes a brand new profiles
-- row with the column's default (false), silently dropping the badge —
-- exactly what happened to schedulematcher.info@gmail.com. A trigger makes
-- this durable: any future profiles row for one of these emails gets the
-- badge automatically, with no manual re-seed needed after every
-- delete/recreate cycle.
--
-- security definer because the trigger has to read auth.users.email, which
-- `authenticated` cannot select directly — same reasoning as are_friends()
-- in 0002. It is not exposed as a callable RPC: trigger functions return the
-- pseudo-type `trigger`, which only exists while a real row-level trigger is
-- firing, so PostgREST has nothing standalone it could invoke.

create or replace function public.grant_shiny_to_beta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from auth.users
    where id = new.id
      and lower(email) in (
        'andreas.retsinas70@gmail.com',
        'schedulematcher.info@gmail.com',
        'sportsdude3133@gmail.com'
      )
  ) then
    new.shiny_username := true;
  end if;
  return new;
end;
$$;

create trigger profiles_grant_shiny_beta
  before insert on public.profiles
  for each row execute function public.grant_shiny_to_beta();

-- Re-grant the badge to the account that just lost it by being deleted and
-- recreated.
update public.profiles
set shiny_username = true
where id in (
  select id from auth.users where lower(email) = 'schedulematcher.info@gmail.com'
);
