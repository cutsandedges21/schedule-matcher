// supabase/tests/db/spaces.test.ts
//
// Migration 0016: membership, roles, invites and isolation between spaces.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, query, type TestDb } from './harness';
import { addMember as addMemberTo, createSpace as createSpaceIn, roleOf as roleIn } from './fixtures';
import { MAX_SPACE_MEMBERS } from '../../../src/domain/spaces';

let db: TestDb;

const createSpace = (owner: Parameters<typeof createSpaceIn>[1], name?: string) => createSpaceIn(db, owner, name);
const addMember = (spaceId: string, owner: Parameters<typeof addMemberTo>[2], member: Parameters<typeof addMemberTo>[3]) =>
  addMemberTo(db, spaceId, owner, member);
const roleOf = (spaceId: string, userId: string) => roleIn(db, spaceId, userId);

beforeAll(async () => {
  db = await createTestDb();
}, 120_000);

afterAll(async () => {
  await db?.close();
});

describe('creating a space', () => {
  it('makes the creator the one owner and logs it', async () => {
    const owner = await db.createUser('owner');
    const spaceId = await createSpace(owner);

    expect(await roleOf(spaceId, owner.id)).toBe('owner');
    const activity = await query<{ verb: string }>(
      db,
      owner.id,
      `select verb from public.space_activity where space_id = $1`,
      [spaceId]
    );
    expect(activity.map((a) => a.verb)).toEqual(['space.created']);
  });

  it('refuses a direct insert, so a space cannot exist without an owner', async () => {
    const user = await db.createUser('sneaky');
    await expect(
      query(db, user.id, `insert into public.spaces (name) values ('No owner')`)
    ).rejects.toThrow();
  });

  it('refuses anonymous callers', async () => {
    await expect(query(db, null, `select public.create_space('Anon space')`)).rejects.toThrow();
  });

  it('rejects a blank name and an unknown kind', async () => {
    const user = await db.createUser('validator');
    await expect(query(db, user.id, `select public.create_space('   ')`)).rejects.toThrow(/spaces_name_length/);
    await expect(
      query(db, user.id, `select public.create_space('Fine', 'cult')`)
    ).rejects.toThrow(/spaces_kind/);
  });
});

describe('isolation between spaces', () => {
  it('hides a space, its members and its history from non-members', async () => {
    const owner = await db.createUser('iso_own');
    const outsider = await db.createUser('iso_out');
    const spaceId = await createSpace(owner, 'Secret project');

    const spaces = await query(db, outsider.id, `select id from public.spaces where id = $1`, [spaceId]);
    const members = await query(db, outsider.id, `select * from public.space_members where space_id = $1`, [spaceId]);
    const activity = await query(db, outsider.id, `select * from public.space_activity where space_id = $1`, [spaceId]);

    expect(spaces).toHaveLength(0);
    expect(members).toHaveLength(0);
    expect(activity).toHaveLength(0);
  });

  it('does not let a member of one space read another space they are not in', async () => {
    const a = await db.createUser('iso_a');
    const b = await db.createUser('iso_b');
    const spaceA = await createSpace(a, 'Space A');
    const spaceB = await createSpace(b, 'Space B');

    const fromA = await query<{ id: string }>(db, a.id, `select id from public.spaces`);
    expect(fromA.map((s) => s.id)).toContain(spaceA);
    expect(fromA.map((s) => s.id)).not.toContain(spaceB);
  });

  it('lists only the caller’s own spaces in my_spaces(), with a head count', async () => {
    const owner = await db.createUser('list_own');
    const member = await db.createUser('list_mem');
    const spaceId = await createSpace(owner, 'Counted');
    await addMember(spaceId, owner, member);

    const mine = await query<{ id: string; member_count: number; role: string }>(
      db,
      member.id,
      `select id, member_count, role from public.my_spaces()`
    );
    expect(mine).toEqual([{ id: spaceId, member_count: 2, role: 'member' }]);
  });
});

