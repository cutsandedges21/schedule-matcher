-- supabase/migrations/0002_rls.sql

create or replace function public.are_friends(a uuid, b uuid)
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

-- security definer + PostgREST auto-exposure would otherwise make this callable
-- as POST /rest/v1/rpc/are_friends by any signed-in user, letting them enumerate
-- profile ids and map the whole friendship graph. Revoke direct execute; the
-- classes_select policy below still works because policy expressions evaluate
-- as the table owner, not as the calling role. Do not remove this revoke.
revoke execute on function public.are_friends(uuid, uuid) from public, anon, authenticated;

alter table public.profiles       enable row level security;
alter table public.classes        enable row level security;
alter table public.friendships    enable row level security;
alter table public.extraction_log enable row level security;

-- profiles: readable by any signed-in user so username search works.
-- Holds only username, display name, avatar and invite code.
create policy profiles_select on public.profiles
  for select to authenticated using (true);

create policy profiles_insert on public.profiles
  for insert to authenticated with check (id = auth.uid());

create policy profiles_update on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- classes: mine, or an accepted friend's.
create policy classes_select on public.classes
  for select to authenticated
  using (user_id = auth.uid() or public.are_friends(auth.uid(), user_id));

create policy classes_insert on public.classes
  for insert to authenticated with check (user_id = auth.uid());

create policy classes_update on public.classes
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy classes_delete on public.classes
  for delete to authenticated using (user_id = auth.uid());

-- friendships: visible to both parties; only the addressee can accept.
create policy friendships_select on public.friendships
  for select to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());

create policy friendships_insert on public.friendships
  for insert to authenticated
  with check (requester_id = auth.uid() and status = 'pending');

create policy friendships_update on public.friendships
  for update to authenticated
  using (addressee_id = auth.uid() and status = 'pending')
  with check (addressee_id = auth.uid() and status = 'accepted');

create policy friendships_delete on public.friendships
  for delete to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());

-- extraction_log: readable by its owner; written only by the Edge Function
-- using the service role key, which bypasses RLS.
create policy extraction_log_select on public.extraction_log
  for select to authenticated using (user_id = auth.uid());

-- Atomically replaces a user's entire schedule (design spec §8). security invoker
-- (not definer) so RLS still applies and auth.uid() resolves to the caller — this
-- must never bypass the ownership checks the classes_* policies enforce. PostgREST
-- wraps a single RPC call in one transaction, so the delete+insert here is atomic:
-- a dropped connection can no longer destroy a schedule without replacing it.
create or replace function public.replace_schedule(p_classes jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'replace_schedule requires an authenticated user';
  end if;

  delete from public.classes where user_id = v_uid;

  insert into public.classes (
    user_id, name, instructor, room, days, start_minute, end_minute, color, sort_order
  )
  select
    v_uid,
    btrim(elem->>'name'),
    nullif(btrim(elem->>'instructor'), ''),
    nullif(btrim(elem->>'room'), ''),
    (
      select coalesce(array_agg(d::smallint), array[]::smallint[])
      from jsonb_array_elements_text(elem->'days') as d
    ),
    (elem->>'start_minute')::smallint,
    (elem->>'end_minute')::smallint,
    elem->>'color',
    coalesce((elem->>'sort_order')::smallint, 0)
  from jsonb_array_elements(p_classes) as elem;
  -- jsonb_array_elements() over an empty array yields zero rows, so an empty
  -- p_classes correctly deletes everything above and inserts nothing here.
end;
$$;

-- No revoke here: the client calls this directly via supabase.rpc().

-- Atomic check-and-insert for the extraction rate limit, replacing the client's
-- former count-then-insert (TOCTOU: concurrent calls could all observe a
-- pre-insert count and all pass). security definer so it runs with the function
-- owner's privileges regardless of who calls it; only the service role (via the
-- Edge Function) is granted execute below, so this never runs on a caller's
-- behalf directly. Locking per-user via pg_advisory_xact_lock serialises
-- concurrent calls for the same user for the duration of this transaction,
-- closing the race.
create or replace function public.log_extraction(p_user_id uuid, p_limit int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  select count(*) into v_count
  from public.extraction_log
  where user_id = p_user_id
    and created_at >= now() - interval '1 hour';

  if v_count >= p_limit then
    return false;
  end if;

  insert into public.extraction_log (user_id) values (p_user_id);
  return true;
end;
$$;

-- Only the service role (Edge Function) may call this; it takes an arbitrary
-- p_user_id with no ownership check, so exposing it to authenticated/anon would
-- let any user log extractions (or exhaust the limit) for any other user.
revoke execute on function public.log_extraction(uuid, int) from public, anon, authenticated;
