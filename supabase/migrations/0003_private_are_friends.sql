-- supabase/migrations/0003_private_are_friends.sql
--
-- Fixes a defect found by running supabase/tests/rls_check.sql against a live
-- database.
--
-- 0002 revoked EXECUTE on public.are_friends from `authenticated` to stop the
-- friendship graph being enumerable via PostgREST's auto-generated
-- POST /rest/v1/rpc/are_friends. That reasoning was right, but the fix was
-- wrong: RLS policy expressions are evaluated with the privileges of the
-- QUERYING role, not the table owner. So the revoke also broke classes_select,
-- and reading an accepted friend's schedule failed with:
--
--   42501: permission denied for function are_friends
--
-- The correct approach is to keep EXECUTE but move the function out of reach of
-- PostgREST. Supabase exposes only `public` (and `graphql_public`), so a helper
-- living in `private` is callable from a policy but has no HTTP surface.

create schema if not exists private;

-- Deliberately NOT granted to anon: only signed-in users evaluate this policy.
grant usage on schema private to authenticated, service_role;

create or replace function private.are_friends(a uuid, b uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.friendships
    where status = 'accepted'
      and ((requester_id = a and addressee_id = b)
        or (requester_id = b and addressee_id = a))
  );
$$;

grant execute on function private.are_friends(uuid, uuid) to authenticated, service_role;

-- Repoint the policy, then retire the public copy. Order matters: the policy
-- depends on the function, so it must be dropped first.
drop policy if exists classes_select on public.classes;

create policy classes_select on public.classes
  for select to authenticated
  using (user_id = auth.uid() or private.are_friends(auth.uid(), user_id));

drop function if exists public.are_friends(uuid, uuid);
