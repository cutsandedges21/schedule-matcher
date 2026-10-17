// src/features/spaces/api.ts
//
// Every Supabase call for Spaces and membership (migration 0016). Each one
// either returns mapped data or throws an Error whose message a student can
// read — see lib/supabaseErrors.ts for which server messages pass through.
//
// Direct UPDATE/DELETE calls chain `.select()`: RLS turns a write the caller
// may not make into "0 rows affected", not an error, so without reading the
// row back a refused change would look exactly like a successful one.
import { supabase } from '@/lib/supabase';
import { throwIfError } from '@/lib/supabaseErrors';
import { PROFILE_COLUMNS } from '@/domain/mappers';
import {
  ACTIVITY_COLUMNS,
  SPACE_COLUMNS,
  SPACE_INVITE_COLUMNS,
  rowToActivity,
  rowToMyInvitation,
  rowToMySpace,
  rowToPendingInvitee,
  rowToSpace,
  rowToSpaceInvite,
  rowToSpaceMember,
  type ActivityItem,
  type ActivityRow,
  type MyInvitation,
  type MyInvitationRow,
  type MySpace,
  type MySpaceRow,
  type PendingInvitee,
  type PendingInviteeRow,
  type Space,
  type SpaceInvite,
  type SpaceInviteRow,
  type SpaceMember,
  type SpaceMemberRow,
  type SpaceRow,
} from '@/domain/spaceMappers';
import type { InviteStatus, ShareLevel, SpaceKind } from '@/domain/spaces';

export async function listMySpaces(): Promise<MySpace[]> {
  const { data, error } = await supabase.rpc('my_spaces');
  throwIfError(error, 'Could not load your spaces.');
  return ((data ?? []) as MySpaceRow[]).map(rowToMySpace);
}

/** Null when the space does not exist *or* the caller is not in it — RLS cannot tell those apart, and neither should the UI. */
export async function getSpace(spaceId: string): Promise<Space | null> {
  const { data, error } = await supabase.from('spaces').select(SPACE_COLUMNS).eq('id', spaceId).maybeSingle();
  throwIfError(error, 'Could not load this space.');
  return data ? rowToSpace(data as SpaceRow) : null;
}

export async function listSpaceMembers(spaceId: string): Promise<SpaceMember[]> {
  const { data, error } = await supabase
    .from('space_members')
    .select(`user_id, role, share_level, pinned, joined_at, profile:profiles(${PROFILE_COLUMNS})`)
    .eq('space_id', spaceId);
  throwIfError(error, 'Could not load the members of this space.');
  return ((data ?? []) as unknown as SpaceMemberRow[]).map(rowToSpaceMember);
}

export interface SpaceDraft {
  name: string;
  kind: SpaceKind;
  description: string;
  timezone: string;
}

export async function createSpace(draft: SpaceDraft): Promise<string> {
  const { data, error } = await supabase.rpc('create_space', {
    p_name: draft.name,
    p_kind: draft.kind,
    p_description: draft.description,
    p_timezone: draft.timezone,
  });
  throwIfError(error, 'Could not create the space.');
  return data as string;
}

export async function updateSpace(
  spaceId: string,
  patch: Partial<SpaceDraft & { membersCanInvite: boolean }>
): Promise<Space> {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.kind !== undefined) row.kind = patch.kind;
  if (patch.description !== undefined) row.description = patch.description.trim() || null;
  if (patch.timezone !== undefined) row.timezone = patch.timezone;
  if (patch.membersCanInvite !== undefined) row.members_can_invite = patch.membersCanInvite;

  const { data, error } = await supabase.from('spaces').update(row).eq('id', spaceId).select(SPACE_COLUMNS);
  throwIfError(error, 'Could not save the space settings.');
  if (!data || data.length === 0) throw new Error('Only the owner and admins can change these settings.');
  return rowToSpace(data[0] as SpaceRow);
}

export async function deleteSpace(spaceId: string): Promise<void> {
  const { data, error } = await supabase.from('spaces').delete().eq('id', spaceId).select('id');
  throwIfError(error, 'Could not delete the space.');
  if (!data || data.length === 0) throw new Error('Only the owner can delete this space.');
}

export async function updateMyMembership(
  spaceId: string,
  userId: string,
  patch: { shareLevel?: ShareLevel; pinned?: boolean }
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.shareLevel !== undefined) row.share_level = patch.shareLevel;
  if (patch.pinned !== undefined) row.pinned = patch.pinned;

  const { data, error } = await supabase
    .from('space_members')
    .update(row)
    .eq('space_id', spaceId)
    .eq('user_id', userId)
    .select('user_id');
  throwIfError(error, 'Could not save that change.');
  if (!data || data.length === 0) throw new Error('You are no longer a member of this space.');
}

// ---------------------------------------------------------------------------
// Invite links
// ---------------------------------------------------------------------------

export async function listSpaceInvites(spaceId: string): Promise<SpaceInvite[]> {
  const { data, error } = await supabase
    .from('space_invites')
    .select(SPACE_INVITE_COLUMNS)
    .eq('space_id', spaceId)
    .order('created_at', { ascending: false });
  throwIfError(error, 'Could not load invite links.');
  return ((data ?? []) as SpaceInviteRow[]).map(rowToSpaceInvite);
}

