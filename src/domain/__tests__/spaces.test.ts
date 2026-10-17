// src/domain/__tests__/spaces.test.ts
import { describe, it, expect } from 'vitest';
import {
  canInSpace,
  canRemoveMember,
  compareMembers,
  extractInviteCode,
  inviteLinkState,
  inviteStatusMessage,
  spaceKindLabel,
  SPACE_KINDS,
  validateSpaceDraft,
  type InviteStatus,
  type SpaceRole,
} from '../spaces';

const roles: SpaceRole[] = ['owner', 'admin', 'member'];

describe('canInSpace', () => {
  it('reserves deleting, role changes and ownership transfer for the owner', () => {
    for (const action of ['delete_space', 'change_roles', 'transfer_ownership'] as const) {
      expect(roles.filter((role) => canInSpace({ role, membersCanInvite: true }, action))).toEqual(['owner']);
    }
  });

  it('lets owners and admins edit settings, manage links and moderate content', () => {
    for (const action of ['edit_settings', 'manage_invites', 'moderate_content'] as const) {
      expect(roles.filter((role) => canInSpace({ role, membersCanInvite: true }, action))).toEqual([
        'owner',
        'admin',
      ]);
    }
  });

  it('lets plain members invite only when the space allows it', () => {
    expect(canInSpace({ role: 'member', membersCanInvite: false }, 'invite')).toBe(false);
    expect(canInSpace({ role: 'member', membersCanInvite: true }, 'invite')).toBe(true);
    expect(canInSpace({ role: 'admin', membersCanInvite: false }, 'invite')).toBe(true);
  });
});

describe('canRemoveMember', () => {
  const owner = { id: 'o', role: 'owner' as const };
  const admin = { id: 'a', role: 'admin' as const };
  const admin2 = { id: 'a2', role: 'admin' as const };
  const member = { id: 'm', role: 'member' as const };

  it('matches remove_space_member: owner removes anyone else, admin removes members only', () => {
    expect(canRemoveMember(owner, admin)).toBe(true);
    expect(canRemoveMember(owner, member)).toBe(true);
    expect(canRemoveMember(admin, member)).toBe(true);
    expect(canRemoveMember(admin, admin2)).toBe(false);
    expect(canRemoveMember(admin, owner)).toBe(false);
    expect(canRemoveMember(member, member)).toBe(false);
  });

  it('never offers removing yourself — that is leaving', () => {
    expect(canRemoveMember(owner, owner)).toBe(false);
    expect(canRemoveMember(admin, admin)).toBe(false);
  });
});

describe('compareMembers', () => {
  it('puts the owner first, then admins, then members by join date', () => {
    const list = [
      { id: 'late', role: 'member' as const, joinedAt: '2026-10-03T00:00:00Z' },
      { id: 'admin', role: 'admin' as const, joinedAt: '2026-10-05T00:00:00Z' },
      { id: 'early', role: 'member' as const, joinedAt: '2026-10-01T00:00:00Z' },
      { id: 'owner', role: 'owner' as const, joinedAt: '2026-10-09T00:00:00Z' },
    ];
    expect([...list].sort(compareMembers).map((m) => m.id)).toEqual(['owner', 'admin', 'early', 'late']);
  });
});

describe('inviteLinkState', () => {
  const now = Date.parse('2026-10-17T12:00:00Z');
  const base = { revokedAt: null, expiresAt: null, maxUses: null, useCount: 0 };

  it('reports a live link as active', () => {
    expect(inviteLinkState(base, now)).toBe('active');
    expect(inviteLinkState({ ...base, expiresAt: '2026-10-18T00:00:00Z', maxUses: 5, useCount: 4 }, now)).toBe('active');
  });

  it('checks revoked, then expired, then used up — the order the join RPC uses', () => {
    expect(
      inviteLinkState({ revokedAt: '2026-10-16T00:00:00Z', expiresAt: '2026-10-01T00:00:00Z', maxUses: 1, useCount: 1 }, now)
    ).toBe('revoked');
    expect(inviteLinkState({ ...base, expiresAt: '2026-10-17T12:00:00Z' }, now)).toBe('expired');
    expect(inviteLinkState({ ...base, maxUses: 3, useCount: 3 }, now)).toBe('used_up');
  });
});

describe('validateSpaceDraft', () => {
  const ok = { name: 'Psychology — Group 04', description: '', timezone: 'America/Toronto' };

  it('accepts a normal draft', () => {
    expect(validateSpaceDraft(ok)).toEqual({});
  });

  it('mirrors the database limits', () => {
    expect(validateSpaceDraft({ ...ok, name: '   ' }).name).toBeDefined();
    expect(validateSpaceDraft({ ...ok, name: 'x'.repeat(81) }).name).toMatch(/80/);
    expect(validateSpaceDraft({ ...ok, name: 'x'.repeat(80) }).name).toBeUndefined();
    expect(validateSpaceDraft({ ...ok, description: 'x'.repeat(501) }).description).toMatch(/500/);
    expect(validateSpaceDraft({ ...ok, timezone: 'Mars/Base' }).timezone).toBeDefined();
  });
});

describe('extractInviteCode', () => {
  const code = 'aB3_dE5-fG7hJ9kL1mN2pQ';

  it('accepts a bare code or a pasted link in any common shape', () => {
    expect(extractInviteCode(code)).toBe(code);
    expect(extractInviteCode(`  ${code}  `)).toBe(code);
    expect(extractInviteCode(`https://schedule.example/join/${code}`)).toBe(code);
    expect(extractInviteCode(`https://schedule.example/join/${code}/`)).toBe(code);
    expect(extractInviteCode(`/join/${code}?utm=x`)).toBe(code);
  });

  it('refuses things that are not a code', () => {
    expect(extractInviteCode('')).toBeNull();
    expect(extractInviteCode('hello')).toBeNull();
    expect(extractInviteCode('https://schedule.example/spaces')).toBeNull();
    expect(extractInviteCode('has spaces in it but is long enough')).toBeNull();
  });
});

describe('labels', () => {
  it('has a message for every preview status', () => {
    const statuses: InviteStatus[] = ['valid', 'member', 'revoked', 'expired', 'used_up', 'full', 'invalid'];
    for (const status of statuses) expect(inviteStatusMessage(status).length).toBeGreaterThan(10);
  });

  it('labels every kind the database accepts, and falls back for unknown ones', () => {
    // The kind list in 0016's spaces_kind check constraint.
    expect(SPACE_KINDS.map((k) => k.id).sort()).toEqual(
      ['class', 'club', 'friends', 'group', 'project', 'roommates', 'study', 'team'].sort()
    );
    expect(spaceKindLabel('project')).toBe('Group project');
    expect(spaceKindLabel('mystery')).toBe('Group');
  });
});
