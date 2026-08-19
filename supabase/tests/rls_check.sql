-- supabase/tests/rls_check.sql
--
-- Proves the one policy that would leak private data if wrong: a student who is
-- NOT your friend must not be able to read your classes, and one who IS must.
--
-- Runs as a single self-cleaning DO block so it can be executed through the
-- Management API or the SQL Editor. It raises on failure and leaves no rows
-- behind on success. Safe to re-run.
--
--   FAIL "LEAK:"   -> private data was readable, or writable, by the wrong student
--   FAIL "BROKEN:" -> a legitimate read or write was refused
--   FAIL "RPC:"    -> are_friends is callable by authenticated users

do $$
declare
  uid_a uuid := '11111111-1111-1111-1111-111111111111';
  uid_b uuid := '22222222-2222-2222-2222-222222222222';
  visible int;
  forged boolean := false;
begin
  -- Clean slate (cascades to profiles/classes/friendships).
  delete from auth.users where id in (uid_a, uid_b);

  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
  values
    (uid_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'rls_check_a@example.test', now(), now()),
    (uid_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'rls_check_b@example.test', now(), now());

  insert into public.profiles (id, username) values (uid_a, 'rlscheckaaa'), (uid_b, 'rlscheckbbb');

  insert into public.classes (user_id, name, days, start_minute, end_minute, color)
  values (uid_a, 'BIO 101', array[1,3]::smallint[], 600, 650, 'indigo');

  ------------------------------------------------------------------
  -- Act as B, who is NOT A's friend.
  ------------------------------------------------------------------
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid_b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  select count(*) into visible from public.classes where user_id = uid_a;
  if visible <> 0 then
    execute 'reset role';
    raise exception 'LEAK: a non-friend read % of A''s class rows', visible;
  end if;

  execute 'reset role';

  -- are_friends must not live in an exposed schema, or the whole friendship
  -- graph is enumerable via POST /rest/v1/rpc/are_friends. It belongs in
  -- `private`, which PostgREST does not serve (see migration 0003).
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.proname = 'are_friends' and n.nspname = 'public'
  ) then
    raise exception 'RPC: are_friends is in the PostgREST-exposed public schema';
  end if;

  ------------------------------------------------------------------
  -- Now make them friends and re-check.
  ------------------------------------------------------------------
  insert into public.friendships (requester_id, addressee_id, status)
  values (uid_a, uid_b, 'accepted');

  perform set_config('request.jwt.claims',
    json_build_object('sub', uid_b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  select count(*) into visible from public.classes where user_id = uid_a;
  execute 'reset role';

  if visible <> 1 then
    raise exception 'BROKEN: an accepted friend saw % rows, expected 1', visible;
  end if;

  ------------------------------------------------------------------
  -- app_events (migration 0009). Insert-your-own, read nothing.
  --
  -- The table has an insert policy and deliberately no select policy, so
  -- `authenticated` can read nothing at all — not even its own rows. That is
  -- an unusual shape and worth proving rather than assuming: a stray select
  -- policy added later would turn a counting table into a log of who compares
  -- schedules with whom and how often.
  ------------------------------------------------------------------
  insert into public.app_events (user_id, kind) values (uid_a, 'open');

  perform set_config('request.jwt.claims',
    json_build_object('sub', uid_b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  select count(*) into visible from public.app_events;
  if visible <> 0 then
    execute 'reset role';
    raise exception 'LEAK: an authenticated student read % app_events rows', visible;
  end if;

  -- Recording your own event must work, or the whole Phase 0 dataset is empty
  -- and nothing says so — the client swallows write errors by design.
  begin
    insert into public.app_events (user_id, kind, friend_count)
    values (uid_b, 'compare_group', 3);
  exception when others then
    execute 'reset role';
    raise exception 'BROKEN: a student could not record their own event (%)', sqlerrm;
  end;

  -- Attributing an event to somebody else must not.
  begin
    insert into public.app_events (user_id, kind) values (uid_a, 'open');
    forged := true;
  exception when insufficient_privilege then
    null;  -- expected: with check (user_id = auth.uid())
  end;

  execute 'reset role';

  if forged then
    raise exception 'LEAK: a student wrote an app_event attributed to another user';
  end if;

  ------------------------------------------------------------------
  delete from auth.users where id in (uid_a, uid_b);
  raise notice 'RLS CHECK PASSED: non-friend blocked, friend allowed, are_friends not exposed, app_events write-only and self-scoped';
end $$;
