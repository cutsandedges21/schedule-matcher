// src/domain/events.ts
//
// Space events (migration 0017): types, recurrence, attendance, validation.
import type { Interval } from './types';
import type { SpaceRole } from './spaces';
import {
  addDays,
  daysBetween,
  epochToZoned,
  isDateKey,
  isValidTimeZone,
  zonedToEpoch,
  DAY_MS,
  MINUTE_MS,
  type DateKey,
} from './zonedTime';

export type EventStatus = 'confirmed' | 'cancelled';
export type AttendeeResponse = 'pending' | 'going' | 'maybe' | 'declined';

export interface EventAttendee {
  userId: string;
  response: AttendeeResponse;
  respondedAt: string | null;
}

export interface SpaceEvent {
  id: string;
  spaceId: string;
  title: string;
  description: string | null;
  location: string | null;
  meetingUrl: string | null;
  /** Epoch ms of the first occurrence. */
  startsAt: number;
  endsAt: number;
  timezone: string;
  repeatWeeklyUntil: DateKey | null;
  status: EventStatus;
  organizerId: string | null;
  createdAt: string;
  updatedAt: string;
  attendees: EventAttendee[];
}

export interface EventSeries {
  startsAt: number;
  endsAt: number;
  timezone: string;
  repeatWeeklyUntil: DateKey | null;
}

/** Longest event the database accepts (space_events_length). */
export const MAX_EVENT_DAYS = 14;
/** How far a weekly event may repeat (validate_space_event). */
export const MAX_REPEAT_DAYS = 366;
export const EVENT_TITLE_MAX = 120;
export const EVENT_DESCRIPTION_MAX = 2000;
export const EVENT_LOCATION_MAX = 200;

/**
 * Every occurrence of a series that overlaps [rangeStart, rangeEnd).
 *
 * A weekly event repeats on the wall clock of its own zone: a Thursday 15:00
 * meeting is at 15:00 local every Thursday, so its UTC time moves by an hour
 * across a DST change. Each occurrence keeps the first one's absolute length.
 */
export function expandOccurrences(series: EventSeries, rangeStart: number, rangeEnd: number): Interval[] {
  const duration = series.endsAt - series.startsAt;
  if (duration <= 0) return [];

  if (!series.repeatWeeklyUntil) {
    return series.startsAt < rangeEnd && series.endsAt > rangeStart
      ? [{ start: series.startsAt, end: series.endsAt }]
      : [];
  }

  const first = epochToZoned(series.startsAt, series.timezone);
  const out: Interval[] = [];
  // Skip whole weeks that end before the range, with a week of slack for DST.
  const skipWeeks = Math.max(0, Math.floor((rangeStart - series.endsAt) / (7 * DAY_MS)) - 1);

  for (let week = skipWeeks; ; week += 1) {
    const date = addDays(first.date, week * 7);
    if (daysBetween(date, series.repeatWeeklyUntil) < 0) break;
    const start = zonedToEpoch(date, first.minute, series.timezone);
    if (start >= rangeEnd) break;
    const end = start + duration;
    if (end > rangeStart) out.push({ start, end });
    if (week > skipWeeks + 60) break; // more than a year of weeks: the database caps repeats at 366 days
  }

  return out;
}

export interface Occurrence {
  event: SpaceEvent;
  start: number;
  end: number;
}

export function occurrencesInRange(events: readonly SpaceEvent[], rangeStart: number, rangeEnd: number): Occurrence[] {
  return events
    .flatMap((event) =>
      expandOccurrences(event, rangeStart, rangeEnd).map(({ start, end }) => ({ event, start, end }))
    )
    .sort((a, b) => a.start - b.start || a.end - b.end);
}

/** Occurrences grouped by the calendar date they start on, in `timeZone`, in date order. */
export function groupByDate(occurrences: readonly Occurrence[], timeZone: string): { date: DateKey; items: Occurrence[] }[] {
  const byDate = new Map<DateKey, Occurrence[]>();
  for (const occurrence of occurrences) {
    const date = epochToZoned(occurrence.start, timeZone).date;
    const list = byDate.get(date);
    if (list) list.push(occurrence);
    else byDate.set(date, [occurrence]);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, items]) => ({ date, items }));
}

export interface AttendanceSummary {
  going: number;
  maybe: number;
  declined: number;
  pending: number;
}

