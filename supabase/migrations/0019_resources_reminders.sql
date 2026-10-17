-- supabase/migrations/0019_resources_reminders.sql
--
-- Shared links per space, and reminders. Design doc §6–7.
--
-- RESOURCES are links only — course pages, shared docs, study guides. There
-- is no file upload: this project deliberately has no Storage bucket (see
-- the original design, §6.1), and a link to a Drive or OneDrive file covers
-- the need without taking custody of students' files.
--
-- REMINDERS have no background job. sync_my_reminders() looks at the CALLER's
-- own tasks, events and polls and writes whatever notices are due, and the
-- client calls it when the app opens and every few minutes while it is
-- visible. So a reminder reaches a student the next time they open the app;
-- nothing is emailed or pushed. Dedupe keys make repeated calls harmless.
-- A scheduled job (pg_cron) could call the same logic for everyone later.

create table public.space_resources (
  id           uuid primary key default gen_random_uuid(),
  space_id     uuid not null references public.spaces(id) on delete cascade,
  title        text not null,
  description  text,
  url          text not null,
  category     text not null default 'link',
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint space_resources_title_length check (char_length(btrim(title)) between 1 and 120),
  constraint space_resources_description_length check (description is null or char_length(description) <= 500),
  constraint space_resources_url check (
    url ~* '^https?://[^[:space:]/?#]+[^[:space:]]*$' and char_length(url) <= 1000
  ),
  constraint space_resources_category check (
    category in ('link', 'document', 'course', 'study', 'project', 'reference')
  )
);

create index space_resources_space_idx on public.space_resources (space_id, created_at desc);

create trigger space_resources_touch_updated_at before update on public.space_resources
  for each row execute function private.touch_updated_at();

create or replace function private.before_resource_inserted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.space_resources where space_id = new.space_id) >= 500 then
    raise exception 'This space has 500 saved links, the most allowed. Remove some first.';
  end if;
  return new;
end;
$$;

create trigger space_resources_before_insert before insert on public.space_resources
  for each row execute function private.before_resource_inserted();

create or replace function private.after_resource_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform private.log_activity(new.space_id, new.created_by, 'resource.added', 'resource', new.id,
      'shared "' || new.title || '"');
  elsif exists (select 1 from public.spaces where id = old.space_id) then
    perform private.log_activity(old.space_id, auth.uid(), 'resource.removed', 'resource', old.id,
      'removed "' || old.title || '"');
  end if;
  return null;
end;
$$;

create trigger space_resources_after_change after insert or delete on public.space_resources
  for each row execute function private.after_resource_changed();

alter table public.space_resources enable row level security;

create policy space_resources_select on public.space_resources
  for select to authenticated
  using (private.is_space_member(space_id));

create policy space_resources_insert on public.space_resources
  for insert to authenticated
  with check (created_by = auth.uid() and private.is_space_member(space_id));

create policy space_resources_update on public.space_resources
  for update to authenticated
  using (
    private.is_space_member(space_id)
    and (created_by = auth.uid() or private.is_space_manager(space_id))
  )
  with check (private.is_space_member(space_id));

create policy space_resources_delete on public.space_resources
  for delete to authenticated
  using (
    private.is_space_member(space_id)
    and (created_by = auth.uid() or private.is_space_manager(space_id))
  );

revoke update on public.space_resources from anon, authenticated;
grant update (title, description, url, category) on public.space_resources to authenticated;

-- ---------------------------------------------------------------------------
-- Reminders
-- ---------------------------------------------------------------------------

create or replace function public.sync_my_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  r record;
begin
  if v_uid is null then
    raise exception 'You need to be signed in.' using errcode = '28000';
  end if;

  -- Tasks assigned to me, not done, due within a day. Once per due date: if
  -- the deadline moves, the new one earns its own reminder.
  for r in
    select t.id, t.title, t.due_at, t.space_id, s.timezone
    from public.space_tasks t
    join public.task_assignees a on a.task_id = t.id and a.user_id = v_uid
    join public.spaces s on s.id = t.space_id
    where t.status <> 'done'
      and t.due_at > now()
      and t.due_at <= now() + interval '24 hours'
  loop
    perform private.notify(v_uid, null, r.space_id, 'task_due',
      'Due soon: ' || r.title,
      'Due ' || private.format_event_time(r.due_at, r.timezone),
      '/spaces/' || r.space_id || '/tasks?task=' || r.id, r.id,
      'task_due:' || r.id || ':' || extract(epoch from r.due_at)::bigint, false);
  end loop;

  -- Events I have not declined with an occurrence starting within a day.
  -- Weekly events are stepped on their own wall clock, so the reminder is for
  -- the real 15:00, not 15:00 shifted by a DST change.
  for r in
    select e.id, e.title, e.location, e.timezone, e.space_id, occurrence.starts_at
    from public.space_events e
    join public.event_attendees a on a.event_id = e.id and a.user_id = v_uid and a.response <> 'declined'
    cross join lateral (
      select
        ((e.starts_at at time zone e.timezone) + make_interval(weeks => n)) at time zone e.timezone as starts_at,
        ((e.starts_at at time zone e.timezone) + make_interval(weeks => n))::date as local_day
      from generate_series(0, case when e.repeat_weekly_until is null then 0 else 53 end) as n
    ) occurrence
    where e.status = 'confirmed'
      and e.starts_at <= now() + interval '24 hours'
      and (e.repeat_weekly_until is null or occurrence.local_day <= e.repeat_weekly_until)
      and occurrence.starts_at > now()
      and occurrence.starts_at <= now() + interval '24 hours'
  loop
    perform private.notify(v_uid, null, r.space_id, 'event_reminder',
      'Starting soon: ' || r.title,
      private.format_event_time(r.starts_at, r.timezone)
        || case when r.location is not null then ' · ' || r.location else '' end,
      '/spaces/' || r.space_id || '/events/' || r.id, r.id,
      'event_reminder:' || r.id || ':' || extract(epoch from r.starts_at)::bigint, false);
  end loop;

  -- Polls I asked or voted in whose deadline passed this week without anyone
  -- closing them: the result notice close_poll() would have sent.
  for r in
    select p.id, p.question, p.space_id
    from public.polls p
    where p.closed_at is null
      and p.deadline is not null
      and p.deadline <= now()
      and p.deadline > now() - interval '7 days'
      and private.is_space_member(p.space_id)
      and (
        p.created_by = v_uid
        or exists (select 1 from public.poll_votes v where v.poll_id = p.id and v.user_id = v_uid)
      )
  loop
    perform private.notify(v_uid, null, r.space_id, 'poll_closed',
      'Poll closed: ' || r.question,
      private.poll_outcome_text(r.id),
      '/spaces/' || r.space_id || '/polls/' || r.id, r.id, 'poll_closed:' || r.id, false);
  end loop;
end;
$$;

revoke execute on function public.sync_my_reminders() from public, anon;
grant execute on function public.sync_my_reminders() to authenticated;
