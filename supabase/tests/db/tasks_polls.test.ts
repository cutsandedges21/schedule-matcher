// supabase/tests/db/tasks_polls.test.ts
//
// Migration 0018: task permissions and assignment, and every voting rule.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, query, type TestDb, type TestUser } from './harness';
import { createSpace, daysFromNow, plusMinutes, spaceWith } from './fixtures';

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
}, 120_000);

afterAll(async () => {
  await db?.close();
});

async function createTask(
  user: TestUser,
  spaceId: string,
  options: { title?: string; assignees?: string[] | null; parentId?: string | null; assignment?: boolean; dueAt?: string | null } = {}
): Promise<string> {
  const [row] = await query<{ id: string }>(
    db,
    user.id,
    `select public.create_space_task($1, $2, null, 'normal', $3, $4, $5, null, null, $6) as id`,
    [spaceId, options.title ?? 'Write intro', options.dueAt ?? null, options.parentId ?? null, options.assignment ?? false, options.assignees ?? null]
  );
  return row.id;
}

async function taskRow(id: string) {
  const [row] = await db.admin<{ title: string; status: string; completed_at: string | null; completed_by: string | null }>(
    `select title, status, completed_at, completed_by from public.space_tasks where id = $1`,
    [id]
  );
  return row;
}

async function assignees(taskId: string): Promise<string[]> {
  const rows = await db.admin<{ user_id: string }>(`select user_id from public.task_assignees where task_id = $1 order by user_id`, [taskId]);
  return rows.map((r) => r.user_id);
}

