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
