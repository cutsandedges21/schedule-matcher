// supabase/tests/db/resources_reminders.test.ts
//
// Migration 0019: shared links, and reminders written on demand.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, query, type TestDb, type TestUser } from './harness';
import { spaceWith } from './fixtures';

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
}, 120_000);

afterAll(async () => {
  await db?.close();
});

function addResource(user: TestUser, spaceId: string, url = 'https://docs.example.com/notes', title = 'Lecture notes') {
  return query<{ id: string }>(
    db,
    user.id,
    `insert into public.space_resources (space_id, title, url, category, created_by) values ($1, $2, $3, 'course', $4) returning id`,
    [spaceId, title, url, user.id]
  );
}

async function sync(user: TestUser) {
  await query(db, user.id, `select public.sync_my_reminders()`);
}

async function reminders(user: TestUser, kind: string) {
  return query<{ title: string; body: string }>(db, user.id, `select title, body from public.notifications where kind = $1`, [kind]);
}

describe('resources', () => {
  it('lets members share links and keeps them inside the space', async () => {
    const { spaceId, members } = await spaceWith(db, 1, 'rs_basic');
    const outsider = await db.createUser('rs_out');
    const [row] = await addResource(members[0], spaceId);

    expect(await query(db, outsider.id, `select * from public.space_resources where id = $1`, [row.id])).toHaveLength(0);
    await expect(addResource(outsider, spaceId)).rejects.toThrow(/row-level security/);

    const verbs = await query<{ verb: string }>(db, members[0].id, `select verb from public.space_activity where entity_id = $1`, [row.id]);
    expect(verbs.map((v) => v.verb)).toEqual(['resource.added']);
  });

  it('accepts only http(s) links', async () => {
    const { spaceId, owner } = await spaceWith(db, 0, 'rs_url');
    await expect(addResource(owner, spaceId, 'javascript:alert(1)')).rejects.toThrow(/space_resources_url/);
    await expect(addResource(owner, spaceId, 'ftp://files.example.com')).rejects.toThrow(/space_resources_url/);
    await expect(addResource(owner, spaceId, 'https://')).rejects.toThrow(/space_resources_url/);
  });

  it('cannot be filed under somebody else’s name', async () => {
    const { spaceId, owner, members } = await spaceWith(db, 1, 'rs_forge');
    await expect(
      query(db, members[0].id, `insert into public.space_resources (space_id, title, url, created_by) values ($1, 'x', 'https://a.example', $2)`, [
        spaceId,
        owner.id,
      ])
    ).rejects.toThrow(/row-level security/);
  });

  it('lets the sharer or a manager edit and remove it, nobody else', async () => {
    const { spaceId, owner, members } = await spaceWith(db, 2, 'rs_edit');
    const [sharer, other] = members;
    const [row] = await addResource(sharer, spaceId);

    await query(db, other.id, `update public.space_resources set title = 'Mine now' where id = $1`, [row.id]);
    await query(db, other.id, `delete from public.space_resources where id = $1`, [row.id]);
    const [kept] = await db.admin<{ title: string }>(`select title from public.space_resources where id = $1`, [row.id]);
    expect(kept.title).toBe('Lecture notes');

    await query(db, sharer.id, `update public.space_resources set title = 'Week 3 notes' where id = $1`, [row.id]);
    await query(db, owner.id, `delete from public.space_resources where id = $1`, [row.id]);
    expect(await db.admin(`select * from public.space_resources where id = $1`, [row.id])).toHaveLength(0);
  });
});

