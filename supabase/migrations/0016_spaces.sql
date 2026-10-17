-- supabase/migrations/0016_spaces.sql
--
-- Spaces: one shared place per group (a class section, a project team, a club,
-- roommates). Design: docs/superpowers/specs/2026-10-17-spaces-platform-design.md
--
-- This migration is the membership backbone every later one builds on:
--
--   spaces                    the group itself
--   space_members             who is in it, and as what (owner / admin / member)
--   space_invites             shareable links (revocable, expiring, use-limited)
--   space_invitations         direct invitations to an existing student
--   space_activity            the group's history, written only by server code
--   notifications             in-app inbox, written only by server code
--   notification_preferences  per-student category switches
--
-- THE RULES THAT HOLD EVERYWHERE BELOW
--
--   * Reads are gated by private.is_space_member(), a security definer helper
--     in the `private` schema. PostgREST does not serve `private`, so it has no
--     HTTP surface, but `authenticated` keeps EXECUTE on it: policy expressions
--     run with the QUERYING role's privileges (the lesson of 0003).
--   * space_members has no client insert or delete policy. Joining, inviting,
--     removing, role changes and ownership transfer all go through functions
--     that re-check the caller's role, so a forged request cannot add itself to
--     a group or promote itself.
--   * Activity and notifications have no client insert path at all, so neither
--     can be forged.
--   * Exactly one owner per space, enforced by a partial unique index rather
--     than by convention.

create schema if not exists private;

-- ---------------------------------------------------------------------------
-- Generic helpers
-- ---------------------------------------------------------------------------

-- 22-character base64url token. gen_random_uuid() draws from the strong
-- random source (unlike random(), which seeds the older profiles.invite_code),
-- giving 122 random bits with no pgcrypto dependency.
create or replace function private.random_token()
returns text
language sql
volatile
set search_path = public
as $$
  select translate(
    rtrim(encode(decode(replace(gen_random_uuid()::text, '-', ''), 'hex'), 'base64'), '='),
    '+/',
    '-_'
  );
$$;

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.spaces (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  description         text,
  kind                text not null default 'group',
  -- The zone a Space's daily search window and its event times are read in.
  -- Montreal by default; America/Montreal is a deprecated alias of this.
  timezone            text not null default 'America/Toronto',
  members_can_invite  boolean not null default false,
  created_by          uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint spaces_name_length check (char_length(btrim(name)) between 1 and 80),
  constraint spaces_description_length check (description is null or char_length(description) <= 500),
  constraint spaces_kind check (
    kind in ('class', 'project', 'study', 'club', 'friends', 'roommates', 'team', 'group')
  ),
  -- A format check, not a lookup: an IANA name like America/Argentina/Buenos_Aires
  -- or Etc/GMT+5. The client resolves names through Intl before writing them.
  constraint spaces_timezone_format check (timezone ~ '^[A-Za-z][A-Za-z0-9_+/-]{0,63}$')
);

