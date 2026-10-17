// src/domain/spaces.ts
//
// Roles, permissions and limits for Spaces (migration 0016).
//
// The database is the authority on every rule here: each RPC re-checks the
// caller's role and RLS gates every read. This module exists so the UI only
// offers actions that will succeed — it hides a button, it never grants a
// permission. If the two ever disagree the server wins and the student sees
// its error message, which is the safe direction for a mismatch to fail in.
import { isValidTimeZone } from './zonedTime';

export type SpaceRole = 'owner' | 'admin' | 'member';
export type ShareLevel = 'hidden' | 'busy' | 'details';
export type SpaceKind =
  | 'class'
  | 'project'
  | 'study'
  | 'club'
  | 'friends'
  | 'roommates'
  | 'team'
  | 'group';

/**
 * An abuse bound, not a price point (design doc §2). Duplicated in
 * private.add_space_member() and preview_space_invite(); the DB tests fill a
 * space to exactly this size and assert the next join is refused, so the two
 * cannot drift apart unnoticed.
 */
export const MAX_SPACE_MEMBERS = 50;
export const MAX_SPACES_PER_STUDENT = 100;
export const SPACE_NAME_MAX = 80;
export const SPACE_DESCRIPTION_MAX = 500;
export const DEFAULT_SPACE_TIMEZONE = 'America/Toronto';

export interface SpaceKindInfo {
  id: SpaceKind;
  label: string;
  /** One line under the picker, so the choice reads as a use, not a taxonomy. */
  hint: string;
}

export const SPACE_KINDS: readonly SpaceKindInfo[] = [
  { id: 'class', label: 'Class', hint: 'Everyone in one course or section' },
  { id: 'project', label: 'Group project', hint: 'A team with a deliverable and a deadline' },
  { id: 'study', label: 'Study group', hint: 'Regular sessions before exams' },
  { id: 'club', label: 'Club', hint: 'Meetings, events and a member list' },
  { id: 'friends', label: 'Friends', hint: 'Plans with the people you see anyway' },
  { id: 'roommates', label: 'Roommates', hint: 'Chores, bills and house plans' },
  { id: 'team', label: 'Team', hint: 'Practices, games and travel' },
  { id: 'group', label: 'Other', hint: 'Anything else' },
];

export function spaceKindLabel(kind: string): string {
  return SPACE_KINDS.find((k) => k.id === kind)?.label ?? 'Group';
}

export const ROLE_LABELS: Record<SpaceRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
};

export const SHARE_LEVELS: readonly { id: ShareLevel; label: string; description: string }[] = [
  {
    id: 'busy',
    label: 'Free/busy only',
    description: 'Members see when you are busy, never what you are doing.',
  },
  {
    id: 'details',
    label: 'Full details',
    description: 'Members also see your class names, which shows shared classes.',
  },
  {
    id: 'hidden',
    label: 'Hidden',
    description: 'You are left out of availability matching in this space.',
  },
];

export type SpaceAction =
  | 'edit_settings'
  | 'delete_space'
  | 'invite'
  | 'manage_invites'
  | 'change_roles'
  | 'transfer_ownership'
  | 'moderate_content';

interface SpaceContext {
  role: SpaceRole;
  membersCanInvite: boolean;
}

/**
 * Mirrors the checks in 0016's RPCs and policies:
 *
 *   edit_settings       spaces_update policy: owner or admin
 *   delete_space        spaces_delete policy: owner
 *   invite              create_space_invite / invite_to_space: owner, admin,
 *                       or any member when the space allows member invites
 *   manage_invites      revoking other people's links: owner or admin
 *   change_roles        set_member_role: owner
 *   transfer_ownership  transfer_space_ownership: owner
 *   moderate_content    editing or removing anyone's event, task, poll or
 *                       resource: owner or admin
 */
export function canInSpace(ctx: SpaceContext, action: SpaceAction): boolean {
  const manager = ctx.role === 'owner' || ctx.role === 'admin';
  switch (action) {
    case 'edit_settings':
    case 'manage_invites':
    case 'moderate_content':
      return manager;
    case 'delete_space':
    case 'change_roles':
    case 'transfer_ownership':
      return ctx.role === 'owner';
    case 'invite':
      return manager || ctx.membersCanInvite;
  }
}

