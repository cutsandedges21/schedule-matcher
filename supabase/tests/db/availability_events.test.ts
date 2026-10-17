// supabase/tests/db/availability_events.test.ts
//
// Migration 0017: personal availability, space_availability() privacy, and
// the shared calendar (create, permissions, RSVP, change notices).
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

interface MemberJson {
  user_id: string;
  share_level: string;
  timezone?: string;
  has_schedule?: boolean;
  preferences?: { earliest_minute: number } | null;
  classes?: { name: string | null; days: number[]; start_minute: number }[];
  blocks?: { kind: string; label: string | null }[];
  events?: { title: string | null; event_id: string | null }[];
}

async function availability(viewer: TestUser, spaceId: string, fromDays = 0, toDays = 7): Promise<MemberJson[]> {
  const [row] = await query<{ a: { members: MemberJson[] } }>(
    db,
    viewer.id,
    `select public.space_availability($1, $2, $3) as a`,
    [spaceId, daysFromNow(fromDays, 0), daysFromNow(toDays, 0)]
  );
  return row.a.members;
}

async function addClass(user: TestUser, name: string, days: number[], start: number, end: number) {
  await db.admin(
    `insert into public.classes (user_id, name, days, start_minute, end_minute, color) values ($1, $2, $3, $4, $5, 'indigo')`,
    [user.id, name, days, start, end]
  );
}

async function createEvent(
  organizer: TestUser,
  spaceId: string,
  options: { title?: string; startsAt?: string; minutes?: number; zone?: string; attendees?: string[] | null; repeatUntil?: string | null } = {}
): Promise<string> {
  const startsAt = options.startsAt ?? daysFromNow(3, 18);
  const [row] = await query<{ id: string }>(
    db,
    organizer.id,
    `select public.create_space_event($1, $2, $3, $4, $5, null, 'Library', null, $6, $7) as id`,
    [
      spaceId,
      options.title ?? 'Study session',
      startsAt,
      plusMinutes(startsAt, options.minutes ?? 60),
      options.zone ?? 'America/Toronto',
      options.repeatUntil ?? null,
      options.attendees ?? null,
    ]
  );
  return row.id;
}

describe('personal availability', () => {
  it('keeps blocks and preferences private to their owner', async () => {
    const alice = await db.createUser('blk_a');
    const bob = await db.createUser('blk_b');
    await query(db, alice.id, `insert into public.availability_blocks (user_id, kind, label, starts_at, ends_at) values ($1, 'busy', 'Dentist', $2, $3)`, [
      alice.id,
      daysFromNow(1),
      daysFromNow(1, 16),
    ]);
    await query(db, alice.id, `insert into public.availability_preferences (user_id, earliest_minute) values ($1, 600)`, [alice.id]);

    expect(await query(db, bob.id, `select * from public.availability_blocks where user_id = $1`, [alice.id])).toHaveLength(0);
    expect(await query(db, bob.id, `select * from public.availability_preferences where user_id = $1`, [alice.id])).toHaveLength(0);
    await expect(
      query(db, bob.id, `insert into public.availability_blocks (user_id, kind, starts_at, ends_at) values ($1, 'busy', now(), now() + interval '1 hour')`, [alice.id])
    ).rejects.toThrow(/row-level security/);
  });

  it('rejects an unknown time zone on a profile', async () => {
    const user = await db.createUser('tz');
    await query(db, user.id, `update public.profiles set timezone = 'America/Vancouver' where id = $1`, [user.id]);
    await expect(
      query(db, user.id, `update public.profiles set timezone = 'Mars/Olympus' where id = $1`, [user.id])
    ).rejects.toThrow(/Unknown time zone/);
  });
});