describe('invite links', () => {
  it('lets a member join with a live link, once, without spending a second use', async () => {
    const owner = await db.createUser('link_own');
    const joiner = await db.createUser('link_join');
    const spaceId = await createSpace(owner);

    const [invite] = await query<{ id: string; code: string }>(
      db,
      owner.id,
      `select id, code from public.create_space_invite($1, 24, 5)`,
      [spaceId]
    );
    expect(invite.code).toMatch(/^[A-Za-z0-9_-]{22}$/);

    await query(db, joiner.id, `select public.join_space_with_code($1)`, [invite.code]);
    await query(db, joiner.id, `select public.join_space_with_code($1)`, [invite.code]);

    expect(await roleOf(spaceId, joiner.id)).toBe('member');
    const [{ use_count }] = await db.admin<{ use_count: number }>(
      `select use_count from public.space_invites where id = $1`,
      [invite.id]
    );
    expect(use_count).toBe(1);
  });

  it('stops working once revoked, expired or used up', async () => {
    const owner = await db.createUser('dead_own');
    const spaceId = await createSpace(owner);

    const [revoked] = await query<{ id: string; code: string }>(
      db, owner.id, `select id, code from public.create_space_invite($1, 24, null)`, [spaceId]
    );
    await query(db, owner.id, `select public.revoke_space_invite($1)`, [revoked.id]);

    const [expired] = await query<{ id: string; code: string }>(
      db, owner.id, `select id, code from public.create_space_invite($1, 24, null)`, [spaceId]
    );
    await db.admin(`update public.space_invites set expires_at = now() - interval '1 minute' where id = $1`, [expired.id]);

    const [single] = await query<{ code: string }>(
      db, owner.id, `select code from public.create_space_invite($1, 24, 1)`, [spaceId]
    );
    const first = await db.createUser('dead_first');
    await query(db, first.id, `select public.join_space_with_code($1)`, [single.code]);

    const late = await db.createUser('dead_late');
    await expect(query(db, late.id, `select public.join_space_with_code($1)`, [revoked.code])).rejects.toThrow(/turned off/);
    await expect(query(db, late.id, `select public.join_space_with_code($1)`, [expired.code])).rejects.toThrow(/expired/);
    await expect(query(db, late.id, `select public.join_space_with_code($1)`, [single.code])).rejects.toThrow(/used up/);
    await expect(query(db, late.id, `select public.join_space_with_code('not-a-real-code')`)).rejects.toThrow(/not valid/);
    expect(await roleOf(spaceId, late.id)).toBeNull();
  });

  it('previews a live link with the space name, and a dead one without it', async () => {
    const owner = await db.createUser('prev_own');
    const visitor = await db.createUser('prev_vis');
    const spaceId = await createSpace(owner, 'Biology study group');

    const [invite] = await query<{ id: string; code: string }>(
      db, owner.id, `select id, code from public.create_space_invite($1, 24, null)`, [spaceId]
    );
    const [live] = await query<{ p: Record<string, unknown> }>(
      db, visitor.id, `select public.preview_space_invite($1) as p`, [invite.code]
    );
    expect(live.p).toMatchObject({ status: 'valid', name: 'Biology study group', member_count: 1 });

    await query(db, owner.id, `select public.revoke_space_invite($1)`, [invite.id]);
    const [dead] = await query<{ p: Record<string, unknown> }>(
      db, visitor.id, `select public.preview_space_invite($1) as p`, [invite.code]
    );
    expect(dead.p).toEqual({ status: 'revoked' });
  });

  it('only lets plain members create links when the space allows it', async () => {
    const owner = await db.createUser('perm_own');
    const member = await db.createUser('perm_mem');
    const spaceId = await createSpace(owner);
    await addMember(spaceId, owner, member);

    await expect(
      query(db, member.id, `select public.create_space_invite($1, 24, null)`, [spaceId])
    ).rejects.toThrow(/Only the owner and admins/);

    await query(db, owner.id, `update public.spaces set members_can_invite = true where id = $1`, [spaceId]);
    const rows = await query(db, member.id, `select code from public.create_space_invite($1, 24, null)`, [spaceId]);
    expect(rows).toHaveLength(1);
  });

  it('hides links from plain members who did not make them', async () => {
    const owner = await db.createUser('hide_own');
    const member = await db.createUser('hide_mem');
    const spaceId = await createSpace(owner);
    await addMember(spaceId, owner, member);

    const visible = await query(db, member.id, `select code from public.space_invites where space_id = $1`, [spaceId]);
    expect(visible).toHaveLength(0);
  });

  it(`refuses the member after the ${MAX_SPACE_MEMBERS}th`, async () => {
    const owner = await db.createUser('full_own');
    const spaceId = await createSpace(owner, 'Big lecture');
    const [invite] = await query<{ code: string }>(
      db, owner.id, `select code from public.create_space_invite($1, 24, null)`, [spaceId]
    );

    for (let i = 1; i < MAX_SPACE_MEMBERS; i += 1) {
      const student = await db.createUser('full');
      await query(db, student.id, `select public.join_space_with_code($1)`, [invite.code]);
    }

    const [{ count }] = await db.admin<{ count: number }>(
      `select count(*)::int as count from public.space_members where space_id = $1`,
      [spaceId]
    );
    expect(count).toBe(MAX_SPACE_MEMBERS);

    const oneTooMany = await db.createUser('full_late');
    await expect(
      query(db, oneTooMany.id, `select public.join_space_with_code($1)`, [invite.code])
    ).rejects.toThrow(/full/);
  }, 60_000);
});

