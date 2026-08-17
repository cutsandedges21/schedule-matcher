-- supabase/migrations/0005_delete_account.sql
--
-- "Delete my account" in Settings, as SQL rather than as an Edge Function.
--
-- Deleting an auth.users row needs privileges the browser's publishable key
-- does not have at any RLS setting. supabase/functions/delete-account does it
-- through the admin API, but deploying a function needs a management access
-- token; this does the same job with nothing but SQL Editor access, which is
-- why the client tries it first.
--
-- security definer is the entire point: the function body runs as its owner
-- (postgres, when this is run from the SQL Editor or pushed as a migration),
-- which is what makes the delete possible. Everything else follows by cascade:
--   auth.users -> public.profiles -> public.classes, public.friendships
--   auth.users -> public.extraction_log
--   auth.users -> auth.identities, auth.sessions, auth.refresh_tokens
--
-- It takes NO arguments on purpose. The id comes from auth.uid(), i.e. from the
-- caller's own verified JWT, so an authenticated user can only ever delete
-- themselves. Adding a p_user_id parameter here would turn this into a
-- "delete anyone you can name" hole — don't.

create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'delete_account requires an authenticated user'
      using errcode = '28000';
  end if;

  delete from auth.users where id = v_uid;
end;
$$;

-- Functions created in `public` are executable by PUBLIC by default, which
-- would include `anon`. An anonymous caller has no auth.uid() so the guard
-- above already stops them, but there is no reason to leave the door ajar.
revoke execute on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;