/**
 * remove_space_member: the owner removes anyone but themselves; an admin
 * removes plain members only; nobody removes themselves (that is leaving).
 */
export function canRemoveMember(
  actor: { id: string; role: SpaceRole },
  target: { id: string; role: SpaceRole }
): boolean {
  if (actor.id === target.id) return false;
  if (actor.role === 'owner') return true;
  return actor.role === 'admin' && target.role === 'member';
}

/** Owner first, then admins, then members; ties broken by who joined first. */
export function compareMembers(
  a: { role: SpaceRole; joinedAt: string },
  b: { role: SpaceRole; joinedAt: string }
): number {
  const rank: Record<SpaceRole, number> = { owner: 0, admin: 1, member: 2 };
  return rank[a.role] - rank[b.role] || a.joinedAt.localeCompare(b.joinedAt);
}

export interface SpaceDraftFields {
  name: string;
  description: string;
  timezone: string;
}

export type SpaceDraftErrors = Partial<Record<keyof SpaceDraftFields, string>>;

/**
 * The same limits as 0016's check constraints, checked before the request so
 * a student sees "at most 80 characters" next to the field instead of a
 * constraint name from the server.
 */
export function validateSpaceDraft(draft: SpaceDraftFields): SpaceDraftErrors {
  const errors: SpaceDraftErrors = {};
  const name = draft.name.trim();
  if (name.length === 0) errors.name = 'Give the space a name.';
  else if (name.length > SPACE_NAME_MAX) errors.name = `At most ${SPACE_NAME_MAX} characters.`;
  if (draft.description.trim().length > SPACE_DESCRIPTION_MAX) {
    errors.description = `At most ${SPACE_DESCRIPTION_MAX} characters.`;
  }
  if (!isValidTimeZone(draft.timezone)) errors.timezone = 'Pick a time zone from the list.';
  return errors;
}

export type InviteStatus = 'valid' | 'member' | 'revoked' | 'expired' | 'used_up' | 'full' | 'invalid';

/** What preview_space_invite's status means to a student holding the link. */
export function inviteStatusMessage(status: InviteStatus): string {
  switch (status) {
    case 'valid':
      return 'You have been invited to join.';
    case 'member':
      return 'You are already a member of this space.';
    case 'revoked':
      return 'This invite link was turned off by the space.';
    case 'expired':
      return 'This invite link has expired. Ask for a new one.';
    case 'used_up':
      return 'This invite link has been used the maximum number of times.';
    case 'full':
      return `This space is full (${MAX_SPACE_MEMBERS} members).`;
    case 'invalid':
      return 'This invite link is not valid. Check that it was copied in full.';
  }
}

/**
 * Invite codes are 22 base64url characters (private.random_token in 0016).
 * Accepts the code alone or anything containing `/join/<code>` — a pasted
 * link, with or without the origin, a trailing slash or a query string.
 */
export function extractInviteCode(input: string): string | null {
  const trimmed = input.trim();
  const fromLink = /\/join\/([A-Za-z0-9_-]{16,64})(?:[/?#]|$)/.exec(trimmed);
  if (fromLink) return fromLink[1];
  return /^[A-Za-z0-9_-]{16,64}$/.test(trimmed) ? trimmed : null;
}

export interface InviteLinkState {
  revokedAt: string | null;
  expiresAt: string | null;
  maxUses: number | null;
  useCount: number;
}

/** The same order of checks join_space_with_code() applies. */
export function inviteLinkState(
  invite: InviteLinkState,
  nowMs: number
): 'active' | 'revoked' | 'expired' | 'used_up' {
  if (invite.revokedAt) return 'revoked';
  if (invite.expiresAt && Date.parse(invite.expiresAt) <= nowMs) return 'expired';
  if (invite.maxUses !== null && invite.useCount >= invite.maxUses) return 'used_up';
  return 'active';
}