describe('direct invitations', () => {
  it('notifies the invitee, shows them the space, and adds them on accept', async () => {
    const owner = await db.createUser('dir_own');
    const invitee = await db.createUser('dir_inv');
    const spaceId = await createSpace(owner, 'Music club');

    await query(db, owner.id, `select public.invite_to_space($1, $2)`, [spaceId, invitee.username]);

    const pending = await query<{ id: string; space_name: string; invited_by_username: string }>(
      db, invitee.id, `select id, space_name, invited_by_username from public.my_space_invitations()`
    );
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ space_name: 'Music club', invited_by_username: owner.username });

    const notes = await query<{ kind: string; read_at: string | null }>(
      db, invitee.id, `select kind, read_at from public.notifications`
    );
    expect(notes).toEqual([{ kind: 'space_invite', read_at: null }]);

    await query(db, invitee.id, `select public.accept_space_invitation($1)`, [pending[0].id]);
    expect(await roleOf(spaceId, invitee.id)).toBe('member');

    const after = await query<{ read_at: string | null }>(db, invitee.id, `select read_at from public.notifications`);
    expect(after[0].read_at).not.toBeNull();
    expect(await query(db, invitee.id, `select * from public.my_space_invitations()`)).toHaveLength(0);
  });

  it('lets the invitee decline by deleting, and nobody else accept for them', async () => {
    const owner = await db.createUser('dec_own');
    const invitee = await db.createUser('dec_inv');
    const thief = await db.createUser('dec_thief');
    const spaceId = await createSpace(owner);

    const [{ id }] = await query<{ id: string }>(
      db, owner.id, `select public.invite_to_space($1, $2) as id`, [spaceId, invitee.username]
    );

    await expect(
      query(db, thief.id, `select public.accept_space_invitation($1)`, [id])
    ).rejects.toThrow(/no longer open/);

    await query(db, invitee.id, `delete from public.space_invitations where id = $1`, [id]);
    expect(await db.admin(`select * from public.space_invitations where id = $1`, [id])).toHaveLength(0);
    expect(await roleOf(spaceId, invitee.id)).toBeNull();
  });

  it('refuses an unknown username and an existing member', async () => {
    const owner = await db.createUser('bad_own');
    const member = await db.createUser('bad_mem');
    const spaceId = await createSpace(owner);
    await addMember(spaceId, owner, member);

    await expect(
      query(db, owner.id, `select public.invite_to_space($1, 'nobody_here_xyz')`, [spaceId])
    ).rejects.toThrow(/No student/);
    await expect(
      query(db, owner.id, `select public.invite_to_space($1, $2)`, [spaceId, member.username])
    ).rejects.toThrow(/already a member/);
  });
});

