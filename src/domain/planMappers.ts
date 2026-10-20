// src/domain/planMappers.ts
//
// PostgREST rows for migrations 0017–0019 and the shapes the UI uses. Same
// contract as mappers.ts: a select string and its Row interface change
// together. Timestamps become epoch ms here, once, so nothing downstream
// parses dates.
import type { AttendeeResponse, EventStatus, SpaceEvent } from './events';
import type { TaskPriority, TaskStatus, SpaceTask } from './tasks';
import type { Poll, PollKind, PollResults, ResultsVisibility } from './polls';
import {
  DEFAULT_PREFERENCES,
  type AvailabilityPreferences,
  type MemberAvailability,
  type MemberStatus,
} from './availability';
import { DEFAULT_TIME_ZONE } from './zonedTime';

const ms = (iso: string) => Date.parse(iso);
const msOrNull = (iso: string | null) => (iso ? Date.parse(iso) : null);

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export const EVENT_COLUMNS =
  'id, space_id, title, description, location, meeting_url, starts_at, ends_at, timezone, repeat_weekly_until, status, organizer_id, poll_id, created_at, updated_at, event_attendees(user_id, response, responded_at)';

export interface EventRow {
  id: string;
  space_id: string;
  title: string;
  description: string | null;
  location: string | null;
  meeting_url: string | null;
  starts_at: string;
  ends_at: string;
  timezone: string;
  repeat_weekly_until: string | null;
  status: string;
  organizer_id: string | null;
  poll_id: string | null;
  created_at: string;
  updated_at: string;
  event_attendees: { user_id: string; response: string; responded_at: string | null }[];
  space?: { name: string } | null;
}