describe('tasks', () => {
  it('creates a task with assignees, notifying them but not the creator', async () => {
    const { spaceId, owner, members } = await spaceWith(db, 2, 'tk_new');
    const [a, b] = members;
    const taskId = await createTask(owner, spaceId, { assignees: [a.id, owner.id], dueAt: daysFromNow(3) });

    expect(await assignees(taskId)).toEqual([a.id, owner.id].sort());
    const notes = await query<{ kind: string; title: string; link: string }>(db, a.id, `select kind, title, link from public.notifications`);
    expect(notes).toEqual([{ kind: 'task_assigned', title: 'New task: Write intro', link: `/spaces/${spaceId}/tasks?task=${taskId}` }]);
    expect(await query(db, owner.id, `select * from public.notifications where kind = 'task_assigned'`)).toHaveLength(0);
    expect(await query(db, b.id, `select * from public.notifications where kind = 'task_assigned'`)).toHaveLength(0);
  });

  it('refuses assignees from outside the space, and outsiders entirely', async () => {
    const { spaceId, owner } = await spaceWith(db, 0, 'tk_out');
    const outsider = await db.createUser('tk_out_x');
    await expect(createTask(owner, spaceId, { assignees: [outsider.id] })).rejects.toThrow(/members of this space/);
    await expect(createTask(outsider, spaceId)).rejects.toThrow(/not a member/);
    const taskId = await createTask(owner, spaceId);
    expect(await query(db, outsider.id, `select * from public.space_tasks where id = $1`, [taskId])).toHaveLength(0);
  });

  it('lets the creator, an assignee and a manager edit, but not another member', async () => {
    const { spaceId, owner, members } = await spaceWith(db, 3, 'tk_edit');
    const [creator, assignee, bystander] = members;
    const taskId = await createTask(creator, spaceId, { assignees: [assignee.id] });

    await query(db, bystander.id, `update public.space_tasks set title = 'Hijacked' where id = $1`, [taskId]);
    expect((await taskRow(taskId)).title).toBe('Write intro');

    await query(db, assignee.id, `update public.space_tasks set status = 'in_progress' where id = $1`, [taskId]);
    expect((await taskRow(taskId)).status).toBe('in_progress');
    await query(db, creator.id, `update public.space_tasks set title = 'Write the intro' where id = $1`, [taskId]);
    await query(db, owner.id, `update public.space_tasks set priority = 'high' where id = $1`, [taskId]);
    expect((await taskRow(taskId)).title).toBe('Write the intro');
  });

  it('stamps completion on the server and keeps the history', async () => {
    const { spaceId, members } = await spaceWith(db, 1, 'tk_done');
    const [member] = members;
    const taskId = await createTask(member, spaceId, { assignees: [member.id] });

    await query(db, member.id, `update public.space_tasks set status = 'done' where id = $1`, [taskId]);
    let row = await taskRow(taskId);
    expect(row.completed_by).toBe(member.id);
    expect(row.completed_at).not.toBeNull();

    // A forged completion time is overwritten, not trusted.
    await expect(
      query(db, member.id, `update public.space_tasks set completed_at = '2000-01-01' where id = $1`, [taskId])
    ).rejects.toThrow(/permission denied/);

    await query(db, member.id, `update public.space_tasks set status = 'todo' where id = $1`, [taskId]);
    row = await taskRow(taskId);
    expect(row.completed_at).toBeNull();

    const verbs = await query<{ verb: string }>(
      db, member.id, `select verb from public.space_activity where entity_id = $1 order by id`, [taskId]
    );
    expect(verbs.map((v) => v.verb)).toEqual(['task.created', 'task.completed', 'task.reopened']);
  });

  it('nests one level only, inside one space', async () => {
    const { spaceId, owner } = await spaceWith(db, 0, 'tk_nest');
    const otherSpace = await createSpace(db, owner, 'Other');
    const assignment = await createTask(owner, spaceId, { title: 'Lab report', assignment: true });
    const part = await createTask(owner, spaceId, { title: 'Methods', parentId: assignment });

    await expect(createTask(owner, spaceId, { title: 'Too deep', parentId: part })).rejects.toThrow(/Subtasks cannot have subtasks/);
    await expect(createTask(owner, otherSpace, { title: 'Wrong space', parentId: assignment })).rejects.toThrow(/same space/);
    await expect(createTask(owner, spaceId, { title: 'Nested assignment', parentId: assignment, assignment: true })).rejects.toThrow(
      /assignment_top_level/
    );
  });

  it('lets any member claim or drop a task, but only an editor assign others', async () => {
    const { spaceId, owner, members } = await spaceWith(db, 2, 'tk_claim');
    const [a, b] = members;
    const taskId = await createTask(owner, spaceId);

    await query(db, a.id, `select public.set_task_assignees($1, $2)`, [taskId, [a.id]]);
    expect(await assignees(taskId)).toEqual([a.id]);

    await expect(query(db, b.id, `select public.set_task_assignees($1, $2)`, [taskId, [a.id, b.id, owner.id]])).rejects.toThrow(
      /only add or remove yourself/
    );
    // b claiming alongside a is fine; it changes only b.
    await query(db, b.id, `select public.set_task_assignees($1, $2)`, [taskId, [a.id, b.id]]);
    expect(await assignees(taskId)).toEqual([a.id, b.id].sort());

    // The creator can hand it to anyone.
    await query(db, owner.id, `select public.set_task_assignees($1, $2)`, [taskId, [owner.id]]);
    expect(await assignees(taskId)).toEqual([owner.id]);
  });

  it('lets only the creator or a manager delete', async () => {
    const { spaceId, owner, members } = await spaceWith(db, 2, 'tk_del');
    const [creator, assignee] = members;
    const taskId = await createTask(creator, spaceId, { assignees: [assignee.id] });

    await query(db, assignee.id, `delete from public.space_tasks where id = $1`, [taskId]);
    expect(await db.admin(`select id from public.space_tasks where id = $1`, [taskId])).toHaveLength(1);
    await query(db, owner.id, `delete from public.space_tasks where id = $1`, [taskId]);
    expect(await db.admin(`select id from public.space_tasks where id = $1`, [taskId])).toHaveLength(0);
  });

  it('hands back a member’s tasks when they leave', async () => {
    const { spaceId, owner, members } = await spaceWith(db, 1, 'tk_leave');
    const [member] = members;
    const taskId = await createTask(owner, spaceId, { assignees: [member.id] });
    await query(db, member.id, `select public.leave_space($1)`, [spaceId]);
    expect(await assignees(taskId)).toEqual([]);
  });
});