create table public.space_members (
  space_id     uuid not null references public.spaces(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  role         text not null default 'member',
  -- How much of this member's availability the rest of THIS space sees:
  --   hidden   nothing; they are "unknown" in matching
  --   busy     busy times only, no names or labels (the default)
  --   details  busy times plus class names and one-off block labels
  share_level  text not null default 'busy',
  -- A personal favourite flag, sorted first on the student's own lists.
  pinned       boolean not null default false,
  joined_at    timestamptz not null default now(),
  primary key (space_id, user_id),
  constraint space_members_role check (role in ('owner', 'admin', 'member')),
  constraint space_members_share_level check (share_level in ('hidden', 'busy', 'details'))
);

create unique index space_members_one_owner on public.space_members (space_id) where role = 'owner';
create index space_members_user_idx on public.space_members (user_id);

create table public.space_invites (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references public.spaces(id) on delete cascade,
  code        text not null default private.random_token(),
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz,
  max_uses    integer,
  use_count   integer not null default 0,
  revoked_at  timestamptz,
  constraint space_invites_max_uses check (max_uses is null or max_uses between 1 and 500),
  constraint space_invites_use_count check (use_count >= 0)
);

create unique index space_invites_code_key on public.space_invites (code);
create index space_invites_space_idx on public.space_invites (space_id);

create table public.space_invitations (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references public.spaces(id) on delete cascade,
  invitee_id  uuid not null references public.profiles(id) on delete cascade,
  invited_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint space_invitations_once unique (space_id, invitee_id)
);

create index space_invitations_invitee_idx on public.space_invitations (invitee_id);

create table public.space_activity (
  id           bigint generated always as identity primary key,
  space_id     uuid not null references public.spaces(id) on delete cascade,
  actor_id     uuid references public.profiles(id) on delete set null,
  verb         text not null,
  entity_type  text,
  entity_id    uuid,
  -- Phrased without the actor ("created the task …"); the client prefixes the
  -- actor's current username, so a rename does not leave stale names behind.
  summary      text not null,
  created_at   timestamptz not null default now(),
  constraint space_activity_verb check (verb ~ '^[a-z_]+\.[a-z_]+$'),
  constraint space_activity_summary_length check (char_length(summary) between 1 and 300)
);

create index space_activity_space_time_idx on public.space_activity (space_id, created_at desc);

create table public.notifications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  -- Null when the recipient has lost access to the space (removed from it, or
  -- it was deleted): the notice has to outlive the space it is about.
  space_id      uuid references public.spaces(id) on delete cascade,
  kind          text not null,
  title         text not null,
  body          text,
  link          text,
  entity_id     uuid,
  -- One row per (user, key). Repeated edits to one event refresh a single
  -- "Event updated" notice instead of stacking five of them.
  dedupe_key    text,
  read_at       timestamptz,
  dismissed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint notifications_kind check (kind in (
    'space_invite', 'space_update',
    'task_assigned', 'task_due',
    'event_invite', 'event_changed', 'event_reminder',
    'poll_open', 'poll_closed'
  )),
  constraint notifications_title_length check (char_length(title) between 1 and 200),
  constraint notifications_body_length check (body is null or char_length(body) <= 500),
  -- In-app paths only. '//evil.example' is a protocol-relative URL, so a
  -- doubled leading slash is refused along with any scheme.
  constraint notifications_link_path check (link is null or link ~ '^/([^/].*)?$')
);

create unique index notifications_dedupe_key
  on public.notifications (user_id, dedupe_key) where dedupe_key is not null;
create index notifications_user_time_idx on public.notifications (user_id, created_at desc);

-- A missing row means "everything on". Six categories rather than one switch
-- per kind: nobody wants to reason about event_invite vs event_changed.
create table public.notification_preferences (
  user_id        uuid primary key references public.profiles(id) on delete cascade,
  invites        boolean not null default true,
  space_updates  boolean not null default true,
  tasks          boolean not null default true,
  deadlines      boolean not null default true,
  events         boolean not null default true,
  polls          boolean not null default true,
  updated_at     timestamptz not null default now()
);

create trigger spaces_touch_updated_at before update on public.spaces
  for each row execute function private.touch_updated_at();
create trigger notifications_touch_updated_at before update on public.notifications
  for each row execute function private.touch_updated_at();
create trigger notification_preferences_touch_updated_at before update on public.notification_preferences
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Policy helpers (private schema: callable from policies, not over HTTP)
-- ---------------------------------------------------------------------------