export function attendanceSummary(attendees: readonly EventAttendee[]): AttendanceSummary {
  const summary: AttendanceSummary = { going: 0, maybe: 0, declined: 0, pending: 0 };
  for (const attendee of attendees) summary[attendee.response] += 1;
  return summary;
}

export function responseOf(event: SpaceEvent, userId: string): AttendeeResponse | null {
  return event.attendees.find((a) => a.userId === userId)?.response ?? null;
}

/** space_events_update / _delete: the organizer, or an owner or admin. */
export function canManageEvent(event: Pick<SpaceEvent, 'organizerId'>, userId: string, role: SpaceRole): boolean {
  return event.organizerId === userId || role === 'owner' || role === 'admin';
}

export const RESPONSE_LABELS: Record<AttendeeResponse, string> = {
  going: 'Going',
  maybe: 'Maybe',
  declined: "Can't go",
  pending: 'No answer',
};

// ---------------------------------------------------------------------------
// Drafts
// ---------------------------------------------------------------------------

export interface EventDraft {
  title: string;
  description: string;
  location: string;
  meetingUrl: string;
  date: DateKey;
  startMinute: number;
  endMinute: number;
  timezone: string;
  repeatWeekly: boolean;
  repeatUntil: DateKey;
}

export type EventDraftErrors = Partial<Record<keyof EventDraft | 'form', string>>;

/** http(s) with a host — the same rule as the space_events_meeting_url constraint. */
export function isWebUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!/^https?:\/\/[^\s/?#]+[^\s]*$/i.test(trimmed)) return false;
  try {
    const url = new URL(trimmed);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname.length > 0;
  } catch {
    return false;
  }
}

/**
 * Times are wall-clock minutes on `date` in `timezone`. An end at or before
 * the start means the event runs past midnight into the next day — a 22:00
 * to 01:00 party — which is legal, up to MAX_EVENT_DAYS.
 */
export function draftToInstants(draft: Pick<EventDraft, 'date' | 'startMinute' | 'endMinute' | 'timezone'>): {
  startsAt: number;
  endsAt: number;
} {
  const startsAt = zonedToEpoch(draft.date, draft.startMinute, draft.timezone);
  const endDate = draft.endMinute > draft.startMinute ? draft.date : addDays(draft.date, 1);
  const endsAt = zonedToEpoch(endDate, draft.endMinute, draft.timezone);
  return { startsAt, endsAt };
}

export function validateEventDraft(draft: EventDraft, nowMs: number): EventDraftErrors {
  const errors: EventDraftErrors = {};
  const title = draft.title.trim();
  if (!title) errors.title = 'Give the event a name.';
  else if (title.length > EVENT_TITLE_MAX) errors.title = `At most ${EVENT_TITLE_MAX} characters.`;
  if (draft.description.length > EVENT_DESCRIPTION_MAX) errors.description = `At most ${EVENT_DESCRIPTION_MAX} characters.`;
  if (draft.location.trim().length > EVENT_LOCATION_MAX) errors.location = `At most ${EVENT_LOCATION_MAX} characters.`;
  if (draft.meetingUrl.trim() && !isWebUrl(draft.meetingUrl)) errors.meetingUrl = 'Paste a full link starting with https://';
  if (!isDateKey(draft.date)) errors.date = 'Pick a date.';
  if (!isValidTimeZone(draft.timezone)) errors.timezone = 'Pick a time zone from the list.';
  if (draft.startMinute === draft.endMinute) errors.endMinute = 'The event has to end after it starts.';

  if (!errors.date && !errors.timezone && !errors.endMinute) {
    const { startsAt, endsAt } = draftToInstants(draft);
    if (endsAt - startsAt > MAX_EVENT_DAYS * DAY_MS) errors.endMinute = `An event can last ${MAX_EVENT_DAYS} days at most.`;
    if (endsAt <= nowMs - 5 * MINUTE_MS) errors.date = 'That time has already passed.';
  }

  if (draft.repeatWeekly) {
    if (!isDateKey(draft.repeatUntil)) errors.repeatUntil = 'Pick the last date it repeats on.';
    else if (isDateKey(draft.date)) {
      const span = daysBetween(draft.date, draft.repeatUntil);
      if (span < 0) errors.repeatUntil = 'The last date has to be on or after the first.';
      else if (span > MAX_REPEAT_DAYS) errors.repeatUntil = 'A weekly event can repeat for a year at most.';
    }
  }

  return errors;
}
