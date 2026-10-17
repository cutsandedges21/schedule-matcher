-- supabase/migrations/0018_tasks_polls.sql
--
-- Shared tasks and group polls. Design doc §5.
--
--   space_tasks      a task, or an assignment (a top-level task whose
--                    subtasks divide the work); one level of nesting only
--   task_assignees   who is responsible, any number of members
--   polls            a question; 'schedule' polls offer times and can turn
--                    the winning time into an event
--   poll_options     the answers, with a time span for schedule polls
--   poll_votes       one row per (option, voter); single-choice is enforced
--                    by cast_vote(), the only write path
--
-- WHO MAY DO WHAT
--
--   Tasks: any member creates. The creator, an assignee, or a manager edits
--   and changes status; any member may assign or unassign THEMSELVES (taking
--   a task on is not a privilege). Only the creator or a manager deletes.
--
--   Polls: any member creates and votes. Votes are readable by their own
--   voter only; everyone else sees results through get_poll_results(),
--   which applies the poll's visibility and anonymity rules on the server —
--   the client is never trusted to hide what it was sent.
--
--   Closing, and scheduling a poll's option as an event, are the creator's
--   or a manager's.

-- ---------------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------------

create table public.space_tasks (
  id             uuid primary key default gen_random_uuid(),
  space_id       uuid not null references public.spaces(id) on delete cascade,
  parent_id      uuid references public.space_tasks(id) on delete cascade,
  is_assignment  boolean not null default false,
  title          text not null,
  description    text,
  status         text not null default 'todo',
  priority       text not null default 'normal',
  due_at         timestamptz,
  event_id       uuid references public.space_events(id) on delete set null,
  link_url       text,
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  completed_at   timestamptz,
  completed_by   uuid references public.profiles(id) on delete set null,
  constraint space_tasks_title_length check (char_length(btrim(title)) between 1 and 200),
  constraint space_tasks_description_length check (description is null or char_length(description) <= 4000),
  constraint space_tasks_status check (status in ('todo', 'in_progress', 'done')),
  constraint space_tasks_priority check (priority in ('low', 'normal', 'high', 'urgent')),
  constraint space_tasks_link_url check (
    link_url is null
    or (link_url ~* '^https?://[^[:space:]/?#]+[^[:space:]]*$' and char_length(link_url) <= 1000)
  ),
  constraint space_tasks_not_own_parent check (parent_id is null or parent_id <> id),
  constraint space_tasks_assignment_top_level check (not (is_assignment and parent_id is not null))
);

create index space_tasks_space_idx on public.space_tasks (space_id, status, due_at);
create index space_tasks_parent_idx on public.space_tasks (parent_id);

