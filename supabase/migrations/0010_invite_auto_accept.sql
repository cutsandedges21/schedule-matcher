-- supabase/migrations/0010_invite_auto_accept.sql
--
-- Opening someone's invite link should make you friends immediately, not
-- file a request they have to go approve. `friendships_insert` (0002) only
-- allows a direct client insert with status = 'pending' — deliberately, so no
-- one can insert a friendship claiming the other side already agreed. This
-- function is the one narrow, validated exception: the invite code itself,
-- generated and shared by its owner, is the consent that normally comes from
-- the addressee accepting a pending request.

create or replace function public.accept_invite(p_code text)
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

  select id into v_owner from public.profiles where invite_code = p_code;

  if v_owner is null then
    raise exception 'That invite link is not valid.';
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

-- No revoke here: the client calls this directly via supabase.rpc(), same as
-- replace_schedule in 0002. security definer is what lets it write an
-- 'accepted' row that friendships_insert would otherwise reject outright.