describe('sync_my_reminders()', () => {
  it('reminds an assignee once about a task due within a day', async () => {
    const { spaceId, owner, members } = await spaceWith(db, 1, 'rm_task');
    const [member] = members;
    await query(db, owner.id, `select public.create_space_task($1, 'Submit draft', null, 'high', now() + interval '3 hours', null, false, null, null, $2)`, [
      spaceId,
      [member.id],
    ]);
    await query(db, owner.id, `select public.create_space_task($1, 'Later thing', null, 'normal', now() + interval '3 days', null, false, null, null, $2)`, [
      spaceId,
      [member.id],
    ]);

    await sync(member);
    await sync(member);
    const due = await reminders(member, 'task_due');
    expect(due).toHaveLength(1);
    expect(due[0].title).toBe('Due soon: Submit draft');
  });

  it('skips finished tasks', async () => {
    const { spaceId, members } = await spaceWith(db, 1, 'rm_done');
    const [member] = members;
    const [{ id }] = await query<{ id: string }>(
      db, member.id, `select public.create_space_task($1, 'Already done', null, 'normal', now() + interval '2 hours', null, false, null, null, $2) as id`,
      [spaceId, [member.id]]
    );
    await query(db, member.id, `update public.space_tasks set status = 'done' where id = $1`, [id]);
    await sync(member);
    expect(await reminders(member, 'task_due')).toHaveLength(0);
  });

  it('reminds attendees about an event starting soon, unless they declined', async () => {
    const { spaceId, owner, members } = await spaceWith(db, 2, 'rm_event');
    const [going, declined] = members;
    const [{ id: eventId }] = await query<{ id: string }>(
      db, owner.id, `select public.create_space_event($1, 'Review session', now() + interval '2 hours', now() + interval '3 hours', 'America/Toronto', null, 'Room 210') as id`,
      [spaceId]
    );
    await query(db, declined.id, `update public.event_attendees set response = 'declined' where event_id = $1 and user_id = $2`, [eventId, declined.id]);

    await sync(going);
    await sync(declined);
    const [note] = await reminders(going, 'event_reminder');
    expect(note.title).toBe('Starting soon: Review session');
    expect(note.body).toContain('Room 210');
    expect(await reminders(declined, 'event_reminder')).toHaveLength(0);
  });

  it('finds the next occurrence of a weekly event, on its own clock', async () => {
    const { spaceId, owner } = await spaceWith(db, 0, 'rm_weekly');
    // First met six days and 22 hours ago; next meeting is in about two hours.
    await query(
      db, owner.id,
      `select public.create_space_event($1, 'Weekly standup', now() - interval '6 days 22 hours', now() - interval '6 days 21 hours', 'UTC', null, null, null, (now() + interval '30 days')::date)`,
      [spaceId]
    );
    await sync(owner);
    expect(await reminders(owner, 'event_reminder')).toEqual([expect.objectContaining({ title: 'Starting soon: Weekly standup' })]);
  });

  it('tells voters a poll closed when its deadline passed on its own', async () => {
    const { spaceId, owner, members } = await spaceWith(db, 1, 'rm_poll');
    const [member] = members;
    const [{ id: pollId }] = await query<{ id: string }>(
      db, owner.id, `select public.create_poll($1, 'Pizza or sushi?', '[{"label":"Pizza"},{"label":"Sushi"}]'::jsonb, null, 'general', false, false, 'always', now() + interval '1 day') as id`,
      [spaceId]
    );
    const [option] = await db.admin<{ id: string }>(`select id from public.poll_options where poll_id = $1 and label = 'Sushi'`, [pollId]);
    await query(db, member.id, `select public.cast_vote($1, $2)`, [pollId, [option.id]]);
    await db.admin(`update public.polls set deadline = now() - interval '1 hour' where id = $1`, [pollId]);

    await sync(member);
    await sync(member);
    const closed = await reminders(member, 'poll_closed');
    expect(closed).toEqual([{ title: 'Poll closed: Pizza or sushi?', body: 'Winner: Sushi (1 vote)' }]);
  });

  it('respects the reminders switch', async () => {
    const { spaceId, owner, members } = await spaceWith(db, 1, 'rm_off');
    const [member] = members;
    await query(db, member.id, `insert into public.notification_preferences (user_id, deadlines) values ($1, false)`, [member.id]);
    await query(db, owner.id, `select public.create_space_task($1, 'Quiet task', null, 'normal', now() + interval '1 hour', null, false, null, null, $2)`, [
      spaceId,
      [member.id],
    ]);
    await sync(member);
    expect(await reminders(member, 'task_due')).toHaveLength(0);
  });

  it('refuses anonymous callers', async () => {
    await expect(query(db, null, `select public.sync_my_reminders()`)).rejects.toThrow();
  });
});