async function createPoll(
  user: TestUser,
  spaceId: string,
  options: {
    labels?: string[];
    multiple?: boolean;
    anonymous?: boolean;
    visibility?: 'always' | 'after_vote' | 'after_close';
    deadline?: string | null;
    schedule?: boolean;
  } = {}
): Promise<{ pollId: string; optionIds: string[] }> {
  const labels = options.labels ?? ['Thursday', 'Friday', 'Saturday'];
  const optionJson = labels.map((label, i) =>
    options.schedule
      ? { label, starts_at: daysFromNow(4 + i, 18), ends_at: plusMinutes(daysFromNow(4 + i, 18), 60) }
      : { label }
  );
  const [row] = await query<{ id: string }>(
    db,
    user.id,
    `select public.create_poll($1, 'When do we meet?', $2::jsonb, null, $3, $4, $5, $6, $7, $8, $9) as id`,
    [
      spaceId,
      JSON.stringify(optionJson),
      options.schedule ? 'schedule' : 'general',
      options.multiple ?? false,
      options.anonymous ?? false,
      options.visibility ?? 'always',
      options.deadline ?? null,
      options.schedule ? 60 : null,
      options.schedule ? 'America/Toronto' : null,
    ]
  );
  const optionRows = await db.admin<{ id: string }>(`select id from public.poll_options where poll_id = $1 order by position`, [row.id]);
  return { pollId: row.id, optionIds: optionRows.map((o) => o.id) };
}

function vote(user: TestUser, pollId: string, optionIds: string[]) {
  return query(db, user.id, `select public.cast_vote($1, $2)`, [pollId, optionIds]);
}

interface Results {
  visible: boolean;
  open: boolean;
  voter_count: number;
  my_votes: string[];
  voters: string[] | null;
  options: { id: string; votes: number | null; voters: string[] | null }[];
}

async function results(user: TestUser, pollId: string): Promise<Results> {
  const [row] = await query<{ r: Results }>(db, user.id, `select public.get_poll_results($1) as r`, [pollId]);
  return row.r;
}

describe('creating polls', () => {
  it('validates options, deadline and schedule times', async () => {
    const { spaceId, owner } = await spaceWith(db, 0, 'pl_val');
    await expect(createPoll(owner, spaceId, { labels: ['Only one'] })).rejects.toThrow(/between 2 and 20/);
    await expect(createPoll(owner, spaceId, { labels: ['Same', 'same '] })).rejects.toThrow(/same wording/);
    await expect(createPoll(owner, spaceId, { deadline: daysFromNow(-1) })).rejects.toThrow(/future/);
    await expect(
      query(db, owner.id, `select public.create_poll($1, 'Q', '[{"label":"a"},{"label":"b"}]'::jsonb, null, 'schedule', false, false, 'always', null, 60, 'America/Toronto')`, [spaceId])
    ).rejects.toThrow(/needs a time/);
  });

  it('notifies every member but the person asking', async () => {
    const { spaceId, owner, members } = await spaceWith(db, 2, 'pl_note');
    const { pollId } = await createPoll(owner, spaceId);
    for (const member of members) {
      const notes = await query<{ kind: string; link: string }>(db, member.id, `select kind, link from public.notifications`);
      expect(notes).toEqual([{ kind: 'poll_open', link: `/spaces/${spaceId}/polls/${pollId}` }]);
    }
    expect(await query(db, owner.id, `select * from public.notifications where kind = 'poll_open'`)).toHaveLength(0);
  });
});