describe('space_availability()', () => {
  it('refuses non-members and over-long ranges', async () => {
    const { spaceId } = await spaceWith(db, 1, 'av_refuse');
    const outsider = await db.createUser('av_out');
    await expect(availability(outsider, spaceId)).rejects.toThrow(/not a member/);

    const { spaceId: other, owner } = await spaceWith(db, 0, 'av_long');
    await expect(availability(owner, other, 0, 70)).rejects.toThrow(/62 days/);
  });

  it('returns busy times without names at the default share level', async () => {
    const { spaceId, owner, members } = await spaceWith(db, 1, 'av_busy');
    const [member] = members;
    await addClass(member, 'Secret seminar', [1, 3], 600, 690);
    await query(db, member.id, `insert into public.availability_blocks (user_id, kind, label, starts_at, ends_at) values ($1, 'busy', 'Therapy', $2, $3)`, [
      member.id,
      daysFromNow(2, 15),
      daysFromNow(2, 16),
    ]);

    const rows = await availability(owner, spaceId);
    const seen = rows.find((r) => r.user_id === member.id)!;
    expect(seen.share_level).toBe('busy');
    expect(seen.has_schedule).toBe(true);
    expect(seen.classes).toEqual([
      { days: [1, 3], start_minute: 600, end_minute: 690, name: null, course_code: null, section: null },
    ]);
    expect(seen.blocks?.[0]).toMatchObject({ kind: 'busy', label: null });
  });

  it('adds names when the member shares details, and nothing at all when hidden', async () => {
    const { spaceId, owner, members } = await spaceWith(db, 2, 'av_levels');
    const [open, hidden] = members;
    await addClass(open, 'BIO 101', [2], 600, 650);
    await addClass(hidden, 'PSY 201', [2], 600, 650);
    await query(db, open.id, `update public.space_members set share_level = 'details' where space_id = $1 and user_id = $2`, [spaceId, open.id]);
    await query(db, hidden.id, `update public.space_members set share_level = 'hidden' where space_id = $1 and user_id = $2`, [spaceId, hidden.id]);

    const rows = await availability(owner, spaceId);
    expect(rows.find((r) => r.user_id === open.id)?.classes?.[0].name).toBe('BIO 101');
    expect(rows.find((r) => r.user_id === hidden.id)).toEqual({ user_id: hidden.id, share_level: 'hidden' });

    // A hidden member still sees their own data in their own search.
    const own = (await availability(hidden, spaceId)).find((r) => r.user_id === hidden.id)!;
    expect(own.classes?.[0].name).toBe('PSY 201');
  });

  it('counts a student with no classes only once they save preferences', async () => {
    const { spaceId, owner, members } = await spaceWith(db, 1, 'av_none');
    const [member] = members;
    expect((await availability(owner, spaceId)).find((r) => r.user_id === member.id)?.has_schedule).toBe(false);

    await query(db, member.id, `insert into public.availability_preferences (user_id) values ($1)`, [member.id]);
    expect((await availability(owner, spaceId)).find((r) => r.user_id === member.id)?.has_schedule).toBe(true);
  });

  it('shows another space’s events as anonymous busy time', async () => {
    const { spaceId: groupA, owner: a, members } = await spaceWith(db, 1, 'av_cross');
    const [shared] = members;
    // `shared` is also in a second space, with an event there.
    const groupB = await createSpace(db, shared, 'Secret club');
    const secretEvent = await createEvent(shared, groupB, { title: 'Surprise party planning' });
    const ownEvent = await createEvent(a, groupA, { title: 'Group A meeting', startsAt: daysFromNow(4, 18) });
    await query(db, shared.id, `update public.event_attendees set response = 'going' where event_id = $1 and user_id = $2`, [ownEvent, shared.id]);

    const seen = (await availability(a, groupA)).find((r) => r.user_id === shared.id)!;
    const titles = seen.events?.map((e) => e.title);
    expect(titles).toContain('Group A meeting');
    expect(titles).toContain(null);
    expect(JSON.stringify(seen)).not.toContain('Surprise');
    expect(JSON.stringify(seen)).not.toContain(secretEvent);
  });
});

