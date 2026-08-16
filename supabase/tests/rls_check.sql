-- supabase/tests/rls_check.sql
-- Verifies the one policy that would leak private data if wrong:
-- a non-friend must not be able to read another student's classes.
-- Run against a scratch database, not production.

begin;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@test.dev'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.dev');

insert into public.profiles (id, username) values
  ('11111111-1111-1111-1111-111111111111', 'alpha'),
  ('22222222-2222-2222-2222-222222222222', 'bravo');

insert into public.classes (user_id, name, days, start_minute, end_minute, color)
values ('11111111-1111-1111-1111-111111111111', 'BIO 101', array[1,3]::smallint[], 600, 650, 'indigo');

set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

-- Not friends yet: bravo must see zero rows.
do $$
begin
  if (select count(*) from public.classes) <> 0 then
    raise exception 'LEAK: a non-friend can read classes';
  end if;
end $$;

reset role;
insert into public.friendships (requester_id, addressee_id, status)
values ('11111111-1111-1111-1111-111111111111',
        '22222222-2222-2222-2222-222222222222', 'accepted');

set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

do $$
begin
  if (select count(*) from public.classes) <> 1 then
    raise exception 'BROKEN: an accepted friend cannot read classes';
  end if;
end $$;

rollback;
