-- supabase/migrations/0013_universal_friend.sql
--
-- schedulematcher.info@gmail.com is friends with everyone, automatically —
-- current accounts backfilled below, and future accounts (both new students
-- signing up, and this account itself being deleted and recreated, which is
-- routine during testing — see 0012's header) handled by a trigger.
--
-- security definer for the same reason as accept_invite (0010) and
-- grant_shiny_to_beta (0012): reading auth.users.email and writing an
-- already-accepted friendships row are both things a plain client insert
-- cannot do — friendships_insert only ever allows status = 'pending'.

create or replace function public.grant_universal_friend()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_special_id uuid;
  v_new_email  text;
begin
  select email into v_new_email from auth.users where id = new.id;

  if v_new_email is not null and lower(v_new_email) = 'schedulematcher.info@gmail.com' then
    -- The special account itself just (re)appeared: friend it with every
    -- other profile that already exists, in one shot.
    insert into public.friendships (requester_id, addressee_id, status, responded_at)
    select new.id, p.id, 'accepted', now()
    from public.profiles p
    where p.id <> new.id
    on conflict (least(requester_id, addressee_id), greatest(requester_id, addressee_id))
    do update set status = 'accepted', responded_at = now()
    where public.friendships.status <> 'accepted';
  else
    -- An ordinary student signed up: friend them with the special account, if
    -- one currently exists. If it does not (deleted, not yet recreated),
    -- there is nothing to do here — the branch above covers it whenever the
    -- special account comes back.
    select p.id into v_special_id
    from public.profiles p
    join auth.users u on u.id = p.id
    where lower(u.email) = 'schedulematcher.info@gmail.com';

    if v_special_id is not null then
      insert into public.friendships (requester_id, addressee_id, status, responded_at)
      values (v_special_id, new.id, 'accepted', now())
      on conflict (least(requester_id, addressee_id), greatest(requester_id, addressee_id))
      do update set status = 'accepted', responded_at = now()
      where public.friendships.status <> 'accepted';
    end if;
  end if;

  return new;
end;
$$;

create trigger profiles_grant_universal_friend
  after insert on public.profiles
  for each row execute function public.grant_universal_friend();

-- Backfill: friend the special account with everyone who already has a
-- profile right now.
insert into public.friendships (requester_id, addressee_id, status, responded_at)
select special.id, p.id, 'accepted', now()
from public.profiles special
join auth.users su on su.id = special.id
cross join public.profiles p
where lower(su.email) = 'schedulematcher.info@gmail.com'
  and p.id <> special.id
on conflict (least(requester_id, addressee_id), greatest(requester_id, addressee_id))
do update set status = 'accepted', responded_at = now()
where public.friendships.status <> 'accepted';

-- A placeholder schedule for the special account, so its calendar looks
-- populated rather than empty the moment a new friend opens it. One
-- "Example" class Monday through Friday, one row per day. Colour is
-- hardcoded to 'amber' rather than computed — that is exactly what
-- colorForClass('Example') in src/domain/color.ts resolves to, kept in sync
-- by hand since this migration cannot import the client's hash function.
--
-- Delete-then-insert (same shape as replace_schedule in 0002) makes this
-- safe to paste more than once, and safe to re-run if this account is ever
-- deleted and recreated like schedulematcher.info's profile row already was
-- once (see 0012) — it will not pile up duplicate "Example" rows.
delete from public.classes
where user_id = (
  select id from auth.users where lower(email) = 'schedulematcher.info@gmail.com'
);

insert into public.classes (user_id, name, days, start_minute, end_minute, color, sort_order)
select
  (select id from auth.users where lower(email) = 'schedulematcher.info@gmail.com'),
  'Example', v.days, v.start_minute, v.end_minute, 'amber', v.sort_order
from (
  values
    (array[1]::smallint[], 540::smallint, 630::smallint, 0::smallint), -- Mon  9:00-10:30
    (array[2]::smallint[], 660::smallint, 750::smallint, 1::smallint), -- Tue 11:00-12:30
    (array[3]::smallint[], 780::smallint, 840::smallint, 2::smallint), -- Wed 13:00-14:00
    (array[4]::smallint[], 600::smallint, 680::smallint, 3::smallint), -- Thu 10:00-11:20
    (array[5]::smallint[], 840::smallint, 900::smallint, 4::smallint)  -- Fri 14:00-15:00
) as v(days, start_minute, end_minute, sort_order)
where exists (
  select 1 from auth.users where lower(email) = 'schedulematcher.info@gmail.com'
);