describe('roles and removal', () => {
  it('lets only the owner change roles', async () => {
    const owner = await db.createUser('role_own');
    const admin = await db.createUser('role_adm');
    const member = await db.createUser('role_mem');
    const spaceId = await createSpace(owner);
    await addMember(spaceId, owner, admin);
    await addMember(spaceId, owner, member);

    await query(db, owner.id, `select public.set_member_role($1, $2, 'admin')`, [spaceId, admin.id]);
    expect(await roleOf(spaceId, admin.id)).toBe('admin');

    await expect(
      query(db, admin.id, `select public.set_member_role($1, $2, 'admin')`, [spaceId, member.id])
    ).rejects.toThrow(/Only the owner/);
    await expect(
      query(db, owner.id, `select public.set_member_role($1, $2, 'owner')`, [spaceId, member.id])
    ).rejects.toThrow(/Transfer ownership/);
  });

  it('refuses a member promoting themselves by writing the row directly', async () => {
    const owner = await db.createUser('self_own');
    const member = await db.createUser('self_mem');
    const spaceId = await createSpace(owner);
    await addMember(spaceId, owner, member);

    await expect(
      query(db, member.id, `update public.space_members set role = 'owner' where space_id = $1 and user_id = $2`, [
        spaceId,
        member.id,
      ])
    ).rejects.toThrow(/permission denied/);

    // Their own share level and pin are theirs to change.
    await query(db, member.id, `update public.space_members set share_level = 'details', pinned = true where space_id = $1 and user_id = $2`, [
      spaceId,
      member.id,
    ]);
    const [row] = await db.admin<{ share_level: string; pinned: boolean; role: string }>(
      `select share_level, pinned, role from public.space_members where space_id = $1 and user_id = $2`,
      [spaceId, member.id]
    );
    expect(row).toEqual({ share_level: 'details', pinned: true, role: 'member' });
  });

  it('cannot change another member’s share level', async () => {
    const owner = await db.createUser('share_own');
    const member = await db.createUser('share_mem');
    const spaceId = await createSpace(owner);
    await addMember(spaceId, owner, member);

    await query(db, owner.id, `update public.space_members set share_level = 'details' where space_id = $1 and user_id = $2`, [
      spaceId,
      member.id,
    ]);
    const [row] = await db.admin<{ share_level: string }>(
      `select share_level from public.space_members where space_id = $1 and user_id = $2`,
      [spaceId, member.id]
    );
    expect(row.share_level).toBe('busy');
  });

  it('lets an admin remove members but not other admins or the owner', async () => {
    const owner = await db.createUser('rm_own');
    const admin = await db.createUser('rm_adm');
    const admin2 = await db.createUser('rm_adm2');
    const member = await db.createUser('rm_mem');
    const spaceId = await createSpace(owner);
    for (const user of [admin, admin2, member]) await addMember(spaceId, owner, user);
    await query(db, owner.id, `select public.set_member_role($1, $2, 'admin')`, [spaceId, admin.id]);
    await query(db, owner.id, `select public.set_member_role($1, $2, 'admin')`, [spaceId, admin2.id]);

    await expect(
      query(db, admin.id, `select public.remove_space_member($1, $2)`, [spaceId, admin2.id])
    ).rejects.toThrow(/Only the owner can remove an admin/);
    await expect(
      query(db, admin.id, `select public.remove_space_member($1, $2)`, [spaceId, owner.id])
    ).rejects.toThrow(/Only the owner can remove an admin/);

    await query(db, admin.id, `select public.remove_space_member($1, $2)`, [spaceId, member.id]);
    expect(await roleOf(spaceId, member.id)).toBeNull();

    // The removed student is told, and the notice survives losing access.
    const notes = await query<{ kind: string; space_id: string | null }>(
      db, member.id, `select kind, space_id from public.notifications`
    );
    expect(notes).toEqual([{ kind: 'space_update', space_id: null }]);
  });

  it('does not let a plain member remove anyone', async () => {
    const owner = await db.createUser('pm_own');
    const a = await db.createUser('pm_a');
    const b = await db.createUser('pm_b');
    const spaceId = await createSpace(owner);
    await addMember(spaceId, owner, a);
    await addMember(spaceId, owner, b);

    await expect(
      query(db, a.id, `select public.remove_space_member($1, $2)`, [spaceId, b.id])
    ).rejects.toThrow(/Only the owner and admins/);
  });
});