describe('voting', () => {
  it('enforces one answer, lets a voter change or withdraw it, and keeps votes private', async () => {
    const { spaceId, owner, members } = await spaceWith(db, 2, 'pl_vote');
    const [a, b] = members;
    const { pollId, optionIds } = await createPoll(owner, spaceId);

    await expect(vote(a, pollId, [optionIds[0], optionIds[1]])).rejects.toThrow(/one answer/);
    await vote(a, pollId, [optionIds[0]]);
    await vote(a, pollId, [optionIds[1]]);
    await vote(b, pollId, [optionIds[1]]);

    let r = await results(owner, pollId);
    expect(r.options.map((o) => o.votes)).toEqual([0, 2, 0]);
    expect(r.voter_count).toBe(2);

    await vote(a, pollId, []);
    r = await results(a, pollId);
    expect(r.options.map((o) => o.votes)).toEqual([0, 1, 0]);
    expect(r.my_votes).toEqual([]);

    // Raw vote rows: your own only.
    expect(await query(db, a.id, `select * from public.poll_votes where poll_id = $1`, [pollId])).toHaveLength(0);
    expect(await query(db, b.id, `select * from public.poll_votes where poll_id = $1`, [pollId])).toHaveLength(1);
    await expect(
      query(db, a.id, `insert into public.poll_votes (poll_id, option_id, user_id) values ($1, $2, $3)`, [pollId, optionIds[0], b.id])
    ).rejects.toThrow(/permission denied/);
  });

  it('allows several answers when the poll does', async () => {
    const { spaceId, owner, members } = await spaceWith(db, 1, 'pl_multi');
    const { pollId, optionIds } = await createPoll(owner, spaceId, { multiple: true });
    await vote(members[0], pollId, [optionIds[0], optionIds[2]]);
    expect((await results(owner, pollId)).options.map((o) => o.votes)).toEqual([1, 0, 1]);
  });

  it('refuses votes after close or deadline, from outsiders, and for another poll’s option', async () => {
    const { spaceId, owner, members } = await spaceWith(db, 1, 'pl_shut');
    const [member] = members;
    const outsider = await db.createUser('pl_shut_x');
    const first = await createPoll(owner, spaceId);
    const second = await createPoll(owner, spaceId, { deadline: daysFromNow(1) });

    await expect(vote(member, first.pollId, [second.optionIds[0]])).rejects.toThrow(/not part of this poll/);
    await expect(vote(outsider, first.pollId, [first.optionIds[0]])).rejects.toThrow(/not a member/);

    await query(db, owner.id, `select public.close_poll($1)`, [first.pollId]);
    await expect(vote(member, first.pollId, [first.optionIds[0]])).rejects.toThrow(/closed/);

    await db.admin(`update public.polls set deadline = now() - interval '1 minute' where id = $1`, [second.pollId]);
    await expect(vote(member, second.pollId, [second.optionIds[0]])).rejects.toThrow(/closed/);
  });
});

describe('results visibility', () => {
  it('hides counts until you vote, for after_vote polls — except from the person asking', async () => {
    const { spaceId, owner, members } = await spaceWith(db, 2, 'pl_av');
    const [a, b] = members;
    const { pollId, optionIds } = await createPoll(owner, spaceId, { visibility: 'after_vote' });
    await vote(a, pollId, [optionIds[0]]);

    const beforeVoting = await results(b, pollId);
    expect(beforeVoting.visible).toBe(false);
    expect(beforeVoting.options.map((o) => o.votes)).toEqual([null, null, null]);
    expect(beforeVoting.voter_count).toBe(1);

    expect((await results(owner, pollId)).visible).toBe(true);
    await vote(b, pollId, [optionIds[1]]);
    expect((await results(b, pollId)).options.map((o) => o.votes)).toEqual([1, 1, 0]);
  });

  it('hides counts from members until close, for after_close polls', async () => {
    const { spaceId, owner, members } = await spaceWith(db, 1, 'pl_ac');
    const [member] = members;
    const { pollId, optionIds } = await createPoll(owner, spaceId, { visibility: 'after_close' });
    await vote(member, pollId, [optionIds[2]]);

    expect((await results(member, pollId)).visible).toBe(false);
    await query(db, owner.id, `select public.close_poll($1)`, [pollId]);
    const after = await results(member, pollId);
    expect(after.visible).toBe(true);
    expect(after.open).toBe(false);
    expect(after.options.map((o) => o.votes)).toEqual([0, 0, 1]);
  });

  it('never names voters on an anonymous poll, not even to the person asking', async () => {
    const { spaceId, owner, members } = await spaceWith(db, 1, 'pl_anon');
    const { pollId, optionIds } = await createPoll(owner, spaceId, { anonymous: true });
    await vote(members[0], pollId, [optionIds[0]]);

    const r = await results(owner, pollId);
    expect(r.options[0].votes).toBe(1);
    expect(r.options[0].voters).toBeNull();
    expect(r.voters).toBeNull();

    const named = await createPoll(owner, spaceId);
    await vote(members[0], named.pollId, [named.optionIds[0]]);
    expect((await results(owner, named.pollId)).options[0].voters).toEqual([members[0].id]);
  });
});

