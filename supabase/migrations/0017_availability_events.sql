-- supabase/migrations/0017_availability_events.sql
--
-- Availability matching over real dates, and the shared calendar it feeds.
-- Design: docs/superpowers/specs/2026-10-17-spaces-platform-design.md §3–5.
--
--   profiles.timezone          the zone a student's weekly classes are in
--   availability_preferences   earliest / latest times and weekends, soft
--   availability_blocks        one-off busy time, or one-off FREE time that
--                              cancels a class (a holiday, a cancelled lab)
--   space_events               a space's calendar
--   event_attendees            who is invited, and their answer
--   space_availability()       the only way to read another member's busy
--                              time, gated by membership and share level
--
-- PRIVACY, which is the point of most of this file
--
--   * classes keeps its original friends-only policy. Space members read
--     availability through space_availability(), never through classes.
--   * Each member's share level in THIS space (0016) decides what the
--     function returns: nothing (hidden), busy times only (busy, the
--     default), or busy times plus class names and block labels (details).
--   * Events from OTHER spaces come back as anonymous busy time: no title,
--     no id, no space. A member of two groups never leaks one group's plans
--     into the other.
--   * Block labels and preferences are readable by their owner only.
--
-- Nothing here relies on the session time zone. Supabase sessions are UTC,
-- but every conversion below names its zone explicitly anyway.

-- ---------------------------------------------------------------------------
-- Time zones
-- ---------------------------------------------------------------------------

alter table public.profiles add column if not exists timezone text;

alter table public.profiles add constraint profiles_timezone_format
  check (timezone is null or timezone ~ '^[A-Za-z][A-Za-z0-9_+/-]{0,63}$');

-- The format checks only reject garbage. This rejects a well-formed name the
-- server's zone database does not know, which would otherwise surface later
-- as an error inside some unrelated query.
create or replace function private.assert_time_zone(p_zone text)
returns void
language plpgsql
stable
set search_path = public
as $$
begin
  if p_zone is null then
    return;
  end if;
  perform now() at time zone p_zone;
exception
  when invalid_parameter_value then
    raise exception 'Unknown time zone "%".', p_zone;
end;
$$;

create or replace function private.check_row_time_zone()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform private.assert_time_zone(new.timezone);
  return new;
end;
$$;

create trigger profiles_check_time_zone before insert or update of timezone on public.profiles
  for each row execute function private.check_row_time_zone();
create trigger spaces_check_time_zone before insert or update of timezone on public.spaces
  for each row execute function private.check_row_time_zone();

-- "Fri Oct 23, 3:00 PM" on the wall clock of `p_zone`, for notification text.
create or replace function private.format_event_time(p_at timestamptz, p_zone text)
returns text
language sql
stable
set search_path = public
as $$
  select to_char(p_at at time zone p_zone, 'Dy Mon FMDD, FMHH12:MI AM');
$$;

-- ---------------------------------------------------------------------------
-- Personal availability
-- ---------------------------------------------------------------------------

-- Soft preferences: matching ranks slots outside them lower, it never hides
-- them. Saving a row also marks a student with no classes as "counted" — a
-- club member with no timetable is free outside their busy blocks, which is
-- different from a student who simply never uploaded one.
create table public.availability_preferences (
  user_id          uuid primary key references public.profiles(id) on delete cascade,
  earliest_minute  smallint not null default 540,
  latest_minute    smallint not null default 1260,
  avoid_weekends   boolean not null default false,
  updated_at       timestamptz not null default now(),
  constraint availability_preferences_earliest check (earliest_minute between 0 and 1439),
  constraint availability_preferences_latest check (latest_minute between 1 and 1440),
  constraint availability_preferences_order check (latest_minute > earliest_minute)
);