describe('ownership', () => {
  it('transfers ownership, leaving the old owner an admin', async () => {
    const owner = await db.createUser('xfer_own');
    const heir = await db.createUser('xfer_heir');
    const spaceId = await createSpace(owner);
    await addMember(spaceId, owner, heir);

    await query(db, owner.id, `select public.transfer_space_ownership($1, $2)`, [spaceId, heir.id]);
    expect(await roleOf(spaceId, heir.id)).toBe('owner');
    expect(await roleOf(spaceId, owner.id)).toBe('admin');
  });

  it('will not let the owner leave while others remain', async () => {
    const owner = await db.createUser('stay_own');
    const member = await db.createUser('stay_mem');
    const spaceId = await createSpace(owner);
    await addMember(spaceId, owner, member);

    await expect(query(db, owner.id, `select public.leave_space($1)`, [spaceId])).rejects.toThrow(/Hand ownership/);
    await query(db, member.id, `select public.leave_space($1)`, [spaceId]);
    expect(await roleOf(spaceId, member.id)).toBeNull();
  });

  it('deletes the space when the last member leaves', async () => {
    const owner = await db.createUser('last_own');
    const spaceId = await createSpace(owner);

    await query(db, owner.id, `select public.leave_space($1)`, [spaceId]);
    expect(await db.admin(`select * from public.spaces where id = $1`, [spaceId])).toHaveLength(0);
  });

  it('hands the space to the longest-standing admin when the owner’s account is deleted', async () => {
    const owner = await db.createUser('gone_own');
    const early = await db.createUser('gone_early');
    const admin = await db.createUser('gone_adm');
    const spaceId = await createSpace(owner);
    await addMember(spaceId, owner, early);
    await addMember(spaceId, owner, admin);
    await query(db, owner.id, `select public.set_member_role($1, $2, 'admin')`, [spaceId, admin.id]);

    await db.admin(`delete from auth.users where id = $1`, [owner.id]);

    expect(await roleOf(spaceId, admin.id)).toBe('owner');
    expect(await roleOf(spaceId, early.id)).toBe('member');
  });

  it('removes the space with its only member’s account', async () => {
    const owner = await db.createUser('solo_own');
    const spaceId = await createSpace(owner);

    await db.admin(`delete from auth.users where id = $1`, [owner.id]);
    expect(await db.admin(`select * from public.spaces where id = $1`, [spaceId])).toHaveLength(0);
  });

  it('lets only the owner delete the space, and tells everyone else', async () => {
    const owner = await db.createUser('del_own');
    const admin = await db.createUser('del_adm');
    const spaceId = await createSpace(owner, 'Doomed');
    await addMember(spaceId, owner, admin);
    await query(db, owner.id, `select public.set_member_role($1, $2, 'admin')`, [spaceId, admin.id]);

    // RLS turns a disallowed delete into a no-op rather than an error.
    await query(db, admin.id, `delete from public.spaces where id = $1`, [spaceId]);
    expect(await db.admin(`select * from public.spaces where id = $1`, [spaceId])).toHaveLength(1);

    await query(db, owner.id, `delete from public.spaces where id = $1`, [spaceId]);
    expect(await db.admin(`select * from public.spaces where id = $1`, [spaceId])).toHaveLength(0);

    const notes = await query<{ title: string }>(db, admin.id, `select title from public.notifications where kind = 'space_update' and space_id is null`);
    expect(notes.map((n) => n.title)).toContain('"Doomed" was deleted');
  });
});

describe('notifications', () => {
  it('lets a student mark their own read and nothing else', async () => {
    const owner = await db.createUser('note_own');
    const invitee = await db.createUser('note_inv');
    const spaceId = await createSpace(owner);
    await query(db, owner.id, `select public.invite_to_space($1, $2)`, [spaceId, invitee.username]);

    // Somebody else's inbox is invisible and unwritable.
    expect(await query(db, owner.id, `select * from public.notifications where user_id = $1`, [invitee.id])).toHaveLength(0);
    await query(db, owner.id, `update public.notifications set read_at = now() where user_id = $1`, [invitee.id]);
    const [untouched] = await db.admin<{ read_at: string | null }>(
      `select read_at from public.notifications where user_id = $1`,
      [invitee.id]
    );
    expect(untouched.read_at).toBeNull();

    // Only read/dismiss are writable, even on your own rows.
    await expect(
      query(db, invitee.id, `update public.notifications set title = 'forged' where user_id = $1`, [invitee.id])
    ).rejects.toThrow(/permission denied/);
    await expect(
      query(db, invitee.id, `insert into public.notifications (user_id, kind, title) values ($1, 'space_update', 'x')`, [invitee.id])
    ).rejects.toThrow();
  });

  it('respects a category switched off', async () => {
    const owner = await db.createUser('pref_own');
    const invitee = await db.createUser('pref_inv');
    const spaceId = await createSpace(owner);

    await query(db, invitee.id, `insert into public.notification_preferences (user_id, invites) values ($1, false)`, [invitee.id]);
    await query(db, owner.id, `select public.invite_to_space($1, $2)`, [spaceId, invitee.username]);

    expect(await query(db, invitee.id, `select * from public.notifications`)).toHaveLength(0);
    // The invitation itself still exists; only the notice was suppressed.
    expect(await query(db, invitee.id, `select * from public.my_space_invitations()`)).toHaveLength(1);
  });

  it('refreshes one row instead of stacking duplicates for a repeated invite', async () => {
    const owner = await db.createUser('dup_own');
    const invitee = await db.createUser('dup_inv');
    const spaceId = await createSpace(owner);

    await query(db, owner.id, `select public.invite_to_space($1, $2)`, [spaceId, invitee.username]);
    await query(db, invitee.id, `update public.notifications set read_at = now()`);
    await query(db, owner.id, `select public.invite_to_space($1, $2)`, [spaceId, invitee.username]);

    const rows = await query<{ read_at: string | null }>(db, invitee.id, `select read_at from public.notifications`);
    expect(rows).toHaveLength(1);
    expect(rows[0].read_at).toBeNull();
  });
});