describe('events', () => {
  it('invites every member by default, with the organizer going', async () => {
    const { spaceId, owner, members } = await spaceWith(db, 2, 'ev_all');
    const eventId = await createEvent(owner, spaceId);

    const attendees = await query<{ user_id: string; response: string }>(
      db, members[0].id, `select user_id, response from public.event_attendees where event_id = $1`, [eventId]
    );
    expect(attendees).toHaveLength(3);
    expect(attendees.find((a) => a.user_id === owner.id)?.response).toBe('going');
    expect(attendees.filter((a) => a.response === 'pending')).toHaveLength(2);

    const notes = await query<{ kind: string; title: string; link: string }>(
      db, members[0].id, `select kind, title, link from public.notifications`
    );
    expect(notes).toEqual([
      { kind: 'event_invite', title: 'New event: Study session', link: `/spaces/${spaceId}/events/${eventId}` },
    ]);
    expect(await query(db, owner.id, `select * from public.notifications where kind = 'event_invite'`)).toHaveLength(0);
  });

  it('can invite a subset, but only of members', async () => {
    const { spaceId, owner, members } = await spaceWith(db, 2, 'ev_sub');
    const outsider = await db.createUser('ev_sub_out');
    const eventId = await createEvent(owner, spaceId, { attendees: [members[0].id] });
    const attendees = await query<{ user_id: string }>(db, owner.id, `select user_id from public.event_attendees where event_id = $1`, [eventId]);
    expect(attendees.map((a) => a.user_id).sort()).toEqual([owner.id, members[0].id].sort());

    await expect(createEvent(owner, spaceId, { attendees: [outsider.id] })).rejects.toThrow(/member of this space/);
  });

  it('warns an invitee whose class overlaps, in their own time zone', async () => {
    const { spaceId, owner, members } = await spaceWith(db, 1, 'ev_conf');
    const [student] = members;
    await query(db, student.id, `update public.profiles set timezone = 'America/Vancouver' where id = $1`, [student.id]);

    // A Monday at least two days out, at 18:00 UTC: 11:00 in Vancouver in
    // summer (PDT) and 10:00 in winter (PST). Either way the 30 minutes land
    // inside the 10:00–11:30 class, whenever this test runs.
    const start = new Date(daysFromNow(2, 18));
    while (start.getUTCDay() !== 1) start.setUTCDate(start.getUTCDate() + 1);
    await addClass(student, 'CHEM 110', [1], 600, 690);

    await createEvent(owner, spaceId, { startsAt: start.toISOString(), minutes: 30, zone: 'America/Toronto' });
    const [note] = await query<{ body: string }>(db, student.id, `select body from public.notifications where kind = 'event_invite'`);
    expect(note.body).toContain('overlaps your CHEM 110');
  });

  it('rejects an unknown zone and a repeat that ends before it starts', async () => {
    const { spaceId, owner } = await spaceWith(db, 0, 'ev_bad');
    await expect(createEvent(owner, spaceId, { zone: 'Nowhere/Land' })).rejects.toThrow(/Unknown time zone/);
    await expect(createEvent(owner, spaceId, { startsAt: daysFromNow(5), repeatUntil: daysFromNow(1).slice(0, 10) })).rejects.toThrow(
      /repeat until/
    );
  });

  it('lets non-members neither see nor create events', async () => {
    const { spaceId, owner } = await spaceWith(db, 0, 'ev_iso');
    const outsider = await db.createUser('ev_iso_out');
    const eventId = await createEvent(owner, spaceId);

    expect(await query(db, outsider.id, `select * from public.space_events where id = $1`, [eventId])).toHaveLength(0);
    expect(await query(db, outsider.id, `select * from public.event_attendees where event_id = $1`, [eventId])).toHaveLength(0);
    await expect(createEvent(outsider, spaceId)).rejects.toThrow(/not a member/);
    await expect(
      query(db, outsider.id, `insert into public.event_attendees (event_id, user_id) values ($1, $2)`, [eventId, outsider.id])
    ).rejects.toThrow(/row-level security/);
  });

  it('lets the organizer and managers edit, but not other members', async () => {
    const { spaceId, owner, members } = await spaceWith(db, 2, 'ev_edit');
    const [organizer, bystander] = members;
    const eventId = await createEvent(organizer, spaceId, { title: 'Original' });

    await query(db, bystander.id, `update public.space_events set title = 'Hijacked' where id = $1`, [eventId]);
    expect((await db.admin<{ title: string }>(`select title from public.space_events where id = $1`, [eventId]))[0].title).toBe('Original');

    await query(db, organizer.id, `update public.space_events set title = 'Renamed' where id = $1`, [eventId]);
    await query(db, owner.id, `update public.space_events set location = 'Room 204' where id = $1`, [eventId]);
    const [row] = await db.admin<{ title: string; location: string }>(`select title, location from public.space_events where id = $1`, [eventId]);
    expect(row).toEqual({ title: 'Renamed', location: 'Room 204' });

    await expect(
      query(db, organizer.id, `update public.space_events set space_id = gen_random_uuid() where id = $1`, [eventId])
    ).rejects.toThrow(/permission denied/);
  });

  it('notifies once per event however many times it changes, and not for description edits', async () => {
    const { spaceId, owner, members } = await spaceWith(db, 1, 'ev_note');
    const [member] = members;
    const eventId = await createEvent(owner, spaceId);
    await query(db, member.id, `update public.notifications set read_at = now()`);

    await query(db, owner.id, `update public.space_events set description = 'Bring snacks' where id = $1`, [eventId]);
    expect(await query(db, member.id, `select * from public.notifications where kind = 'event_changed'`)).toHaveLength(0);

    await query(db, owner.id, `update public.space_events set starts_at = starts_at + interval '1 hour', ends_at = ends_at + interval '1 hour' where id = $1`, [eventId]);
    await query(db, owner.id, `update public.space_events set location = 'Café' where id = $1`, [eventId]);
    await query(db, owner.id, `update public.space_events set status = 'cancelled' where id = $1`, [eventId]);

    const changes = await query<{ title: string; read_at: string | null }>(
      db, member.id, `select title, read_at from public.notifications where kind = 'event_changed'`
    );
    expect(changes).toEqual([{ title: 'Cancelled: Study session', read_at: null }]);
  });

  it('skips attendees who declined when the event changes', async () => {
    const { spaceId, owner, members } = await spaceWith(db, 1, 'ev_decl');
    const [member] = members;
    const eventId = await createEvent(owner, spaceId);
    await query(db, member.id, `update public.event_attendees set response = 'declined', responded_at = now() where event_id = $1 and user_id = $2`, [eventId, member.id]);
    await query(db, owner.id, `update public.space_events set location = 'Elsewhere' where id = $1`, [eventId]);

    expect(await query(db, member.id, `select * from public.notifications where kind = 'event_changed'`)).toHaveLength(0);
  });

  it('lets an attendee answer only for themselves', async () => {
    const { spaceId, owner, members } = await spaceWith(db, 2, 'ev_rsvp');
    const [a, b] = members;
    const eventId = await createEvent(owner, spaceId);

    await query(db, a.id, `update public.event_attendees set response = 'going', responded_at = now() where event_id = $1 and user_id = $2`, [eventId, a.id]);
    await query(db, a.id, `update public.event_attendees set response = 'declined' where event_id = $1 and user_id = $2`, [eventId, b.id]);

    const rows = await db.admin<{ user_id: string; response: string }>(
      `select user_id, response from public.event_attendees where event_id = $1`,
      [eventId]
    );
    expect(rows.find((r) => r.user_id === a.id)?.response).toBe('going');
    expect(rows.find((r) => r.user_id === b.id)?.response).toBe('pending');
  });

  it('takes a member off every event in the space when they leave', async () => {
    const { spaceId, owner, members } = await spaceWith(db, 1, 'ev_leave');
    const [member] = members;
    const eventId = await createEvent(owner, spaceId);

    await query(db, member.id, `select public.leave_space($1)`, [spaceId]);
    const rows = await db.admin(`select * from public.event_attendees where event_id = $1 and user_id = $2`, [eventId, member.id]);
    expect(rows).toHaveLength(0);
  });

  it('tells attendees when an upcoming event is deleted', async () => {
    const { spaceId, owner, members } = await spaceWith(db, 1, 'ev_del');
    const [member] = members;
    const eventId = await createEvent(owner, spaceId, { title: 'Doomed meeting' });
    await query(db, owner.id, `delete from public.space_events where id = $1`, [eventId]);

    const notes = await query<{ title: string; link: string }>(
      db, member.id, `select title, link from public.notifications where kind = 'event_changed'`
    );
    expect(notes).toEqual([{ title: 'Cancelled: Doomed meeting', link: `/spaces/${spaceId}/calendar` }]);
  });
});