export async function createSpaceInvite(
  spaceId: string,
  options: { expiresInHours: number | null; maxUses: number | null }
): Promise<SpaceInvite> {
  const { data, error } = await supabase.rpc('create_space_invite', {
    p_space_id: spaceId,
    p_expires_in_hours: options.expiresInHours,
    p_max_uses: options.maxUses,
  });
  throwIfError(error, 'Could not create an invite link.');
  return rowToSpaceInvite(data as SpaceInviteRow);
}

export async function revokeSpaceInvite(inviteId: string): Promise<void> {
  const { error } = await supabase.rpc('revoke_space_invite', { p_invite_id: inviteId });
  throwIfError(error, 'Could not turn off that link.');
}

export function inviteUrl(code: string): string {
  return `${window.location.origin}/join/${code}`;
}

export interface InvitePreview {
  status: InviteStatus;
  spaceId?: string;
  name?: string;
  kind?: SpaceKind;
  description?: string | null;
  memberCount?: number;
}

export async function previewInvite(code: string): Promise<InvitePreview> {
  const { data, error } = await supabase.rpc('preview_space_invite', { p_code: code });
  throwIfError(error, 'Could not check that invite link.');
  const raw = (data ?? { status: 'invalid' }) as Record<string, unknown>;
  return {
    status: raw.status as InviteStatus,
    spaceId: raw.space_id as string | undefined,
    name: raw.name as string | undefined,
    kind: raw.kind as SpaceKind | undefined,
    description: (raw.description as string | null | undefined) ?? null,
    memberCount: raw.member_count === undefined ? undefined : Number(raw.member_count),
  };
}

export async function joinWithCode(code: string): Promise<string> {
  const { data, error } = await supabase.rpc('join_space_with_code', { p_code: code });
  throwIfError(error, 'Could not join with that link.');
  return data as string;
}

// ---------------------------------------------------------------------------
// Direct invitations
// ---------------------------------------------------------------------------

export async function inviteByUsername(spaceId: string, username: string): Promise<void> {
  const { error } = await supabase.rpc('invite_to_space', { p_space_id: spaceId, p_username: username });
  throwIfError(error, 'Could not send that invitation.');
}

export async function listPendingInvitees(spaceId: string): Promise<PendingInvitee[]> {
  const { data, error } = await supabase
    .from('space_invitations')
    .select(`id, created_at, invited_by, invitee:profiles!space_invitations_invitee_id_fkey(${PROFILE_COLUMNS})`)
    .eq('space_id', spaceId)
    .order('created_at', { ascending: false });
  throwIfError(error, 'Could not load pending invitations.');
  return ((data ?? []) as unknown as PendingInviteeRow[]).map(rowToPendingInvitee);
}

export async function listMyInvitations(): Promise<MyInvitation[]> {
  const { data, error } = await supabase.rpc('my_space_invitations');
  throwIfError(error, 'Could not load your invitations.');
  return ((data ?? []) as MyInvitationRow[]).map(rowToMyInvitation);
}

export async function acceptInvitation(invitationId: string): Promise<string> {
  const { data, error } = await supabase.rpc('accept_space_invitation', { p_invitation_id: invitationId });
  throwIfError(error, 'Could not accept that invitation.');
  return data as string;
}

/** Declining (as the invitee) and cancelling (as the inviter or a manager) are the same delete. */
export async function deleteInvitation(invitationId: string): Promise<void> {
  const { data, error } = await supabase.from('space_invitations').delete().eq('id', invitationId).select('id');
  throwIfError(error, 'Could not update that invitation.');
  if (!data || data.length === 0) throw new Error('That invitation was already answered or withdrawn.');
}

// ---------------------------------------------------------------------------
// Membership changes
// ---------------------------------------------------------------------------

export async function removeMember(spaceId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_space_member', { p_space_id: spaceId, p_user_id: userId });
  throwIfError(error, 'Could not remove that member.');
}

export async function setMemberRole(spaceId: string, userId: string, role: 'admin' | 'member'): Promise<void> {
  const { error } = await supabase.rpc('set_member_role', { p_space_id: spaceId, p_user_id: userId, p_role: role });
  throwIfError(error, 'Could not change that role.');
}

export async function transferOwnership(spaceId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('transfer_space_ownership', { p_space_id: spaceId, p_new_owner: userId });
  throwIfError(error, 'Could not transfer ownership.');
}

export async function leaveSpace(spaceId: string): Promise<void> {
  const { error } = await supabase.rpc('leave_space', { p_space_id: spaceId });
  throwIfError(error, 'Could not leave the space.');
}

// ---------------------------------------------------------------------------
// Activity
// ---------------------------------------------------------------------------

export async function listActivity(spaceIds: string[], limit = 20): Promise<ActivityItem[]> {
  if (spaceIds.length === 0) return [];
  const { data, error } = await supabase
    .from('space_activity')
    .select(ACTIVITY_COLUMNS)
    .in('space_id', spaceIds)
    .order('created_at', { ascending: false })
    .limit(limit);
  throwIfError(error, 'Could not load recent activity.');
  return ((data ?? []) as unknown as ActivityRow[]).map(rowToActivity);
}
