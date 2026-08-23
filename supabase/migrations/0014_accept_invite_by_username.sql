-- supabase/migrations/0014_accept_invite_by_username.sql
--
-- The invite link moves from /invite/<random invite_code> to
-- /invite/<username> — a readable link instead of a random string. The
-- owner explicitly chose this: a username is not secret (it is searchable
-- in-app, same as the existing FriendSearch flow), so this link now works
-- the same way username search already does — anyone who knows or guesses
-- your username can open it and be instantly friended, no approval step.
-- That is a deliberate trade of the previous unguessable-link protection for
-- a cleaner URL, not an oversight.
--
-- Same function name and the same single-text-argument signature, so this is
-- a true replace rather than a new overload — but Postgres refuses to rename
-- a parameter (p_code -> p_username, needed because the client's rpc() call
-- passes it as a named argument) via a bare CREATE OR REPLACE: "cannot change
-- name of input parameter". The DROP first is what 0010's own version did not
-- need, since it only added the function rather than renaming its parameter.

drop function if exists public.accept_invite(text);

create or replace function public.accept_invite(p_username text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_owner  uuid;
begin
  if v_caller is null then
    raise exception 'accept_invite requires an authenticated user';
  end if;

  select id into v_owner from public.profiles where username = p_username;

  if v_owner is null then
    raise exception 'No student with that username.';
  end if;

  if v_owner = v_caller then
    raise exception 'That is your own invite link.';
  end if;

  -- Upserts across the same (least, greatest) pair the unique index in 0001
  -- keys on, so this is idempotent: a stale pending request in either
  -- direction is upgraded to accepted, and revisiting the link once already
  -- friends is a no-op rather than an error.
  insert into public.friendships (requester_id, addressee_id, status, responded_at)
  values (v_caller, v_owner, 'accepted', now())
  on conflict (least(requester_id, addressee_id), greatest(requester_id, addressee_id))
  do update set status = 'accepted', responded_at = now()
  where public.friendships.status <> 'accepted';

  return v_owner;
end;
$$;
