// src/domain/spaceMappers.ts
//
// Row shapes returned by PostgREST for migration 0016's tables and RPCs, and
// the camelCase types the UI works with. Same contract as domain/mappers.ts:
// the Row interface and its mapper change together, and a select string that
// omits a column fails loudly in the mapper test rather than as `undefined` on
// a screen.
import { rowToProfile, type ProfileRow } from './mappers';
import type { Profile } from './types';
import type { ShareLevel, SpaceKind, SpaceRole } from './spaces';

export interface Space {
  id: string;
  name: string;
  description: string | null;
  kind: SpaceKind;
  timezone: string;
  membersCanInvite: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MySpace extends Space {
  role: SpaceRole;
  shareLevel: ShareLevel;
  pinned: boolean;
  joinedAt: string;
  memberCount: number;
}

export interface SpaceMember {
  userId: string;
  role: SpaceRole;
  shareLevel: ShareLevel;
  pinned: boolean;
  joinedAt: string;
  profile: Profile;
}

export interface SpaceInvite {
  id: string;
  code: string;
  createdBy: string | null;
  createdAt: string;
  expiresAt: string | null;
  maxUses: number | null;
  useCount: number;
  revokedAt: string | null;
}

export interface MyInvitation {
  id: string;
  spaceId: string;
  spaceName: string;
  spaceKind: SpaceKind;
  invitedByUsername: string | null;
  createdAt: string;
}

export interface PendingInvitee {
  id: string;
  createdAt: string;
  invitedBy: string | null;
  invitee: Profile;
}

export interface ActivityItem {
  id: number;
  spaceId: string;
  actorId: string | null;
  actorUsername: string | null;
  verb: string;
  entityType: string | null;
  entityId: string | null;
  summary: string;
  createdAt: string;
}

export type NotificationKind =
  | 'space_invite'
  | 'space_update'
  | 'task_assigned'
  | 'task_due'
  | 'event_invite'
  | 'event_changed'
  | 'event_reminder'
  | 'poll_open'
  | 'poll_closed';

export interface AppNotification {
  id: string;
  spaceId: string | null;
  kind: NotificationKind;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationPreferences {
  invites: boolean;
  spaceUpdates: boolean;
  tasks: boolean;
  deadlines: boolean;
  events: boolean;
  polls: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  invites: true,
  spaceUpdates: true,
  tasks: true,
  deadlines: true,
  events: true,
  polls: true,
};

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

export interface SpaceRow {
  id: string;
  name: string;
  description: string | null;
  kind: string;
  timezone: string;
  members_can_invite: boolean;
  created_at: string;
  updated_at: string;
}

export const SPACE_COLUMNS =
  'id, name, description, kind, timezone, members_can_invite, created_at, updated_at';

export interface MySpaceRow extends SpaceRow {
  role: string;
  share_level: string;
  pinned: boolean;
  joined_at: string;
  member_count: number | string;
}

export interface SpaceMemberRow {
  user_id: string;
  role: string;
  share_level: string;
  pinned: boolean;
  joined_at: string;
  profile: ProfileRow;
}

export interface SpaceInviteRow {
  id: string;
  code: string;
  created_by: string | null;
  created_at: string;
  expires_at: string | null;
  max_uses: number | null;
  use_count: number;
  revoked_at: string | null;
}

export const SPACE_INVITE_COLUMNS =
  'id, code, created_by, created_at, expires_at, max_uses, use_count, revoked_at';

export interface MyInvitationRow {
  id: string;
  space_id: string;
  space_name: string;
  space_kind: string;
  invited_by_username: string | null;
  created_at: string;
}

export interface PendingInviteeRow {
  id: string;
  created_at: string;
  invited_by: string | null;
  invitee: ProfileRow;
}

export interface ActivityRow {
  id: number;
  space_id: string;
  actor_id: string | null;
  verb: string;
  entity_type: string | null;
  entity_id: string | null;
  summary: string;
  created_at: string;
  actor: { username: string } | null;
}

export const ACTIVITY_COLUMNS =
  'id, space_id, actor_id, verb, entity_type, entity_id, summary, created_at, actor:profiles(username)';

export interface NotificationRow {
  id: string;
  space_id: string | null;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export const NOTIFICATION_COLUMNS = 'id, space_id, kind, title, body, link, read_at, created_at';

export interface NotificationPreferencesRow {
  invites: boolean;
  space_updates: boolean;
  tasks: boolean;
  deadlines: boolean;
  events: boolean;
  polls: boolean;
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

export function rowToSpace(row: SpaceRow): Space {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    kind: row.kind as SpaceKind,
    timezone: row.timezone,
    membersCanInvite: row.members_can_invite,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function rowToMySpace(row: MySpaceRow): MySpace {
  return {
    ...rowToSpace(row),
    role: row.role as SpaceRole,
    shareLevel: row.share_level as ShareLevel,
    pinned: row.pinned,
    joinedAt: row.joined_at,
    // count(*) is a bigint, which PostgREST serialises as a number, but a
    // driver that keeps int8 as a string would otherwise break sums silently.
    memberCount: Number(row.member_count),
  };
}

export function rowToSpaceMember(row: SpaceMemberRow): SpaceMember {
  return {
    userId: row.user_id,
    role: row.role as SpaceRole,
    shareLevel: row.share_level as ShareLevel,
    pinned: row.pinned,
    joinedAt: row.joined_at,
    profile: rowToProfile(row.profile),
  };
}

export function rowToSpaceInvite(row: SpaceInviteRow): SpaceInvite {
  return {
    id: row.id,
    code: row.code,
    createdBy: row.created_by,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    maxUses: row.max_uses,
    useCount: row.use_count,
    revokedAt: row.revoked_at,
  };
}

export function rowToMyInvitation(row: MyInvitationRow): MyInvitation {
  return {
    id: row.id,
    spaceId: row.space_id,
    spaceName: row.space_name,
    spaceKind: row.space_kind as SpaceKind,
    invitedByUsername: row.invited_by_username,
    createdAt: row.created_at,
  };
}

export function rowToPendingInvitee(row: PendingInviteeRow): PendingInvitee {
  return {
    id: row.id,
    createdAt: row.created_at,
    invitedBy: row.invited_by,
    invitee: rowToProfile(row.invitee),
  };
}

export function rowToActivity(row: ActivityRow): ActivityItem {
  return {
    id: row.id,
    spaceId: row.space_id,
    actorId: row.actor_id,
    actorUsername: row.actor?.username ?? null,
    verb: row.verb,
    entityType: row.entity_type,
    entityId: row.entity_id,
    summary: row.summary,
    createdAt: row.created_at,
  };
}

export function rowToNotification(row: NotificationRow): AppNotification {
  return {
    id: row.id,
    spaceId: row.space_id,
    kind: row.kind as NotificationKind,
    title: row.title,
    body: row.body,
    link: row.link,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

export function rowToNotificationPreferences(
  row: NotificationPreferencesRow | null
): NotificationPreferences {
  if (!row) return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  return {
    invites: row.invites,
    spaceUpdates: row.space_updates,
    tasks: row.tasks,
    deadlines: row.deadlines,
    events: row.events,
    polls: row.polls,
  };
}

export function notificationPreferencesToRow(prefs: NotificationPreferences): NotificationPreferencesRow {
  return {
    invites: prefs.invites,
    space_updates: prefs.spaceUpdates,
    tasks: prefs.tasks,
    deadlines: prefs.deadlines,
    events: prefs.events,
    polls: prefs.polls,
  };
}

/** "@alice created the space", or "Someone …" once the actor's account is gone. */
export function describeActivity(item: ActivityItem, viewerId?: string): string {
  const actor =
    item.actorId && item.actorId === viewerId
      ? 'You'
      : item.actorUsername
        ? `@${item.actorUsername}`
        : 'Someone';
  return `${actor} ${item.summary}`;
}