create table public.availability_blocks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  kind        text not null,
  label       text,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  created_at  timestamptz not null default now(),
  constraint availability_blocks_kind check (kind in ('busy', 'free')),
  constraint availability_blocks_label_length check (label is null or char_length(label) <= 80),
  constraint availability_blocks_order check (ends_at > starts_at),
  constraint availability_blocks_length check (ends_at - starts_at <= interval '31 days')
);

create index availability_blocks_user_time_idx on public.availability_blocks (user_id, starts_at);

create trigger availability_preferences_touch_updated_at before update on public.availability_preferences
  for each row execute function private.touch_updated_at();

alter table public.availability_preferences enable row level security;
alter table public.availability_blocks enable row level security;

create policy availability_preferences_own on public.availability_preferences
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy availability_blocks_own on public.availability_blocks
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------

create table public.space_events (
  id                   uuid primary key default gen_random_uuid(),
  space_id             uuid not null references public.spaces(id) on delete cascade,
  title                text not null,
  description          text,
  location             text,
  meeting_url          text,
  starts_at            timestamptz not null,
  ends_at              timestamptz not null,
  -- Wall-clock zone for display and for repeating: a weekly 15:00 meeting
  -- stays at 15:00 local across a DST change, so its UTC time moves.
  timezone             text not null,
  -- Null for a one-off. Otherwise the event repeats every 7 days through this
  -- date, inclusive, in `timezone`. The series is edited as a whole.
  repeat_weekly_until  date,
  status               text not null default 'confirmed',
  organizer_id         uuid references public.profiles(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint space_events_title_length check (char_length(btrim(title)) between 1 and 120),
  constraint space_events_description_length check (description is null or char_length(description) <= 2000),
  constraint space_events_location_length check (location is null or char_length(location) <= 200),
  constraint space_events_meeting_url check (
    meeting_url is null
    or (meeting_url ~* '^https?://[^[:space:]/?#]+[^[:space:]]*$' and char_length(meeting_url) <= 500)
  ),
  constraint space_events_order check (ends_at > starts_at),
  constraint space_events_length check (ends_at - starts_at <= interval '14 days'),
  constraint space_events_status check (status in ('confirmed', 'cancelled')),
  constraint space_events_timezone_format check (timezone ~ '^[A-Za-z][A-Za-z0-9_+/-]{0,63}$')
);

create index space_events_space_time_idx on public.space_events (space_id, starts_at);

create table public.event_attendees (
  event_id      uuid not null references public.space_events(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  response      text not null default 'pending',
  responded_at  timestamptz,
  primary key (event_id, user_id),
  constraint event_attendees_response check (response in ('pending', 'going', 'maybe', 'declined'))
);

create index event_attendees_user_idx on public.event_attendees (user_id);

create or replace function private.validate_space_event()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_first_day date;
begin
  perform private.assert_time_zone(new.timezone);

  if new.repeat_weekly_until is not null then
    v_first_day := (new.starts_at at time zone new.timezone)::date;
    if new.repeat_weekly_until < v_first_day then
      raise exception 'A repeating event has to repeat until its first day or later.';
    end if;
    if new.repeat_weekly_until > v_first_day + 366 then
      raise exception 'A weekly event can repeat for a year at most.';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create trigger space_events_validate before insert or update on public.space_events
  for each row execute function private.validate_space_event();

create or replace function private.event_space_id(p_event_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select space_id from public.space_events where id = p_event_id;
$$;

create or replace function private.can_see_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select private.is_space_member(private.event_space_id(p_event_id));
$$;

create or replace function private.can_manage_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.space_events e
    where e.id = p_event_id
      and (e.organizer_id = auth.uid() or private.is_space_manager(e.space_id))
  );
$$;

revoke execute on function private.event_space_id(uuid) from public, anon;
revoke execute on function private.can_see_event(uuid) from public, anon;
revoke execute on function private.can_manage_event(uuid) from public, anon;
grant execute on function private.event_space_id(uuid) to authenticated, service_role;
grant execute on function private.can_see_event(uuid) to authenticated, service_role;
grant execute on function private.can_manage_event(uuid) to authenticated, service_role;

alter table public.space_events enable row level security;
alter table public.event_attendees enable row level security;

-- Members read the calendar. Creating goes through create_space_event(), which
-- adds attendees and notifies them in one transaction; editing and deleting
-- are the organizer's, or a manager's.
create policy space_events_select on public.space_events
  for select to authenticated
  using (private.is_space_member(space_id));

create policy space_events_update on public.space_events
  for update to authenticated
  using (organizer_id = auth.uid() or private.is_space_manager(space_id))
  with check (organizer_id = auth.uid() or private.is_space_manager(space_id));

create policy space_events_delete on public.space_events
  for delete to authenticated
  using (organizer_id = auth.uid() or private.is_space_manager(space_id));

revoke insert, update on public.space_events from anon, authenticated;
grant update (title, description, location, meeting_url, starts_at, ends_at, timezone, repeat_weekly_until, status)
  on public.space_events to authenticated;

-- Members see who is invited. A member may add themselves to an event in
-- their space, answer for themselves, and leave; the organizer or a manager
-- may take someone off the list.
create policy event_attendees_select on public.event_attendees
  for select to authenticated
  using (private.can_see_event(event_id));

create policy event_attendees_insert_self on public.event_attendees
  for insert to authenticated
  with check (user_id = auth.uid() and private.can_see_event(event_id));

create policy event_attendees_update_self on public.event_attendees
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy event_attendees_delete on public.event_attendees
  for delete to authenticated
  using (user_id = auth.uid() or private.can_manage_event(event_id));

revoke update on public.event_attendees from anon, authenticated;
grant update (response, responded_at) on public.event_attendees to authenticated;

-- ---------------------------------------------------------------------------
-- Conflicts
-- ---------------------------------------------------------------------------

-- The first thing already on p_user's plate between p_starts and p_ends, by
-- name — read by the invitee only, inside their own notification. Order of
-- checks: a weekly class (unless a one-off free block covers the whole event,
-- i.e. the class is off that day), a one-off busy block, another event they
-- are going to. Repeating events are left out of the last check: the full
-- expansion lives in the client (src/domain/availability.ts), and a missed
-- heads-up costs less than a wrong one.
create or replace function private.first_conflict(
  p_user uuid,
  p_starts timestamptz,
  p_ends timestamptz,
  p_ignore_event uuid default null
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_zone text;
  v_local_start timestamp;
  v_local_end timestamp;
  v_start_minute integer;
  v_end_minute integer;
  v_hit text;
begin
  select coalesce(timezone, 'America/Toronto') into v_zone from public.profiles where id = p_user;
  v_zone := coalesce(v_zone, 'America/Toronto');
  v_local_start := p_starts at time zone v_zone;
  v_local_end := p_ends at time zone v_zone;

  if not exists (
    select 1 from public.availability_blocks
    where user_id = p_user and kind = 'free' and starts_at <= p_starts and ends_at >= p_ends
  ) and (
    v_local_end::date = v_local_start::date
    or (v_local_end::date = v_local_start::date + 1 and v_local_end::time = time '00:00')
  ) then
    v_start_minute := extract(hour from v_local_start)::integer * 60 + extract(minute from v_local_start)::integer;
    v_end_minute := case
      when v_local_end::date > v_local_start::date then 1440
      else extract(hour from v_local_end)::integer * 60 + extract(minute from v_local_end)::integer
    end;

    select name into v_hit from public.classes
    where user_id = p_user
      and extract(isodow from v_local_start)::smallint = any(days)
      and start_minute < v_end_minute
      and end_minute > v_start_minute
    order by start_minute
    limit 1;

    if v_hit is not null then
      return v_hit;
    end if;
  end if;

  select coalesce(label, 'busy time') into v_hit from public.availability_blocks
  where user_id = p_user and kind = 'busy' and starts_at < p_ends and ends_at > p_starts
  order by starts_at
  limit 1;

  if v_hit is not null then
    return v_hit;
  end if;

  select e.title into v_hit
  from public.space_events e
  join public.event_attendees a on a.event_id = e.id
  where a.user_id = p_user
    and a.response in ('going', 'maybe')
    and e.status = 'confirmed'
    and e.repeat_weekly_until is null
    and e.id is distinct from p_ignore_event
    and e.starts_at < p_ends
    and e.ends_at > p_starts
  order by e.starts_at
  limit 1;

  return v_hit;
end;
$$;

revoke execute on function private.first_conflict(uuid, timestamptz, timestamptz, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Creating events
-- ---------------------------------------------------------------------------

-- No permission checks: callers (create_space_event, and the poll scheduler in
-- 0018) check first. Attendees are every member, or the chosen ones; the
-- organizer is always on the list and always "going".
create or replace function private.insert_space_event(
  p_space_id uuid,
  p_organizer uuid,
  p_title text,
  p_description text,
  p_location text,
  p_meeting_url text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_timezone text,
  p_repeat_weekly_until date,
  p_attendee_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event uuid;
  v_attendee uuid;
  v_title text := btrim(p_title);
  v_when text;
  v_conflict text;
begin
  insert into public.space_events (
    space_id, title, description, location, meeting_url,
    starts_at, ends_at, timezone, repeat_weekly_until, organizer_id
  )
  values (
    p_space_id, v_title, nullif(btrim(p_description), ''), nullif(btrim(p_location), ''),
    nullif(btrim(p_meeting_url), ''), p_starts_at, p_ends_at, p_timezone, p_repeat_weekly_until, p_organizer
  )
  returning id into v_event;

  insert into public.event_attendees (event_id, user_id, response, responded_at)
  select v_event, m.user_id,
         case when m.user_id = p_organizer then 'going' else 'pending' end,
         case when m.user_id = p_organizer then now() end
  from public.space_members m
  where m.space_id = p_space_id
    and (p_attendee_ids is null or m.user_id = any(p_attendee_ids) or m.user_id = p_organizer);

  v_when := private.format_event_time(p_starts_at, p_timezone)
    || case when p_repeat_weekly_until is not null then ', weekly' else '' end;

  for v_attendee in
    select user_id from public.event_attendees where event_id = v_event and user_id <> p_organizer
  loop
    v_conflict := private.first_conflict(v_attendee, p_starts_at, p_ends_at, v_event);
    perform private.notify(
      v_attendee, p_organizer, p_space_id, 'event_invite',
      'New event: ' || v_title,
      v_when || case when v_conflict is not null then ' · Heads up: overlaps your ' || v_conflict else '' end,
      '/spaces/' || p_space_id || '/events/' || v_event,
      v_event, 'event_invite:' || v_event, true
    );
  end loop;

  perform private.log_activity(p_space_id, p_organizer, 'event.created', 'event', v_event,
    'scheduled "' || v_title || '"');

  return v_event;
end;
$$;

revoke execute on function private.insert_space_event(uuid, uuid, text, text, text, text, timestamptz, timestamptz, text, date, uuid[])
  from public, anon, authenticated;

create or replace function public.create_space_event(
  p_space_id uuid,
  p_title text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_timezone text,
  p_description text default null,
  p_location text default null,
  p_meeting_url text default null,
  p_repeat_weekly_until date default null,
  p_attendee_ids uuid[] default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  perform private.require_space_role(p_space_id, 'member');

  if p_attendee_ids is not null and exists (
    select 1 from unnest(p_attendee_ids) as a(id)
    where not exists (select 1 from public.space_members m where m.space_id = p_space_id and m.user_id = a.id)
  ) then
    raise exception 'Everyone invited has to be a member of this space.';
  end if;

  return private.insert_space_event(
    p_space_id, auth.uid(), p_title, p_description, p_location, p_meeting_url,
    p_starts_at, p_ends_at, coalesce(nullif(btrim(p_timezone), ''), 'America/Toronto'),
    p_repeat_weekly_until, p_attendee_ids
  );
end;
$$;

revoke execute on function public.create_space_event(uuid, text, timestamptz, timestamptz, text, text, text, text, date, uuid[])
  from public, anon;
grant execute on function public.create_space_event(uuid, text, timestamptz, timestamptz, text, text, text, text, date, uuid[])
  to authenticated;

-- ---------------------------------------------------------------------------
-- Change notices
-- ---------------------------------------------------------------------------

-- Only changes that affect whether someone can come notify anyone: time,
-- place, link, title, repetition, cancellation. A reworded description does
-- not. Five quick edits leave one "Updated" notice, refreshed, not five.
create or replace function private.after_space_event_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_attendee uuid;
  v_title text;
  v_body text;
begin
  if (new.title, new.starts_at, new.ends_at, new.timezone, new.location, new.meeting_url, new.status, new.repeat_weekly_until)
     is not distinct from
     (old.title, old.starts_at, old.ends_at, old.timezone, old.location, old.meeting_url, old.status, old.repeat_weekly_until) then
    return null;
  end if;

  if new.status = 'cancelled' and old.status <> 'cancelled' then
    v_title := 'Cancelled: ' || new.title;
    v_body := private.format_event_time(new.starts_at, new.timezone) || ' is off.';
    perform private.log_activity(new.space_id, v_actor, 'event.cancelled', 'event', new.id,
      'cancelled "' || new.title || '"');
  else
    v_title := 'Updated: ' || new.title;
    v_body := private.format_event_time(new.starts_at, new.timezone)
      || case when new.location is not null then ' · ' || new.location else '' end;
    perform private.log_activity(new.space_id, v_actor, 'event.updated', 'event', new.id,
      'changed "' || new.title || '"');
  end if;

  for v_attendee in
    select user_id from public.event_attendees where event_id = new.id and response <> 'declined'
  loop
    perform private.notify(v_attendee, v_actor, new.space_id, 'event_changed', v_title, v_body,
      '/spaces/' || new.space_id || '/events/' || new.id, new.id, 'event_changed:' || new.id, true);
  end loop;

  return null;
end;
$$;

create trigger space_events_after_update after update on public.space_events
  for each row execute function private.after_space_event_updated();

create or replace function private.before_space_event_deleted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_attendee uuid;
begin
  -- The whole space is going: its own deletion notice covers this.
  if not exists (select 1 from public.spaces where id = old.space_id) then
    return old;
  end if;

  if old.status = 'confirmed' and old.ends_at > now() then
    for v_attendee in
      select user_id from public.event_attendees where event_id = old.id and response <> 'declined'
    loop
      perform private.notify(v_attendee, v_actor, old.space_id, 'event_changed',
        'Cancelled: ' || old.title,
        private.format_event_time(old.starts_at, old.timezone) || ' was removed from the calendar.',
        '/spaces/' || old.space_id || '/calendar', old.id, 'event_changed:' || old.id, true);
    end loop;
  end if;

  perform private.log_activity(old.space_id, v_actor, 'event.deleted', 'event', old.id,
    'deleted "' || old.title || '"');
  return old;
end;
$$;

create trigger space_events_before_delete before delete on public.space_events
  for each row execute function private.before_space_event_deleted();

-- Leaving a space takes you off its events, so nobody is listed as attending
-- something they can no longer see.
create or replace function private.after_member_removed_from_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.event_attendees a
  using public.space_events e
  where a.event_id = e.id and e.space_id = old.space_id and a.user_id = old.user_id;
  return null;
end;
$$;

create trigger space_members_after_delete_events after delete on public.space_members
  for each row execute function private.after_member_removed_from_events();

-- ---------------------------------------------------------------------------
-- Reading availability
-- ---------------------------------------------------------------------------

-- Everything the matching engine needs about every member of one space,
-- filtered by each member's share level. The caller must be a member; the
-- window is capped at 62 days and kept near today, so this is a planning
-- tool and not a way to page through someone's history.
create or replace function public.space_availability(p_space_id uuid, p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
begin
  perform private.require_space_role(p_space_id, 'member');

  if p_to <= p_from then
    raise exception 'The end of the range has to be after its start.';
  end if;
  if p_to - p_from > interval '63 days' then
    raise exception 'Search at most 62 days at a time.';
  end if;
  if p_from < now() - interval '8 days' or p_to > now() + interval '400 days' then
    raise exception 'Search within a year from today.';
  end if;

  select coalesce(jsonb_agg(member_json order by joined_at), '[]'::jsonb)
  into v_result
  from (
    select
      m.joined_at,
      case
        when m.share_level = 'hidden' and m.user_id <> v_uid then
          jsonb_build_object('user_id', m.user_id, 'share_level', 'hidden')
        else jsonb_build_object(
          'user_id', m.user_id,
          'share_level', m.share_level,
          'timezone', coalesce(p.timezone, 'America/Toronto'),
          'has_schedule',
            exists (select 1 from public.classes c where c.user_id = m.user_id)
            or exists (select 1 from public.availability_preferences ap where ap.user_id = m.user_id),
          'preferences', (
            select jsonb_build_object(
              'earliest_minute', ap.earliest_minute,
              'latest_minute', ap.latest_minute,
              'avoid_weekends', ap.avoid_weekends
            )
            from public.availability_preferences ap where ap.user_id = m.user_id
          ),
          'classes', coalesce((
            select jsonb_agg(jsonb_build_object(
              'days', c.days,
              'start_minute', c.start_minute,
              'end_minute', c.end_minute,
              'name', case when m.share_level = 'details' or m.user_id = v_uid then c.name end,
              'course_code', case when m.share_level = 'details' or m.user_id = v_uid then c.course_code end,
              'section', case when m.share_level = 'details' or m.user_id = v_uid then c.section end
            ))
            from public.classes c where c.user_id = m.user_id
          ), '[]'::jsonb),
          'blocks', coalesce((
            select jsonb_agg(jsonb_build_object(
              'kind', b.kind,
              'starts_at', b.starts_at,
              'ends_at', b.ends_at,
              'label', case when m.share_level = 'details' or m.user_id = v_uid then b.label end
            ))
            from public.availability_blocks b
            where b.user_id = m.user_id
              and b.ends_at > p_from - interval '1 day'
              and b.starts_at < p_to + interval '1 day'
          ), '[]'::jsonb),
          'events', coalesce((
            select jsonb_agg(jsonb_build_object(
              'starts_at', e.starts_at,
              'ends_at', e.ends_at,
              'timezone', e.timezone,
              'repeat_weekly_until', e.repeat_weekly_until,
              -- Only this space's events are identified; the rest are just busy.
              'event_id', case when e.space_id = p_space_id then e.id end,
              'title', case when e.space_id = p_space_id then e.title end
            ))
            from public.space_events e
            join public.event_attendees a on a.event_id = e.id
            where a.user_id = m.user_id
              and a.response in ('going', 'maybe')
              and e.status = 'confirmed'
              and e.starts_at < p_to + interval '1 day'
              and (
                (e.repeat_weekly_until is null and e.ends_at > p_from - interval '1 day')
                or e.repeat_weekly_until >= (p_from at time zone 'UTC')::date - 1
              )
          ), '[]'::jsonb)
        )
      end as member_json
    from public.space_members m
    join public.profiles p on p.id = m.user_id
    where m.space_id = p_space_id
  ) members;

  return jsonb_build_object('members', v_result);
end;
$$;

revoke execute on function public.space_availability(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.space_availability(uuid, timestamptz, timestamptz) to authenticated;