create table public.task_assignees (
  task_id      uuid not null references public.space_tasks(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  assigned_by  uuid references public.profiles(id) on delete set null,
  assigned_at  timestamptz not null default now(),
  primary key (task_id, user_id)
);

create index task_assignees_user_idx on public.task_assignees (user_id);

-- Keeps the rules a check constraint cannot state: the parent and the linked
-- event live in the same space, nesting stops at one level, and completion
-- is stamped by the server rather than trusted from the client.
create or replace function private.validate_space_task()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent public.space_tasks;
begin
  if new.parent_id is not null then
    select * into v_parent from public.space_tasks where id = new.parent_id;
    if v_parent.id is null or v_parent.space_id <> new.space_id then
      raise exception 'A subtask has to belong to a task in the same space.';
    end if;
    if v_parent.parent_id is not null then
      raise exception 'Subtasks cannot have subtasks of their own.';
    end if;
  end if;

  if new.event_id is not null
     and not exists (select 1 from public.space_events where id = new.event_id and space_id = new.space_id) then
    raise exception 'A task can only link to an event in the same space.';
  end if;

  if new.status = 'done' and (tg_op = 'INSERT' or old.status <> 'done') then
    new.completed_at := now();
    new.completed_by := auth.uid();
  elsif new.status <> 'done' then
    new.completed_at := null;
    new.completed_by := null;
  end if;

  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create trigger space_tasks_validate before insert or update on public.space_tasks
  for each row execute function private.validate_space_task();

create or replace function private.is_task_assignee(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.task_assignees where task_id = p_task_id and user_id = auth.uid());
$$;

create or replace function private.task_space_id(p_task_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select space_id from public.space_tasks where id = p_task_id;
$$;

create or replace function private.can_edit_task(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.space_tasks t
    where t.id = p_task_id
      and private.is_space_member(t.space_id)
      and (
        t.created_by = auth.uid()
        or private.is_space_manager(t.space_id)
        or private.is_task_assignee(t.id)
      )
  );
$$;

revoke execute on function private.is_task_assignee(uuid) from public, anon;
revoke execute on function private.task_space_id(uuid) from public, anon;
revoke execute on function private.can_edit_task(uuid) from public, anon;
grant execute on function private.is_task_assignee(uuid) to authenticated, service_role;
grant execute on function private.task_space_id(uuid) to authenticated, service_role;
grant execute on function private.can_edit_task(uuid) to authenticated, service_role;

alter table public.space_tasks enable row level security;
alter table public.task_assignees enable row level security;

create policy space_tasks_select on public.space_tasks
  for select to authenticated
  using (private.is_space_member(space_id));

create policy space_tasks_update on public.space_tasks
  for update to authenticated
  using (private.can_edit_task(id))
  with check (private.is_space_member(space_id));

create policy space_tasks_delete on public.space_tasks
  for delete to authenticated
  using (
    private.is_space_member(space_id)
    and (created_by = auth.uid() or private.is_space_manager(space_id))
  );

revoke insert, update on public.space_tasks from anon, authenticated;
grant update (title, description, status, priority, due_at, event_id, link_url) on public.space_tasks to authenticated;

create policy task_assignees_select on public.task_assignees
  for select to authenticated
  using (private.is_space_member(private.task_space_id(task_id)));

revoke insert, update, delete on public.task_assignees from anon, authenticated;

-- History: creation, completion and reopening. Edits to wording, priority or
-- dates are not logged — a feed of "changed a due date" lines buries the ones
-- that matter.
create or replace function private.after_space_task_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform private.log_activity(new.space_id, new.created_by, 'task.created', 'task', new.id,
      case when new.is_assignment then 'created the assignment "' else 'added the task "' end || new.title || '"');
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'done' then
      perform private.log_activity(new.space_id, auth.uid(), 'task.completed', 'task', new.id,
        'completed "' || new.title || '"');
    elsif old.status = 'done' then
      perform private.log_activity(new.space_id, auth.uid(), 'task.reopened', 'task', new.id,
        'reopened "' || new.title || '"');
    end if;
  elsif tg_op = 'DELETE'
        and exists (select 1 from public.spaces where id = old.space_id)
        -- A subtask going with its assignment: the assignment's own line says it.
        and (old.parent_id is null or exists (select 1 from public.space_tasks where id = old.parent_id)) then
    perform private.log_activity(old.space_id, auth.uid(), 'task.deleted', 'task', old.id,
      'deleted "' || old.title || '"');
  end if;
  return null;
end;
$$;

create trigger space_tasks_after_change after insert or update or delete on public.space_tasks
  for each row execute function private.after_space_task_changed();

create or replace function private.after_task_assigned()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.space_tasks;
  v_zone text;
begin
  select * into v_task from public.space_tasks where id = new.task_id;
  select timezone into v_zone from public.spaces where id = v_task.space_id;

  perform private.notify(
    new.user_id, new.assigned_by, v_task.space_id, 'task_assigned',
    'New task: ' || v_task.title,
    case when v_task.due_at is not null
      then 'Due ' || private.format_event_time(v_task.due_at, coalesce(v_zone, 'America/Toronto'))
      else null end,
    '/spaces/' || v_task.space_id || '/tasks?task=' || v_task.id,
    v_task.id, 'task_assigned:' || v_task.id, true
  );
  return null;
end;
$$;

create trigger task_assignees_after_insert after insert on public.task_assignees
  for each row execute function private.after_task_assigned();

-- Leaving a space hands back your tasks in it: a task assigned to someone who
-- can no longer see it would sit there assigned and never done.
create or replace function private.after_member_removed_from_tasks()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.task_assignees a
  using public.space_tasks t
  where a.task_id = t.id and t.space_id = old.space_id and a.user_id = old.user_id;
  return null;
end;
$$;

create trigger space_members_after_delete_tasks after delete on public.space_members
  for each row execute function private.after_member_removed_from_tasks();

create or replace function public.create_space_task(
  p_space_id uuid,
  p_title text,
  p_description text default null,
  p_priority text default 'normal',
  p_due_at timestamptz default null,
  p_parent_id uuid default null,
  p_is_assignment boolean default false,
  p_event_id uuid default null,
  p_link_url text default null,
  p_assignee_ids uuid[] default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_task uuid;
begin
  perform private.require_space_role(p_space_id, 'member');

  if (select count(*) from public.space_tasks where space_id = p_space_id) >= 2000 then
    raise exception 'This space has 2000 tasks, the most allowed. Delete some finished ones first.';
  end if;
  if p_assignee_ids is not null and exists (
    select 1 from unnest(p_assignee_ids) as a(id)
    where not exists (select 1 from public.space_members m where m.space_id = p_space_id and m.user_id = a.id)
  ) then
    raise exception 'Tasks can only be assigned to members of this space.';
  end if;

  insert into public.space_tasks (
    space_id, parent_id, is_assignment, title, description, priority, due_at, event_id, link_url, created_by
  )
  values (
    p_space_id, p_parent_id, coalesce(p_is_assignment, false), btrim(p_title), nullif(btrim(p_description), ''),
    coalesce(p_priority, 'normal'), p_due_at, p_event_id, nullif(btrim(p_link_url), ''), v_uid
  )
  returning id into v_task;

  insert into public.task_assignees (task_id, user_id, assigned_by)
  select v_task, a.id, v_uid
  from (select distinct unnest(p_assignee_ids) as id) a;

  return v_task;
end;
$$;

-- Replaces a task's assignees with exactly `p_user_ids`. Anyone who may edit
-- the task can set anyone; any other member may only add or remove
-- themselves — claiming a task, or handing it back.
create or replace function public.set_task_assignees(p_task_id uuid, p_user_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_space uuid := private.task_space_id(p_task_id);
  v_wanted uuid[] := array(select distinct unnest(coalesce(p_user_ids, array[]::uuid[])));
begin
  if v_space is null then
    raise exception 'That task no longer exists.';
  end if;
  perform private.require_space_role(v_space, 'member');

  if exists (
    select 1 from unnest(v_wanted) as w(id)
    where not exists (select 1 from public.space_members m where m.space_id = v_space and m.user_id = w.id)
  ) then
    raise exception 'Tasks can only be assigned to members of this space.';
  end if;

  if not private.can_edit_task(p_task_id) and exists (
    (select user_id from public.task_assignees where task_id = p_task_id
     except select unnest(v_wanted))
    union
    (select unnest(v_wanted)
     except select user_id from public.task_assignees where task_id = p_task_id)
    except select v_uid
  ) then
    raise exception 'You can only add or remove yourself on this task.' using errcode = '42501';
  end if;

  delete from public.task_assignees
  where task_id = p_task_id and not (user_id = any(v_wanted));

  insert into public.task_assignees (task_id, user_id, assigned_by)
  select p_task_id, w.id, v_uid
  from unnest(v_wanted) as w(id)
  on conflict (task_id, user_id) do nothing;
end;
$$;

revoke execute on function public.create_space_task(uuid, text, text, text, timestamptz, uuid, boolean, uuid, text, uuid[]) from public, anon;
revoke execute on function public.set_task_assignees(uuid, uuid[]) from public, anon;
grant execute on function public.create_space_task(uuid, text, text, text, timestamptz, uuid, boolean, uuid, text, uuid[]) to authenticated;
grant execute on function public.set_task_assignees(uuid, uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Polls
-- ---------------------------------------------------------------------------

create table public.polls (
  id                  uuid primary key default gen_random_uuid(),
  space_id            uuid not null references public.spaces(id) on delete cascade,
  question            text not null,
  description         text,
  kind                text not null default 'general',
  allow_multiple      boolean not null default false,
  -- Nobody, not even the creator, can see who voted for what.
  anonymous           boolean not null default false,
  -- always      counts are visible to every member from the first vote
  -- after_vote  a member sees counts once they have voted
  -- after_close counts appear when the poll closes (the creator and
  --             managers can always see them, to know when to close)
  results_visibility  text not null default 'always',
  deadline            timestamptz,
  -- Schedule polls: the meeting length, and the zone the times are shown in.
  duration_minutes    smallint,
  timezone            text,
  closed_at           timestamptz,
  closed_by           uuid references public.profiles(id) on delete set null,
  event_id            uuid references public.space_events(id) on delete set null,
  created_by          uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint polls_question_length check (char_length(btrim(question)) between 1 and 200),
  constraint polls_description_length check (description is null or char_length(description) <= 1000),
  constraint polls_kind check (kind in ('general', 'schedule')),
  constraint polls_results_visibility check (results_visibility in ('always', 'after_vote', 'after_close')),
  constraint polls_duration check (duration_minutes is null or duration_minutes between 5 and 1440),
  constraint polls_schedule_fields check (kind <> 'schedule' or (duration_minutes is not null and timezone is not null))
);

create index polls_space_idx on public.polls (space_id, created_at desc);

create table public.poll_options (
  id          uuid primary key default gen_random_uuid(),
  poll_id     uuid not null references public.polls(id) on delete cascade,
  label       text not null,
  starts_at   timestamptz,
  ends_at     timestamptz,
  position    smallint not null default 0,
  created_at  timestamptz not null default now(),
  constraint poll_options_label_length check (char_length(btrim(label)) between 1 and 200),
  constraint poll_options_time_pair check ((starts_at is null) = (ends_at is null)),
  constraint poll_options_time_order check (ends_at is null or ends_at > starts_at)
);

create index poll_options_poll_idx on public.poll_options (poll_id, position);

create table public.poll_votes (
  poll_id     uuid not null references public.polls(id) on delete cascade,
  option_id   uuid not null references public.poll_options(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (option_id, user_id)
);

create index poll_votes_poll_user_idx on public.poll_votes (poll_id, user_id);

alter table public.space_events
  add column poll_id uuid references public.polls(id) on delete set null;

create trigger polls_touch_updated_at before update on public.polls
  for each row execute function private.touch_updated_at();

create or replace function private.poll_space_id(p_poll_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select space_id from public.polls where id = p_poll_id;
$$;

revoke execute on function private.poll_space_id(uuid) from public, anon;
grant execute on function private.poll_space_id(uuid) to authenticated, service_role;

alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;

create policy polls_select on public.polls
  for select to authenticated
  using (private.is_space_member(space_id));

create policy polls_update on public.polls
  for update to authenticated
  using (
    private.is_space_member(space_id)
    and (created_by = auth.uid() or private.is_space_manager(space_id))
  )
  with check (private.is_space_member(space_id));

create policy polls_delete on public.polls
  for delete to authenticated
  using (
    private.is_space_member(space_id)
    and (created_by = auth.uid() or private.is_space_manager(space_id))
  );

revoke insert, update on public.polls from anon, authenticated;
-- Wording and timing only. Options, kind and the visibility rules are fixed
-- once people may have voted under them.
grant update (description, deadline) on public.polls to authenticated;

create policy poll_options_select on public.poll_options
  for select to authenticated
  using (private.is_space_member(private.poll_space_id(poll_id)));

revoke insert, update, delete on public.poll_options from anon, authenticated;

-- Your own votes, and nobody else's: counts come from get_poll_results().
create policy poll_votes_select_own on public.poll_votes
  for select to authenticated
  using (user_id = auth.uid());

revoke insert, update, delete on public.poll_votes from anon, authenticated;

create or replace function private.poll_is_open(p_poll public.polls)
returns boolean
language sql
stable
set search_path = public
as $$
  select p_poll.closed_at is null and (p_poll.deadline is null or p_poll.deadline > now());
$$;

create or replace function public.create_poll(
  p_space_id uuid,
  p_question text,
  p_options jsonb,
  p_description text default null,
  p_kind text default 'general',
  p_allow_multiple boolean default false,
  p_anonymous boolean default false,
  p_results_visibility text default 'always',
  p_deadline timestamptz default null,
  p_duration_minutes integer default null,
  p_timezone text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_poll uuid;
  v_count integer := coalesce(jsonb_array_length(p_options), 0);
  v_question text := btrim(p_question);
  v_member uuid;
begin
  perform private.require_space_role(p_space_id, 'member');

  if jsonb_typeof(p_options) is distinct from 'array' or v_count < 2 or v_count > 20 then
    raise exception 'A poll needs between 2 and 20 options.';
  end if;
  if p_deadline is not null and p_deadline <= now() then
    raise exception 'The deadline has to be in the future.';
  end if;
  if p_kind = 'schedule' and exists (
    select 1 from jsonb_array_elements(p_options) as o
    where o->>'starts_at' is null or o->>'ends_at' is null
  ) then
    raise exception 'Every option in a scheduling poll needs a time.';
  end if;
  if (
    select count(distinct lower(btrim(o->>'label'))) from jsonb_array_elements(p_options) as o
  ) < v_count then
    raise exception 'Two options have the same wording.';
  end if;
  if p_kind = 'schedule' then
    perform private.assert_time_zone(p_timezone);
  end if;

  insert into public.polls (
    space_id, question, description, kind, allow_multiple, anonymous, results_visibility,
    deadline, duration_minutes, timezone, created_by
  )
  values (
    p_space_id, v_question, nullif(btrim(p_description), ''), coalesce(p_kind, 'general'),
    coalesce(p_allow_multiple, false), coalesce(p_anonymous, false), coalesce(p_results_visibility, 'always'),
    p_deadline, p_duration_minutes, p_timezone, v_uid
  )
  returning id into v_poll;

  insert into public.poll_options (poll_id, label, starts_at, ends_at, position)
  select v_poll, btrim(o.value->>'label'), (o.value->>'starts_at')::timestamptz, (o.value->>'ends_at')::timestamptz,
         (o.ordinality - 1)::smallint
  from jsonb_array_elements(p_options) with ordinality as o(value, ordinality);

  for v_member in select user_id from public.space_members where space_id = p_space_id loop
    perform private.notify(v_member, v_uid, p_space_id, 'poll_open',
      'New poll: ' || v_question,
      case when p_deadline is not null then 'Vote by ' || private.format_event_time(p_deadline, coalesce(p_timezone, (select timezone from public.spaces where id = p_space_id))) else null end,
      '/spaces/' || p_space_id || '/polls/' || v_poll, v_poll, 'poll_open:' || v_poll, false);
  end loop;

  perform private.log_activity(p_space_id, v_uid, 'poll.created', 'poll', v_poll,
    'asked "' || v_question || '"');
  return v_poll;
end;
$$;

-- Replaces the caller's votes on one poll with `p_option_ids` (empty = take
-- my vote back). Concurrent votes from one student are serialised by an
-- advisory lock; votes from different students never conflict.
create or replace function public.cast_vote(p_poll_id uuid, p_option_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_poll public.polls;
  v_choices uuid[] := array(select distinct unnest(coalesce(p_option_ids, array[]::uuid[])));
begin
  select * into v_poll from public.polls where id = p_poll_id;
  if v_poll.id is null then
    raise exception 'That poll no longer exists.';
  end if;
  perform private.require_space_role(v_poll.space_id, 'member');

  if not private.poll_is_open(v_poll) then
    raise exception 'This poll is closed.';
  end if;
  if not v_poll.allow_multiple and cardinality(v_choices) > 1 then
    raise exception 'This poll allows one answer.';
  end if;
  if exists (
    select 1 from unnest(v_choices) as c(id)
    where not exists (select 1 from public.poll_options o where o.id = c.id and o.poll_id = p_poll_id)
  ) then
    raise exception 'That option is not part of this poll.';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_poll_id::text || ':' || v_uid::text));

  delete from public.poll_votes where poll_id = p_poll_id and user_id = v_uid;
  insert into public.poll_votes (poll_id, option_id, user_id)
  select p_poll_id, c.id, v_uid from unnest(v_choices) as c(id);
end;
$$;

-- "Winner: Thursday (4 votes)", "Tie: A and B (3 votes each)", "No votes".
create or replace function private.poll_outcome_text(p_poll_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_top integer;
  v_labels text;
  v_count integer;
begin
  select max(n) into v_top from (
    select count(v.user_id) as n
    from public.poll_options o
    left join public.poll_votes v on v.option_id = o.id
    where o.poll_id = p_poll_id
    group by o.id
  ) counts;

  if coalesce(v_top, 0) = 0 then
    return 'Nobody voted.';
  end if;

  select string_agg(label, ' and ' order by position), count(*) into v_labels, v_count
  from (
    select o.label, o.position, count(v.user_id) as n
    from public.poll_options o
    left join public.poll_votes v on v.option_id = o.id
    where o.poll_id = p_poll_id
    group by o.id, o.label, o.position
  ) counts
  where n = v_top;

  if v_count > 1 then
    return 'Tie: ' || v_labels || ' (' || v_top || ' votes each)';
  end if;
  return 'Winner: ' || v_labels || ' (' || v_top || case when v_top = 1 then ' vote)' else ' votes)' end;
end;
$$;

create or replace function public.close_poll(p_poll_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_poll public.polls;
  v_role text;
  v_outcome text;
  v_member uuid;
begin
  select * into v_poll from public.polls where id = p_poll_id for update;
  if v_poll.id is null then
    raise exception 'That poll no longer exists.';
  end if;
  v_role := private.require_space_role(v_poll.space_id, 'member');
  if v_poll.created_by is distinct from v_uid and v_role not in ('owner', 'admin') then
    raise exception 'Only the person who asked, or an admin, can close this poll.' using errcode = '42501';
  end if;
  if v_poll.closed_at is not null then
    return;
  end if;

  update public.polls set closed_at = now(), closed_by = v_uid where id = p_poll_id;
  v_outcome := private.poll_outcome_text(p_poll_id);

  -- Everyone who took part, and the person who asked.
  for v_member in
    select distinct user_id from public.poll_votes where poll_id = p_poll_id
    union
    select v_poll.created_by where v_poll.created_by is not null
  loop
    perform private.notify(v_member, v_uid, v_poll.space_id, 'poll_closed',
      'Poll closed: ' || v_poll.question, v_outcome,
      '/spaces/' || v_poll.space_id || '/polls/' || p_poll_id, p_poll_id, 'poll_closed:' || p_poll_id, true);
  end loop;

  perform private.log_activity(v_poll.space_id, v_uid, 'poll.closed', 'poll', p_poll_id,
    'closed "' || v_poll.question || '" — ' || v_outcome);
end;
$$;

-- Results as the caller is allowed to see them. `visible` false means the
-- counts are withheld (null), never zeroed: "nobody has voted" and "you may
-- not see the votes yet" are different facts and the UI says which.
create or replace function public.get_poll_results(p_poll_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_poll public.polls;
  v_role text;
  v_voted boolean;
  v_visible boolean;
begin
  select * into v_poll from public.polls where id = p_poll_id;
  if v_poll.id is null then
    raise exception 'That poll no longer exists.';
  end if;
  v_role := private.require_space_role(v_poll.space_id, 'member');
  v_voted := exists (select 1 from public.poll_votes where poll_id = p_poll_id and user_id = v_uid);

  v_visible := v_poll.results_visibility = 'always'
    or (v_poll.results_visibility = 'after_vote' and v_voted)
    or not private.poll_is_open(v_poll)
    or v_poll.created_by = v_uid
    or v_role in ('owner', 'admin');

  return jsonb_build_object(
    'visible', v_visible,
    'open', private.poll_is_open(v_poll),
    'voter_count', (select count(distinct user_id) from public.poll_votes where poll_id = p_poll_id),
    'my_votes', coalesce((
      select jsonb_agg(option_id) from public.poll_votes where poll_id = p_poll_id and user_id = v_uid
    ), '[]'::jsonb),
    'voters', case when v_poll.anonymous or not v_visible then null else coalesce((
      select jsonb_agg(distinct user_id) from public.poll_votes where poll_id = p_poll_id
    ), '[]'::jsonb) end,
    'options', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', o.id,
        'votes', case when v_visible then (select count(*) from public.poll_votes v where v.option_id = o.id) end,
        'voters', case when v_visible and not v_poll.anonymous then coalesce((
          select jsonb_agg(v.user_id) from public.poll_votes v where v.option_id = o.id
        ), '[]'::jsonb) end
      ) order by o.position)
      from public.poll_options o where o.poll_id = p_poll_id
    ), '[]'::jsonb)
  );
end;
$$;

-- Turns one option of a scheduling poll into a confirmed event: every member
-- is invited, the people who voted for that time are marked as going, and
-- the poll closes and links to the event. Any option may be picked, not only
-- the leader — a tie, or a winner the organizer cannot make, is the group's
-- call, and the person scheduling makes it.
create or replace function public.schedule_poll_option(
  p_poll_id uuid,
  p_option_id uuid,
  p_title text default null,
  p_location text default null,
  p_description text default null,
  p_meeting_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_poll public.polls;
  v_option public.poll_options;
  v_role text;
  v_event uuid;
begin
  select * into v_poll from public.polls where id = p_poll_id for update;
  if v_poll.id is null then
    raise exception 'That poll no longer exists.';
  end if;
  v_role := private.require_space_role(v_poll.space_id, 'member');
  if v_poll.created_by is distinct from v_uid and v_role not in ('owner', 'admin') then
    raise exception 'Only the person who asked, or an admin, can schedule this poll.' using errcode = '42501';
  end if;
  if v_poll.kind <> 'schedule' then
    raise exception 'Only a scheduling poll can become an event.';
  end if;
  if v_poll.event_id is not null then
    raise exception 'This poll has already been scheduled.';
  end if;

  select * into v_option from public.poll_options where id = p_option_id and poll_id = p_poll_id;
  if v_option.id is null then
    raise exception 'That option is not part of this poll.';
  end if;

  v_event := private.insert_space_event(
    v_poll.space_id, v_uid, coalesce(nullif(btrim(p_title), ''), v_poll.question), p_description,
    p_location, p_meeting_url, v_option.starts_at, v_option.ends_at, v_poll.timezone, null, null
  );

  update public.event_attendees
  set response = 'going', responded_at = now()
  where event_id = v_event
    and response = 'pending'
    and user_id in (select user_id from public.poll_votes where option_id = p_option_id);

  update public.space_events set poll_id = p_poll_id where id = v_event;
  update public.polls
  set event_id = v_event, closed_at = coalesce(closed_at, now()), closed_by = coalesce(closed_by, v_uid)
  where id = p_poll_id;

  perform private.log_activity(v_poll.space_id, v_uid, 'poll.scheduled', 'poll', p_poll_id,
    'picked ' || v_option.label || ' for "' || v_poll.question || '"');
  return v_event;
end;
$$;

-- poll_id is set by schedule_poll_option() only; the column grant on
-- space_events from 0017 does not include it, so clients cannot forge it.

create or replace function private.after_poll_deleted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.spaces where id = old.space_id) then
    perform private.log_activity(old.space_id, auth.uid(), 'poll.deleted', 'poll', old.id,
      'deleted the poll "' || old.question || '"');
  end if;
  return null;
end;
$$;

create trigger polls_after_delete after delete on public.polls
  for each row execute function private.after_poll_deleted();

revoke execute on function private.poll_is_open(public.polls) from public, anon;
revoke execute on function private.poll_outcome_text(uuid) from public, anon, authenticated;
grant execute on function private.poll_is_open(public.polls) to authenticated, service_role;

revoke execute on function public.create_poll(uuid, text, jsonb, text, text, boolean, boolean, text, timestamptz, integer, text) from public, anon;
revoke execute on function public.cast_vote(uuid, uuid[]) from public, anon;
revoke execute on function public.close_poll(uuid) from public, anon;
revoke execute on function public.get_poll_results(uuid) from public, anon;
revoke execute on function public.schedule_poll_option(uuid, uuid, text, text, text, text) from public, anon;
grant execute on function public.create_poll(uuid, text, jsonb, text, text, boolean, boolean, text, timestamptz, integer, text) to authenticated;
grant execute on function public.cast_vote(uuid, uuid[]) to authenticated;
grant execute on function public.close_poll(uuid) to authenticated;
grant execute on function public.get_poll_results(uuid) to authenticated;
grant execute on function public.schedule_poll_option(uuid, uuid, text, text, text, text) to authenticated;