describe('closing and scheduling', () => {
  it('lets only the person asking or a manager close, and reports the outcome', async () => {
    const { spaceId, owner, members } = await spaceWith(db, 3, 'pl_close');
    const [asker, a, b] = members;
    const { pollId, optionIds } = await createPoll(asker, spaceId);
    await vote(a, pollId, [optionIds[0]]);
    await vote(b, pollId, [optionIds[1]]);

    await expect(query(db, a.id, `select public.close_poll($1)`, [pollId])).rejects.toThrow(/Only the person who asked/);
    await query(db, owner.id, `select public.close_poll($1)`, [pollId]);

    const [note] = await query<{ title: string; body: string }>(db, a.id, `select title, body from public.notifications where kind = 'poll_closed'`);
    expect(note).toEqual({ title: 'Poll closed: When do we meet?', body: 'Tie: Thursday and Friday (1 votes each)' });
  });

  it('turns a scheduling poll’s option into an event with its voters going', async () => {
    const { spaceId, owner, members } = await spaceWith(db, 2, 'pl_sched');
    const [a, b] = members;
    const { pollId, optionIds } = await createPoll(owner, spaceId, { schedule: true });
    await vote(a, pollId, [optionIds[1]]);
    await vote(b, pollId, [optionIds[0]]);

    await expect(
      query(db, a.id, `select public.schedule_poll_option($1, $2)`, [pollId, optionIds[1]])
    ).rejects.toThrow(/Only the person who asked/);

    const [{ id: eventId }] = await query<{ id: string }>(
      db, owner.id, `select public.schedule_poll_option($1, $2, 'Project meeting', 'Library') as id`, [pollId, optionIds[1]]
    );

    const event = await db.admin<{ title: string; poll_id: string; starts_at: Date }>(
      `select title, poll_id, starts_at from public.space_events where id = $1`, [eventId]
    );
    expect(event[0]).toMatchObject({ title: 'Project meeting', poll_id: pollId });

    const responses = await db.admin<{ user_id: string; response: string }>(
      `select user_id, response from public.event_attendees where event_id = $1`, [eventId]
    );
    expect(responses.find((r) => r.user_id === a.id)?.response).toBe('going');
    expect(responses.find((r) => r.user_id === b.id)?.response).toBe('pending');

    const [poll] = await db.admin<{ closed_at: string | null; event_id: string }>(`select closed_at, event_id from public.polls where id = $1`, [pollId]);
    expect(poll.event_id).toBe(eventId);
    expect(poll.closed_at).not.toBeNull();

    await expect(
      query(db, owner.id, `select public.schedule_poll_option($1, $2)`, [pollId, optionIds[0]])
    ).rejects.toThrow(/already been scheduled/);
  });

  it('refuses to schedule a general poll', async () => {
    const { spaceId, owner } = await spaceWith(db, 0, 'pl_gen');
    const { pollId, optionIds } = await createPoll(owner, spaceId);
    await expect(query(db, owner.id, `select public.schedule_poll_option($1, $2)`, [pollId, optionIds[0]])).rejects.toThrow(
      /Only a scheduling poll/
    );
  });
});