create or replace function private.space_role(p_space_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.space_members
  where space_id = p_space_id and user_id = auth.uid();
$$;

create or replace function private.is_space_member(p_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.space_members
    where space_id = p_space_id and user_id = auth.uid()
  );
$$;

create or replace function private.is_space_manager(p_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.space_members
    where space_id = p_space_id and user_id = auth.uid() and role in ('owner', 'admin')
  );
$$;

create or replace function private.is_space_owner(p_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.space_members
    where space_id = p_space_id and user_id = auth.uid() and role = 'owner'
  );
$$;

create or replace function private.is_space_invitee(p_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.space_invitations
    where space_id = p_space_id and invitee_id = auth.uid()
  );
$$;

-- Raises unless the caller holds at least p_min_role in the space; returns
-- their actual role. Every RPC below opens with this, so the permission
-- wording is the same everywhere.
create or replace function private.require_space_role(p_space_id uuid, p_min_role text default 'member')
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  if auth.uid() is null then
    raise exception 'You need to be signed in.' using errcode = '28000';
  end if;

  select role into v_role from public.space_members
  where space_id = p_space_id and user_id = auth.uid();

  if v_role is null then
    raise exception 'You are not a member of this space.' using errcode = '42501';
  end if;
  if p_min_role = 'owner' and v_role <> 'owner' then
    raise exception 'Only the owner can do that.' using errcode = '42501';
  end if;
  if p_min_role = 'admin' and v_role not in ('owner', 'admin') then
    raise exception 'Only the owner and admins can do that.' using errcode = '42501';
  end if;

  return v_role;
end;
$$;

revoke execute on function private.space_role(uuid) from public, anon;
revoke execute on function private.is_space_member(uuid) from public, anon;
revoke execute on function private.is_space_manager(uuid) from public, anon;
revoke execute on function private.is_space_owner(uuid) from public, anon;
revoke execute on function private.is_space_invitee(uuid) from public, anon;
revoke execute on function private.require_space_role(uuid, text) from public, anon;
grant execute on function private.space_role(uuid) to authenticated, service_role;
grant execute on function private.is_space_member(uuid) to authenticated, service_role;
grant execute on function private.is_space_manager(uuid) to authenticated, service_role;
grant execute on function private.is_space_owner(uuid) to authenticated, service_role;
grant execute on function private.is_space_invitee(uuid) to authenticated, service_role;
grant execute on function private.require_space_role(uuid, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Server-only writers: activity and notifications
-- ---------------------------------------------------------------------------

create or replace function private.log_activity(
  p_space_id uuid,
  p_actor uuid,
  p_verb text,
  p_entity_type text,
  p_entity_id uuid,
  p_summary text
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.space_activity (space_id, actor_id, verb, entity_type, entity_id, summary)
  values (p_space_id, p_actor, p_verb, p_entity_type, p_entity_id, left(p_summary, 300));
$$;

-- Never notifies the actor about their own action, and honours the
-- recipient's category switches. With p_refresh, a repeat of the same
-- dedupe key brings the existing notice back to the top as unread; without
-- it, a repeat is dropped (reminders must fire once, not once per app open).
create or replace function private.notify(
  p_user uuid,
  p_actor uuid,
  p_space_id uuid,
  p_kind text,
  p_title text,
  p_body text,
  p_link text,
  p_entity_id uuid,
  p_dedupe_key text,
  p_refresh boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enabled boolean;
begin
  if p_user is null or p_user = p_actor then
    return;
  end if;

  select case
           when p_kind = 'space_invite' then invites
           when p_kind = 'space_update' then space_updates
           when p_kind = 'task_assigned' then tasks
           when p_kind in ('task_due', 'event_reminder') then deadlines
           when p_kind in ('event_invite', 'event_changed') then events
           when p_kind in ('poll_open', 'poll_closed') then polls
         end
    into v_enabled
  from public.notification_preferences
  where user_id = p_user;

  if v_enabled is false then
    return;
  end if;

  if p_dedupe_key is not null and p_refresh then
    insert into public.notifications (user_id, space_id, kind, title, body, link, entity_id, dedupe_key)
    values (p_user, p_space_id, p_kind, left(p_title, 200), left(p_body, 500), p_link, p_entity_id, p_dedupe_key)
    on conflict (user_id, dedupe_key) where dedupe_key is not null
    do update set
      space_id = excluded.space_id,
      kind = excluded.kind,
      title = excluded.title,
      body = excluded.body,
      link = excluded.link,
      entity_id = excluded.entity_id,
      read_at = null,
      dismissed_at = null,
      created_at = now();
  else
    insert into public.notifications (user_id, space_id, kind, title, body, link, entity_id, dedupe_key)
    values (p_user, p_space_id, p_kind, left(p_title, 200), left(p_body, 500), p_link, p_entity_id, p_dedupe_key)
    on conflict (user_id, dedupe_key) where dedupe_key is not null
    do nothing;
  end if;
end;
$$;

revoke execute on function private.log_activity(uuid, uuid, text, text, uuid, text) from public, anon, authenticated;
revoke execute on function private.notify(uuid, uuid, uuid, text, text, text, text, uuid, text, boolean)
  from public, anon, authenticated;

-- The one way a student enters a space after it exists. Locks the space row
-- so two joins racing for the last seat cannot both get in.
create or replace function private.add_space_member(p_space_id uuid, p_user_id uuid, p_summary text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  perform 1 from public.spaces where id = p_space_id for update;
  if not found then
    raise exception 'That space no longer exists.';
  end if;

  if exists (select 1 from public.space_members where space_id = p_space_id and user_id = p_user_id) then
    return;
  end if;

  select count(*) into v_count from public.space_members where space_id = p_space_id;
  -- MAX_SPACE_MEMBERS in src/domain/spaces.ts. An abuse bound, not a price
  -- point; see design doc §2.
  if v_count >= 50 then
    raise exception 'This space is full (50 members).';
  end if;

  -- MAX_SPACES_PER_STUDENT in src/domain/spaces.ts.
  if (select count(*) from public.space_members where user_id = p_user_id) >= 100 then
    raise exception 'You are already in 100 spaces, the most allowed.';
  end if;

  insert into public.space_members (space_id, user_id, role) values (p_space_id, p_user_id, 'member');
  perform private.log_activity(p_space_id, p_user_id, 'member.joined', 'profile', p_user_id, p_summary);
end;
$$;

revoke execute on function private.add_space_member(uuid, uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.spaces                   enable row level security;
alter table public.space_members            enable row level security;
alter table public.space_invites            enable row level security;
alter table public.space_invitations        enable row level security;
alter table public.space_activity           enable row level security;
alter table public.notifications            enable row level security;
alter table public.notification_preferences enable row level security;

-- spaces: members see their spaces; an invitee may see the one they were
-- invited to (name and kind) so they can decide. No insert policy: create_space()
-- is the only way in, so a space can never exist without an owner.
create policy spaces_select on public.spaces
  for select to authenticated
  using (private.is_space_member(id) or private.is_space_invitee(id));

create policy spaces_update on public.spaces
  for update to authenticated
  using (private.is_space_manager(id))
  with check (private.is_space_manager(id));

create policy spaces_delete on public.spaces
  for delete to authenticated
  using (private.is_space_owner(id));

revoke insert, update on public.spaces from anon, authenticated;
grant update (name, description, kind, timezone, members_can_invite) on public.spaces to authenticated;

-- space_members: visible to fellow members. A member may change only their
-- own share level and pin; role changes go through set_member_role().
create policy space_members_select on public.space_members
  for select to authenticated
  using (private.is_space_member(space_id));

create policy space_members_update_self on public.space_members
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke insert, update, delete on public.space_members from anon, authenticated;
grant update (share_level, pinned) on public.space_members to authenticated;

-- space_invites: managers see every link; a member who made one sees their own.
create policy space_invites_select on public.space_invites
  for select to authenticated
  using (
    private.is_space_manager(space_id)
    or (created_by = auth.uid() and private.is_space_member(space_id))
  );

revoke insert, update, delete on public.space_invites from anon, authenticated;

-- space_invitations: the invitee sees their own; members see who is pending.
-- Deleting is declining (invitee) or cancelling (inviter, or a manager).
create policy space_invitations_select on public.space_invitations
  for select to authenticated
  using (invitee_id = auth.uid() or private.is_space_member(space_id));

create policy space_invitations_delete on public.space_invitations
  for delete to authenticated
  using (
    invitee_id = auth.uid()
    or invited_by = auth.uid()
    or private.is_space_manager(space_id)
  );

revoke insert, update on public.space_invitations from anon, authenticated;

-- space_activity: members read; nobody writes from the client.
create policy space_activity_select on public.space_activity
  for select to authenticated
  using (private.is_space_member(space_id));

revoke insert, update, delete on public.space_activity from anon, authenticated;

-- notifications: your own, and you may only mark them read or dismissed.
create policy notifications_select on public.notifications
  for select to authenticated
  using (user_id = auth.uid());

create policy notifications_update on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy notifications_delete on public.notifications
  for delete to authenticated
  using (user_id = auth.uid());

revoke insert, update on public.notifications from anon, authenticated;
grant update (read_at, dismissed_at) on public.notifications to authenticated;

-- notification_preferences: your own row, nothing else.
create policy notification_preferences_select on public.notification_preferences
  for select to authenticated using (user_id = auth.uid());
create policy notification_preferences_insert on public.notification_preferences
  for insert to authenticated with check (user_id = auth.uid());
create policy notification_preferences_update on public.notification_preferences
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke delete on public.notification_preferences from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Triggers: history, ownership hand-off, deletion notices
-- ---------------------------------------------------------------------------

create or replace function private.after_space_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.name is distinct from old.name then
    perform private.log_activity(new.id, auth.uid(), 'space.renamed', 'space', new.id,
      'renamed the space to "' || new.name || '"');
  elsif (new.description, new.kind, new.timezone, new.members_can_invite)
        is distinct from (old.description, old.kind, old.timezone, old.members_can_invite) then
    perform private.log_activity(new.id, auth.uid(), 'space.updated', 'space', new.id,
      'updated the space settings');
  end if;
  return null;
end;
$$;

create trigger spaces_after_update after update on public.spaces
  for each row execute function private.after_space_updated();

create or replace function private.before_space_deleted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member uuid;
begin
  for v_member in select user_id from public.space_members where space_id = old.id loop
    perform private.notify(v_member, auth.uid(), null, 'space_update',
      '"' || old.name || '" was deleted',
      'The space and everything in it is gone.',
      '/spaces', null, null);
  end loop;
  return old;
end;
$$;

create trigger spaces_before_delete before delete on public.spaces
  for each row execute function private.before_space_deleted();

-- When the owner's row goes — their account was deleted, which cascades here —
-- the longest-standing admin takes over, else the longest-standing member.
-- With nobody left, the space goes too. A space being deleted outright also
-- cascades through here; by then its row is gone and there is nothing to do.
create or replace function private.after_space_member_deleted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next uuid;
  v_name text;
begin
  if old.role <> 'owner' then
    return null;
  end if;

  select name into v_name from public.spaces where id = old.space_id;
  if v_name is null then
    return null;
  end if;

  select user_id into v_next
  from public.space_members
  where space_id = old.space_id
  order by (role = 'admin') desc, joined_at, user_id
  limit 1;

  if v_next is null then
    delete from public.spaces where id = old.space_id;
    return null;
  end if;

  update public.space_members set role = 'owner'
  where space_id = old.space_id and user_id = v_next;

  perform private.log_activity(old.space_id, v_next, 'member.promoted', 'profile', v_next,
    'became the owner');
  perform private.notify(v_next, null, old.space_id, 'space_update',
    'You now own "' || v_name || '"',
    'The previous owner left, so ownership passed to you.',
    '/spaces/' || old.space_id || '/members', old.space_id, null);

  return null;
end;
$$;

create trigger space_members_after_delete after delete on public.space_members
  for each row execute function private.after_space_member_deleted();

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

create or replace function public.create_space(
  p_name text,
  p_kind text default 'group',
  p_description text default null,
  p_timezone text default 'America/Toronto'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_space uuid;
begin
  if v_uid is null then
    raise exception 'You need to be signed in.' using errcode = '28000';
  end if;
  if not exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'Finish setting up your profile first.' using errcode = '42501';
  end if;
  if (select count(*) from public.space_members where user_id = v_uid) >= 100 then
    raise exception 'You are already in 100 spaces, the most allowed.';
  end if;

  insert into public.spaces (name, kind, description, timezone, created_by)
  values (
    btrim(p_name),
    coalesce(p_kind, 'group'),
    nullif(btrim(p_description), ''),
    coalesce(nullif(btrim(p_timezone), ''), 'America/Toronto'),
    v_uid
  )
  returning id into v_space;

  insert into public.space_members (space_id, user_id, role) values (v_space, v_uid, 'owner');
  perform private.log_activity(v_space, v_uid, 'space.created', 'space', v_space, 'created the space');

  return v_space;
end;
$$;

-- Every space the caller belongs to, with their own membership settings and a
-- head count. security invoker: RLS does the filtering, so this can never
-- show a space the caller could not have selected directly.
create or replace function public.my_spaces()
returns table (
  id uuid,
  name text,
  description text,
  kind text,
  timezone text,
  members_can_invite boolean,
  created_at timestamptz,
  updated_at timestamptz,
  role text,
  share_level text,
  pinned boolean,
  joined_at timestamptz,
  member_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select s.id, s.name, s.description, s.kind, s.timezone, s.members_can_invite,
         s.created_at, s.updated_at,
         m.role, m.share_level, m.pinned, m.joined_at,
         (select count(*) from public.space_members c where c.space_id = s.id)
  from public.space_members m
  join public.spaces s on s.id = m.space_id
  where m.user_id = auth.uid()
  order by m.pinned desc, s.updated_at desc;
$$;

-- Pending direct invitations addressed to the caller, with enough context to
-- decide. security invoker for the same reason as my_spaces().
create or replace function public.my_space_invitations()
returns table (
  id uuid,
  space_id uuid,
  space_name text,
  space_kind text,
  invited_by_username text,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select i.id, i.space_id, s.name, s.kind, p.username, i.created_at
  from public.space_invitations i
  join public.spaces s on s.id = i.space_id
  left join public.profiles p on p.id = i.invited_by
  where i.invitee_id = auth.uid()
  order by i.created_at desc;
$$;

create or replace function public.create_space_invite(
  p_space_id uuid,
  p_expires_in_hours integer default 168,
  p_max_uses integer default null
)
returns public.space_invites
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := private.require_space_role(p_space_id, 'member');
  v_row public.space_invites;
begin
  if v_role = 'member'
     and not (select members_can_invite from public.spaces where id = p_space_id) then
    raise exception 'Only the owner and admins can invite people to this space.' using errcode = '42501';
  end if;
  if p_expires_in_hours is not null and (p_expires_in_hours < 1 or p_expires_in_hours > 24 * 90) then
    raise exception 'A link can last between 1 hour and 90 days.';
  end if;
  if p_max_uses is not null and (p_max_uses < 1 or p_max_uses > 500) then
    raise exception 'A link can allow between 1 and 500 uses.';
  end if;
  if (
    select count(*) from public.space_invites
    where space_id = p_space_id
      and revoked_at is null
      and (expires_at is null or expires_at > now())
  ) >= 20 then
    raise exception 'This space already has 20 active links. Turn one off first.';
  end if;

  insert into public.space_invites (space_id, created_by, expires_at, max_uses)
  values (
    p_space_id,
    auth.uid(),
    case when p_expires_in_hours is null then null else now() + make_interval(hours => p_expires_in_hours) end,
    p_max_uses
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.revoke_space_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'You need to be signed in.' using errcode = '28000';
  end if;

  update public.space_invites
  set revoked_at = now()
  where id = p_invite_id
    and revoked_at is null
    and (
      private.is_space_manager(space_id)
      or (created_by = auth.uid() and private.is_space_member(space_id))
    );

  if not found then
    raise exception 'That link is already off, or it is not yours to turn off.' using errcode = '42501';
  end if;
end;
$$;

-- What a link leads to, before joining. Only a live link (or one the caller
-- already used) names the space, so a revoked or expired link stops
-- advertising the group the moment it is turned off.
create or replace function public.preview_space_invite(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_invite public.space_invites;
  v_space public.spaces;
  v_count integer;
  v_status text;
begin
  if auth.uid() is null then
    raise exception 'You need to be signed in.' using errcode = '28000';
  end if;

  select * into v_invite from public.space_invites where code = p_code;
  if not found then
    return jsonb_build_object('status', 'invalid');
  end if;

  select * into v_space from public.spaces where id = v_invite.space_id;
  select count(*) into v_count from public.space_members where space_id = v_space.id;

  v_status := case
    when exists (
      select 1 from public.space_members where space_id = v_space.id and user_id = auth.uid()
    ) then 'member'
    when v_invite.revoked_at is not null then 'revoked'
    when v_invite.expires_at is not null and v_invite.expires_at <= now() then 'expired'
    when v_invite.max_uses is not null and v_invite.use_count >= v_invite.max_uses then 'used_up'
    when v_count >= 50 then 'full'
    else 'valid'
  end;

  if v_status in ('valid', 'member') then
    return jsonb_build_object(
      'status', v_status,
      'space_id', v_space.id,
      'name', v_space.name,
      'kind', v_space.kind,
      'description', v_space.description,
      'member_count', v_count
    );
  end if;

  return jsonb_build_object('status', v_status);
end;
$$;

create or replace function public.join_space_with_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_invite public.space_invites;
begin
  if v_uid is null then
    raise exception 'You need to be signed in.' using errcode = '28000';
  end if;
  if not exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'Finish setting up your profile first.' using errcode = '42501';
  end if;

  -- Row lock: two students taking the last use of a link at the same moment
  -- are serialised here, so max_uses is a real ceiling.
  select * into v_invite from public.space_invites where code = p_code for update;
  if not found then
    raise exception 'That invite link is not valid.';
  end if;

  -- Already in: succeed without spending a use.
  if exists (select 1 from public.space_members where space_id = v_invite.space_id and user_id = v_uid) then
    return v_invite.space_id;
  end if;

  if v_invite.revoked_at is not null then
    raise exception 'That invite link was turned off.';
  end if;
  if v_invite.expires_at is not null and v_invite.expires_at <= now() then
    raise exception 'That invite link has expired.';
  end if;
  if v_invite.max_uses is not null and v_invite.use_count >= v_invite.max_uses then
    raise exception 'That invite link has been used up.';
  end if;

  perform private.add_space_member(v_invite.space_id, v_uid, 'joined with an invite link');
  update public.space_invites set use_count = use_count + 1 where id = v_invite.id;
  -- A pending direct invitation to the same space is moot now.
  delete from public.space_invitations where space_id = v_invite.space_id and invitee_id = v_uid;

  return v_invite.space_id;
end;
$$;

create or replace function public.invite_to_space(p_space_id uuid, p_username text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role text := private.require_space_role(p_space_id, 'member');
  v_target uuid;
  v_target_name text := lower(btrim(coalesce(p_username, '')));
  v_space_name text;
  v_inviter text;
  v_id uuid;
begin
  if v_role = 'member'
     and not (select members_can_invite from public.spaces where id = p_space_id) then
    raise exception 'Only the owner and admins can invite people to this space.' using errcode = '42501';
  end if;

  v_target_name := ltrim(v_target_name, '@');
  select id into v_target from public.profiles where username = v_target_name;
  if v_target is null then
    raise exception 'No student with the username @%.', v_target_name;
  end if;
  if exists (select 1 from public.space_members where space_id = p_space_id and user_id = v_target) then
    raise exception '@% is already a member.', v_target_name;
  end if;
  if (select count(*) from public.space_invitations where space_id = p_space_id) >= 50 then
    raise exception 'This space has 50 pending invitations. Wait for some answers first.';
  end if;

  insert into public.space_invitations (space_id, invitee_id, invited_by)
  values (p_space_id, v_target, v_uid)
  on conflict (space_id, invitee_id) do update set invited_by = excluded.invited_by
  returning id into v_id;

  select name into v_space_name from public.spaces where id = p_space_id;
  select username into v_inviter from public.profiles where id = v_uid;

  perform private.notify(v_target, v_uid, p_space_id, 'space_invite',
    'Invitation to "' || v_space_name || '"',
    '@' || coalesce(v_inviter, 'someone') || ' invited you to join.',
    '/spaces', p_space_id, 'space_invite:' || p_space_id, true);
  perform private.log_activity(p_space_id, v_uid, 'member.invited', 'profile', v_target,
    'invited @' || v_target_name);

  return v_id;
end;
$$;

create or replace function public.accept_space_invitation(p_invitation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_invitation public.space_invitations;
begin
  if v_uid is null then
    raise exception 'You need to be signed in.' using errcode = '28000';
  end if;

  select * into v_invitation from public.space_invitations
  where id = p_invitation_id and invitee_id = v_uid
  for update;

  if not found then
    raise exception 'That invitation is no longer open.';
  end if;

  perform private.add_space_member(v_invitation.space_id, v_uid, 'accepted an invitation');
  delete from public.space_invitations where id = p_invitation_id;
  update public.notifications set read_at = coalesce(read_at, now())
  where user_id = v_uid and dedupe_key = 'space_invite:' || v_invitation.space_id;

  return v_invitation.space_id;
end;
$$;

create or replace function public.remove_space_member(p_space_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role text := private.require_space_role(p_space_id, 'admin');
  v_target_role text;
  v_target_name text;
  v_space_name text;
begin
  if p_user_id = v_uid then
    raise exception 'Use "Leave space" to remove yourself.';
  end if;

  select role into v_target_role from public.space_members
  where space_id = p_space_id and user_id = p_user_id;

  if v_target_role is null then
    raise exception 'That student is not a member of this space.';
  end if;
  -- An admin may remove plain members only; the owner may remove anyone else.
  if v_role = 'admin' and v_target_role <> 'member' then
    raise exception 'Only the owner can remove an admin.' using errcode = '42501';
  end if;

  delete from public.space_members where space_id = p_space_id and user_id = p_user_id;

  select username into v_target_name from public.profiles where id = p_user_id;
  select name into v_space_name from public.spaces where id = p_space_id;

  perform private.log_activity(p_space_id, v_uid, 'member.removed', 'profile', p_user_id,
    'removed @' || coalesce(v_target_name, 'a member'));
  perform private.notify(p_user_id, v_uid, null, 'space_update',
    'Removed from "' || v_space_name || '"',
    'You no longer have access to this space.',
    '/spaces', null, null);
end;
$$;

create or replace function public.set_member_role(p_space_id uuid, p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_old text;
  v_space_name text;
  v_target_name text;
begin
  perform private.require_space_role(p_space_id, 'owner');

  if p_role not in ('admin', 'member') then
    raise exception 'Use "Transfer ownership" to make someone the owner.';
  end if;
  if p_user_id = v_uid then
    raise exception 'You cannot change your own role.';
  end if;

  select role into v_old from public.space_members
  where space_id = p_space_id and user_id = p_user_id
  for update;

  if v_old is null then
    raise exception 'That student is not a member of this space.';
  end if;
  if v_old = p_role then
    return;
  end if;

  update public.space_members set role = p_role
  where space_id = p_space_id and user_id = p_user_id;

  select name into v_space_name from public.spaces where id = p_space_id;
  select username into v_target_name from public.profiles where id = p_user_id;

  perform private.log_activity(p_space_id, v_uid, 'member.role_changed', 'profile', p_user_id,
    case when p_role = 'admin'
      then 'made @' || coalesce(v_target_name, 'a member') || ' an admin'
      else 'made @' || coalesce(v_target_name, 'a member') || ' a member' end);
  perform private.notify(p_user_id, v_uid, p_space_id, 'space_update',
    case when p_role = 'admin'
      then 'You are now an admin of "' || v_space_name || '"'
      else 'You are no longer an admin of "' || v_space_name || '"' end,
    null, '/spaces/' || p_space_id || '/members', p_space_id, null);
end;
$$;

create or replace function public.transfer_space_ownership(p_space_id uuid, p_new_owner uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_space_name text;
  v_target_name text;
begin
  perform private.require_space_role(p_space_id, 'owner');

  if p_new_owner = v_uid then
    raise exception 'You already own this space.';
  end if;
  if not exists (select 1 from public.space_members where space_id = p_space_id and user_id = p_new_owner) then
    raise exception 'Ownership can only go to a member of this space.';
  end if;

  -- Demote first: the partial unique index allows one owner at a time.
  update public.space_members set role = 'admin' where space_id = p_space_id and user_id = v_uid;
  update public.space_members set role = 'owner' where space_id = p_space_id and user_id = p_new_owner;

  select name into v_space_name from public.spaces where id = p_space_id;
  select username into v_target_name from public.profiles where id = p_new_owner;

  perform private.log_activity(p_space_id, v_uid, 'member.ownership_transferred', 'profile', p_new_owner,
    'handed ownership to @' || coalesce(v_target_name, 'a member'));
  perform private.notify(p_new_owner, v_uid, p_space_id, 'space_update',
    'You now own "' || v_space_name || '"', null,
    '/spaces/' || p_space_id || '/settings', p_space_id, null);
end;
$$;

create or replace function public.leave_space(p_space_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role text := private.require_space_role(p_space_id, 'member');
begin
  if v_role = 'owner' then
    if exists (select 1 from public.space_members where space_id = p_space_id and user_id <> v_uid) then
      raise exception 'Hand ownership to someone else before you leave, or delete the space.';
    end if;
    -- The last member out takes the space with them.
    delete from public.spaces where id = p_space_id;
    return;
  end if;

  delete from public.space_members where space_id = p_space_id and user_id = v_uid;
  perform private.log_activity(p_space_id, v_uid, 'member.left', 'profile', v_uid, 'left the space');
end;
$$;

-- Callable by signed-in students only. Each function above re-checks the
-- caller itself; the grants just keep anon off the surface entirely.
revoke execute on function public.create_space(text, text, text, text) from public, anon;
revoke execute on function public.my_spaces() from public, anon;
revoke execute on function public.my_space_invitations() from public, anon;
revoke execute on function public.create_space_invite(uuid, integer, integer) from public, anon;
revoke execute on function public.revoke_space_invite(uuid) from public, anon;
revoke execute on function public.preview_space_invite(text) from public, anon;
revoke execute on function public.join_space_with_code(text) from public, anon;
revoke execute on function public.invite_to_space(uuid, text) from public, anon;
revoke execute on function public.accept_space_invitation(uuid) from public, anon;
revoke execute on function public.remove_space_member(uuid, uuid) from public, anon;
revoke execute on function public.set_member_role(uuid, uuid, text) from public, anon;
revoke execute on function public.transfer_space_ownership(uuid, uuid) from public, anon;
revoke execute on function public.leave_space(uuid) from public, anon;

grant execute on function public.create_space(text, text, text, text) to authenticated;
grant execute on function public.my_spaces() to authenticated;
grant execute on function public.my_space_invitations() to authenticated;
grant execute on function public.create_space_invite(uuid, integer, integer) to authenticated;
grant execute on function public.revoke_space_invite(uuid) to authenticated;
grant execute on function public.preview_space_invite(text) to authenticated;
grant execute on function public.join_space_with_code(text) to authenticated;
grant execute on function public.invite_to_space(uuid, text) to authenticated;
grant execute on function public.accept_space_invitation(uuid) to authenticated;
grant execute on function public.remove_space_member(uuid, uuid) to authenticated;
grant execute on function public.set_member_role(uuid, uuid, text) to authenticated;
grant execute on function public.transfer_space_ownership(uuid, uuid) to authenticated;
grant execute on function public.leave_space(uuid) to authenticated;