export function rowToEvent(row: EventRow): SpaceEvent {
  return {
    id: row.id,
    spaceId: row.space_id,
    title: row.title,
    description: row.description,
    location: row.location,
    meetingUrl: row.meeting_url,
    startsAt: ms(row.starts_at),
    endsAt: ms(row.ends_at),
    timezone: row.timezone,
    repeatWeeklyUntil: row.repeat_weekly_until,
    status: row.status as EventStatus,
    organizerId: row.organizer_id,
    pollId: row.poll_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    attendees: (row.event_attendees ?? []).map((a) => ({
      userId: a.user_id,
      response: a.response as AttendeeResponse,
      respondedAt: a.responded_at,
    })),
    spaceName: row.space?.name ?? null,
  };
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export const TASK_COLUMNS =
  'id, space_id, parent_id, is_assignment, title, description, status, priority, due_at, event_id, link_url, created_by, created_at, updated_at, completed_at, completed_by, task_assignees(user_id)';

export interface TaskRow {
  id: string;
  space_id: string;
  parent_id: string | null;
  is_assignment: boolean;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_at: string | null;
  event_id: string | null;
  link_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  completed_by: string | null;
  task_assignees: { user_id: string }[];
  space?: { name: string } | null;
}

export interface TaskWithSpace extends SpaceTask {
  spaceName: string | null;
}

export function rowToTask(row: TaskRow): TaskWithSpace {
  return {
    id: row.id,
    spaceId: row.space_id,
    parentId: row.parent_id,
    isAssignment: row.is_assignment,
    title: row.title,
    description: row.description,
    status: row.status as TaskStatus,
    priority: row.priority as TaskPriority,
    dueAt: msOrNull(row.due_at),
    eventId: row.event_id,
    linkUrl: row.link_url,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    completedBy: row.completed_by,
    assigneeIds: (row.task_assignees ?? []).map((a) => a.user_id),
    spaceName: row.space?.name ?? null,
  };
}

// ---------------------------------------------------------------------------
// Polls
// ---------------------------------------------------------------------------

export const POLL_COLUMNS =
  'id, space_id, question, description, kind, allow_multiple, anonymous, results_visibility, deadline, duration_minutes, timezone, closed_at, event_id, created_by, created_at, poll_options(id, label, starts_at, ends_at, position)';

export interface PollRow {
  id: string;
  space_id: string;
  question: string;
  description: string | null;
  kind: string;
  allow_multiple: boolean;
  anonymous: boolean;
  results_visibility: string;
  deadline: string | null;
  duration_minutes: number | null;
  timezone: string | null;
  closed_at: string | null;
  event_id: string | null;
  created_by: string | null;
  created_at: string;
  poll_options: { id: string; label: string; starts_at: string | null; ends_at: string | null; position: number }[];
}

export function rowToPoll(row: PollRow): Poll {
  return {
    id: row.id,
    spaceId: row.space_id,
    question: row.question,
    description: row.description,
    kind: row.kind as PollKind,
    allowMultiple: row.allow_multiple,
    anonymous: row.anonymous,
    resultsVisibility: row.results_visibility as ResultsVisibility,
    deadline: msOrNull(row.deadline),
    durationMinutes: row.duration_minutes,
    timezone: row.timezone,
    closedAt: row.closed_at,
    eventId: row.event_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    options: [...(row.poll_options ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((o) => ({
        id: o.id,
        label: o.label,
        startsAt: msOrNull(o.starts_at),
        endsAt: msOrNull(o.ends_at),
        position: o.position,
      })),
  };
}

export interface PollResultsJson {
  visible: boolean;
  open: boolean;
  voter_count: number;
  my_votes: string[];
  voters: string[] | null;
  options: { id: string; votes: number | null; voters: string[] | null }[];
}

export function jsonToPollResults(json: PollResultsJson): PollResults {
  return {
    visible: json.visible,
    open: json.open,
    voterCount: Number(json.voter_count),
    myVotes: json.my_votes ?? [],
    voters: json.voters,
    options: (json.options ?? []).map((o) => ({
      id: o.id,
      votes: o.votes === null ? null : Number(o.votes),
      voters: o.voters,
    })),
  };
}

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

export type ResourceCategory = 'link' | 'document' | 'course' | 'study' | 'project' | 'reference';

export interface SpaceResource {
  id: string;
  spaceId: string;
  title: string;
  description: string | null;
  url: string;
  category: ResourceCategory;
  createdBy: string | null;
  createdAt: string;
}

export const RESOURCE_COLUMNS = 'id, space_id, title, description, url, category, created_by, created_at';

export interface ResourceRow {
  id: string;
  space_id: string;
  title: string;
  description: string | null;
  url: string;
  category: string;
  created_by: string | null;
  created_at: string;
}

export function rowToResource(row: ResourceRow): SpaceResource {
  return {
    id: row.id,
    spaceId: row.space_id,
    title: row.title,
    description: row.description,
    url: row.url,
    category: row.category as ResourceCategory,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// space_availability() → engine input
// ---------------------------------------------------------------------------

export interface AvailabilityMemberJson {
  user_id: string;
  share_level: string;
  timezone?: string;
  has_schedule?: boolean;
  preferences?: { earliest_minute: number; latest_minute: number; avoid_weekends: boolean } | null;
  classes?: { days: number[]; start_minute: number; end_minute: number; name: string | null }[];
  blocks?: { kind: string; starts_at: string; ends_at: string; label: string | null }[];
  events?: {
    starts_at: string;
    ends_at: string;
    timezone: string;
    repeat_weekly_until: string | null;
    event_id: string | null;
    title: string | null;
  }[];
}

function preferencesFrom(json: AvailabilityMemberJson['preferences']): AvailabilityPreferences {
  if (!json) return { ...DEFAULT_PREFERENCES };
  return {
    earliestMinute: json.earliest_minute,
    latestMinute: json.latest_minute,
    avoidWeekends: json.avoid_weekends,
  };
}

/**
 * The viewer always counts themselves when they have data, even at share level
 * "hidden" — hiding is about what others see, not about leaving yourself out
 * of your own search. Everyone else hidden, or with no schedule, is unknown.
 */
export function availabilityToMembers(
  rows: readonly AvailabilityMemberJson[],
  viewerId: string,
  labelOf: (userId: string) => string
): MemberAvailability[] {
  return rows.map((row) => {
    const status: MemberStatus =
      row.share_level === 'hidden' && row.user_id !== viewerId
        ? 'hidden'
        : row.has_schedule
          ? 'shared'
          : 'no_schedule';

    return {
      id: row.user_id,
      label: labelOf(row.user_id),
      timezone: row.timezone ?? DEFAULT_TIME_ZONE,
      status,
      weekly: (row.classes ?? []).map((c) => ({
        days: c.days,
        startMinute: c.start_minute,
        endMinute: c.end_minute,
        label: c.name,
      })),
      blocks: (row.blocks ?? []).map((b) => ({
        kind: b.kind === 'free' ? 'free' : 'busy',
        start: ms(b.starts_at),
        end: ms(b.ends_at),
        label: b.label,
      })),
      events: (row.events ?? []).map((e) => ({
        start: ms(e.starts_at),
        end: ms(e.ends_at),
        timezone: e.timezone,
        repeatWeeklyUntil: e.repeat_weekly_until,
        eventId: e.event_id,
        label: e.title,
      })),
      preferences: preferencesFrom(row.preferences),
    };
  });
}
