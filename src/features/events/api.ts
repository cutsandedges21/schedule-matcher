// src/features/events/api.ts
import { supabase } from '@/lib/supabase';
import { throwIfError } from '@/lib/supabaseErrors';
import { EVENT_COLUMNS, rowToEvent, type EventRow } from '@/domain/planMappers';
import type { AttendeeResponse, SpaceEvent } from '@/domain/events';

/**
 * Events with any occurrence overlapping [from, to): one-offs that overlap it,
 * and weekly series that started before `to` and repeat into it. Values are
 * double-quoted inside or(): an ISO timestamp is full of ':' and '.', which
 * PostgREST's filter grammar otherwise reads as separators.
 */
function rangeFilter(fromIso: string, toIso: string) {
  const fromDay = fromIso.slice(0, 10);
  return {
    startsBefore: toIso,
    overlap: `ends_at.gt."${fromIso}",repeat_weekly_until.gte."${fromDay}"`,
  };
}

export async function listSpaceEvents(spaceId: string, fromIso: string, toIso: string): Promise<SpaceEvent[]> {
  const filter = rangeFilter(fromIso, toIso);
  const { data, error } = await supabase
    .from('space_events')
    .select(EVENT_COLUMNS)
    .eq('space_id', spaceId)
    .lt('starts_at', filter.startsBefore)
    .or(filter.overlap)
    .order('starts_at');
  throwIfError(error, 'Could not load the calendar.');
  return ((data ?? []) as unknown as EventRow[]).map(rowToEvent);
}

/** Every space the student is in — RLS does the filtering. */
export async function listMyEvents(fromIso: string, toIso: string): Promise<SpaceEvent[]> {
  const filter = rangeFilter(fromIso, toIso);
  const { data, error } = await supabase
    .from('space_events')
    .select(`${EVENT_COLUMNS}, space:spaces(name)`)
    .lt('starts_at', filter.startsBefore)
    .or(filter.overlap)
    .order('starts_at');
  throwIfError(error, 'Could not load your calendar.');
  return ((data ?? []) as unknown as EventRow[]).map(rowToEvent);
}

export async function getEvent(eventId: string): Promise<SpaceEvent | null> {
  const { data, error } = await supabase.from('space_events').select(EVENT_COLUMNS).eq('id', eventId).maybeSingle();
  throwIfError(error, 'Could not load this event.');
  return data ? rowToEvent(data as unknown as EventRow) : null;
}

export interface EventInput {
  title: string;
  startsAt: number;
  endsAt: number;
  timezone: string;
  description: string;
  location: string;
  meetingUrl: string;
  repeatWeeklyUntil: string | null;
}

export async function createEvent(spaceId: string, input: EventInput, attendeeIds: string[] | null): Promise<string> {
  const { data, error } = await supabase.rpc('create_space_event', {
    p_space_id: spaceId,
    p_title: input.title.trim(),
    p_starts_at: new Date(input.startsAt).toISOString(),
    p_ends_at: new Date(input.endsAt).toISOString(),
    p_timezone: input.timezone,
    p_description: input.description,
    p_location: input.location,
    p_meeting_url: input.meetingUrl,
    p_repeat_weekly_until: input.repeatWeeklyUntil,
    p_attendee_ids: attendeeIds,
  });
  throwIfError(error, 'Could not create the event.');
  return data as string;
}

export async function updateEvent(eventId: string, patch: Partial<EventInput> & { status?: 'confirmed' | 'cancelled' }) {
  const row: Record<string, unknown> = {};
  if (patch.title !== undefined) row.title = patch.title.trim();
  if (patch.startsAt !== undefined) row.starts_at = new Date(patch.startsAt).toISOString();
  if (patch.endsAt !== undefined) row.ends_at = new Date(patch.endsAt).toISOString();
  if (patch.timezone !== undefined) row.timezone = patch.timezone;
  if (patch.description !== undefined) row.description = patch.description.trim() || null;
  if (patch.location !== undefined) row.location = patch.location.trim() || null;
  if (patch.meetingUrl !== undefined) row.meeting_url = patch.meetingUrl.trim() || null;
  if (patch.repeatWeeklyUntil !== undefined) row.repeat_weekly_until = patch.repeatWeeklyUntil;
  if (patch.status !== undefined) row.status = patch.status;

  const { data, error } = await supabase.from('space_events').update(row).eq('id', eventId).select('id');
  throwIfError(error, 'Could not save the event.');
  if (!data || data.length === 0) throw new Error('Only the organizer or an admin can change this event.');
}

export async function deleteEvent(eventId: string): Promise<void> {
  const { data, error } = await supabase.from('space_events').delete().eq('id', eventId).select('id');
  throwIfError(error, 'Could not delete the event.');
  if (!data || data.length === 0) throw new Error('Only the organizer or an admin can delete this event.');
}

/**
 * Answer for yourself. Update first; a member who was not on the list (they
 * joined the space later) gets a row inserted instead. Not an upsert: the
 * update grant covers only response columns, and PostgREST's upsert rewrites
 * the key columns too.
 */
export async function respondToEvent(eventId: string, userId: string, response: AttendeeResponse): Promise<void> {
  const respondedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from('event_attendees')
    .update({ response, responded_at: respondedAt })
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .select('user_id');
  throwIfError(error, 'Could not save your answer.');
  if (data && data.length > 0) return;

  const { error: insertError } = await supabase
    .from('event_attendees')
    .insert({ event_id: eventId, user_id: userId, response, responded_at: respondedAt });
  throwIfError(insertError, 'Could not save your answer.');
}
