// src/domain/availability.ts
//
// Group availability over real dates. Design doc §4; the weekly, date-free
// cousin of this is computeGroupFree in compare.ts, and both sit on the
// interval helpers in intervals.ts.
//
// THE RULE THAT MATTERS MOST: never call a time free unless the data says so.
// A member with no schedule, or one who hides their availability, is
// "unknown" — named in every result, counted as attending none of it. Being
// silent about them would make the group look freer than it is, which is the
// failure the friends compare view already warns about.
import type { Interval } from './types';
import { clipIntervals, mergeIntervals, overlapsAny, subtractIntervals } from './intervals';
import { expandOccurrences } from './events';
import {
  addDays,
  daysBetween,
  eachDateKey,
  epochToZoned,
  isDateKey,
  isoWeekday,
  zonedToEpoch,
  DAY_MS,
  MINUTE_MS,
  type DateKey,
} from './zonedTime';

export interface WeeklyBlock {
  days: number[];
  startMinute: number;
  endMinute: number;
  label?: string | null;
}

export interface DatedBlock {
  kind: 'busy' | 'free';
  start: number;
  end: number;
  label?: string | null;
}

export interface CommittedEvent {
  start: number;
  end: number;
  timezone: string;
  repeatWeeklyUntil: DateKey | null;
  /** Set for events in the space being searched; lets a reschedule ignore the event being moved. */
  eventId?: string | null;
  label?: string | null;
}

export interface AvailabilityPreferences {
  /** Minutes from midnight, local to the member. */
  earliestMinute: number;
  latestMinute: number;
  avoidWeekends: boolean;
}

export const DEFAULT_PREFERENCES: AvailabilityPreferences = {
  earliestMinute: 9 * 60,
  latestMinute: 21 * 60,
  avoidWeekends: false,
};

export type MemberStatus = 'shared' | 'no_schedule' | 'hidden';

export interface MemberAvailability {
  id: string;
  label: string;
  timezone: string;
  status: MemberStatus;
  weekly: WeeklyBlock[];
  blocks: DatedBlock[];
  events: CommittedEvent[];
  preferences: AvailabilityPreferences;
}

export type SlotMode = 'everyone' | 'most';

export interface SlotRequest {
  /** The zone the daily window and the dates are read in — the space's. */
  timezone: string;
  fromDate: DateKey;
  /** Inclusive. */
  toDate: DateKey;
  windowStartMinute: number;
  windowEndMinute: number;
  durationMinutes: number;
  /** Spacing of candidate start times, and the size of a heat-map cell. */
  stepMinutes: number;
  mode: SlotMode;
  includeWeekends: boolean;
  /** Starts before this are skipped. Passed in, never read from the clock, so results are reproducible. */
  nowMs: number;
  maxSuggestions?: number;
  /** An event being rescheduled: its own occurrences do not count as busy. */
  ignoreEventId?: string | null;
}

export interface PreferenceMiss {
  memberId: string;
  reason: 'early' | 'late' | 'weekend';
}

export interface Slot {
  start: number;
  end: number;
  /** Date and start time on the request's wall clock, for display. */
  date: DateKey;
  startMinute: number;
  available: string[];
  unavailable: string[];
  preferenceMisses: PreferenceMiss[];
  score: number;
}

export interface GridCell {
  start: number;
  startMinute: number;
  available: string[];
  busy: string[];
}

export interface GridDay {
  date: DateKey;
  cells: GridCell[];
}

export type NoResultReason =
  | 'invalid_range'
  | 'range_too_long'
  | 'window_too_short'
  | 'no_days'
  | 'no_members'
  | 'all_in_past'
  | 'no_common_time'
  | 'nobody_free';

export interface SlotSearchResult {
  suggestions: Slot[];
  /** Members whose free/busy is known, in the order given. */
  countedIds: string[];
  /** No schedule, or hidden: never counted as free. */
  unknownIds: string[];
  /** Most counted members free at once in any candidate slot. */
  bestAvailableCount: number;
  /** Candidate slots where every counted member is free. */
  everyoneFreeCount: number;
  candidateCount: number;
  /** Mode 'everyone' found nothing, so `suggestions` are the closest alternatives. */
  fellBack: boolean;
  reason: NoResultReason | null;
  grid: GridDay[];
}

/** Matches space_availability()'s cap. */
export const MAX_RANGE_DAYS = 62;
const DEFAULT_MAX_SUGGESTIONS = 6;
const MAX_SUGGESTIONS_PER_DAY = 2;
/** Attendance dominates; each preference miss costs less than one attendee. */
const SCORE_PER_ATTENDEE = 1000;
const SCORE_PER_MISS = 10;

/**
 * One member's busy time between two instants, merged.
 *
 * Weekly classes are expanded on the member's OWN wall clock, so a 10:00
 * class in Vancouver lands at 13:00 for a Montreal-based space. A one-off
 * free block cancels class time it covers (a holiday, a cancelled lab) but
 * never a one-off busy block or an event they said yes to.
 */
export function memberBusy(
  member: MemberAvailability,
  rangeStart: number,
  rangeEnd: number,
  ignoreEventId?: string | null
): Interval[] {
  const firstDate = addDays(epochToZoned(rangeStart, member.timezone).date, -1);
  const lastDate = addDays(epochToZoned(rangeEnd, member.timezone).date, 1);

  const weekly: Interval[] = [];
  for (const date of eachDateKey(firstDate, lastDate)) {
    const weekday = isoWeekday(date);
    for (const block of member.weekly) {
      if (!block.days.includes(weekday)) continue;
      const start = zonedToEpoch(date, block.startMinute, member.timezone);
      const end = zonedToEpoch(date, block.endMinute, member.timezone);
      if (end > start) weekly.push({ start, end });
    }
  }

  const freeOverrides = member.blocks.filter((b) => b.kind === 'free').map((b) => ({ start: b.start, end: b.end }));
  const busyBlocks = member.blocks.filter((b) => b.kind === 'busy').map((b) => ({ start: b.start, end: b.end }));
  const events = member.events
    .filter((e) => !ignoreEventId || e.eventId !== ignoreEventId)
    .flatMap((e) =>
      expandOccurrences(
        { startsAt: e.start, endsAt: e.end, timezone: e.timezone, repeatWeeklyUntil: e.repeatWeeklyUntil },
        rangeStart - DAY_MS,
        rangeEnd + DAY_MS
      )
    );

  const classesLeft = subtractIntervals(weekly, freeOverrides);
  return mergeIntervals(clipIntervals([...classesLeft, ...busyBlocks, ...events], { start: rangeStart, end: rangeEnd }));
}

function preferenceMisses(member: MemberAvailability, start: number, end: number): PreferenceMiss['reason'][] {
  const from = epochToZoned(start, member.timezone);
  const to = epochToZoned(end, member.timezone);
  const span = daysBetween(from.date, to.date);
  // Minutes from the start of `from.date` at which the slot ends; past 1440
  // when it runs over midnight, which is always "late".
  const endMinute = span === 0 ? to.minute : 1440 * span + to.minute;

  const misses: PreferenceMiss['reason'][] = [];
  if (from.minute < member.preferences.earliestMinute) misses.push('early');
  if (endMinute > member.preferences.latestMinute) misses.push('late');
  if (member.preferences.avoidWeekends && from.weekday >= 6) misses.push('weekend');
  return misses;
}

function validate(request: SlotRequest): NoResultReason | null {
  if (!isDateKey(request.fromDate) || !isDateKey(request.toDate)) return 'invalid_range';
  if (daysBetween(request.fromDate, request.toDate) < 0) return 'invalid_range';
  if (daysBetween(request.fromDate, request.toDate) + 1 > MAX_RANGE_DAYS) return 'range_too_long';
  if (request.durationMinutes <= 0 || request.stepMinutes <= 0) return 'invalid_range';
  if (request.windowStartMinute < 0 || request.windowEndMinute > 1440) return 'invalid_range';
  if (request.windowEndMinute - request.windowStartMinute < request.durationMinutes) return 'window_too_short';
  return null;
}

function emptyResult(reason: NoResultReason, countedIds: string[], unknownIds: string[]): SlotSearchResult {
  return {
    suggestions: [],
    countedIds,
    unknownIds,
    bestAvailableCount: 0,
    everyoneFreeCount: 0,
    candidateCount: 0,
    fellBack: false,
    reason,
    grid: [],
  };
}

/**
 * Picks the best non-overlapping slots: highest score first, earlier first on
 * a tie, at most MAX_SUGGESTIONS_PER_DAY on one date so a free Monday cannot
 * crowd every other day off the list.
 */
function pickSuggestions(slots: Slot[], max: number): Slot[] {
  const ranked = [...slots].sort((a, b) => b.score - a.score || a.start - b.start);
  const chosen: Slot[] = [];
  const perDay = new Map<DateKey, number>();

  for (const slot of ranked) {
    if (chosen.length >= max) break;
    if ((perDay.get(slot.date) ?? 0) >= MAX_SUGGESTIONS_PER_DAY) continue;
    if (chosen.some((c) => c.start < slot.end && slot.start < c.end)) continue;
    chosen.push(slot);
    perDay.set(slot.date, (perDay.get(slot.date) ?? 0) + 1);
  }

  return chosen.sort((a, b) => b.score - a.score || a.start - b.start);
}

export function findSlots(members: readonly MemberAvailability[], request: SlotRequest): SlotSearchResult {
  const counted = members.filter((m) => m.status === 'shared');
  const countedIds = counted.map((m) => m.id);
  const unknownIds = members.filter((m) => m.status !== 'shared').map((m) => m.id);

  const invalid = validate(request);
  if (invalid) return emptyResult(invalid, countedIds, unknownIds);
  if (counted.length === 0) return emptyResult('no_members', countedIds, unknownIds);

  const rangeStart = zonedToEpoch(request.fromDate, 0, request.timezone);
  const rangeEnd = zonedToEpoch(addDays(request.toDate, 1), 0, request.timezone);
  const busyByMember = new Map(
    counted.map((m) => [m.id, memberBusy(m, rangeStart - DAY_MS, rangeEnd + DAY_MS, request.ignoreEventId)])
  );

  const freeFor = (start: number, end: number) => {
    const available: string[] = [];
    const unavailable: string[] = [];
    for (const member of counted) {
      if (overlapsAny(busyByMember.get(member.id) ?? [], start, end)) unavailable.push(member.id);
      else available.push(member.id);
    }
    return { available, unavailable };
  };

  const dates = eachDateKey(request.fromDate, request.toDate).filter(
    (date) => request.includeWeekends || isoWeekday(date) < 6
  );
  if (dates.length === 0) return emptyResult('no_days', countedIds, unknownIds);

  const slots: Slot[] = [];
  const seenStarts = new Set<number>();
  let skippedAsPast = 0;
  const grid: GridDay[] = [];

  for (const date of dates) {
    const cells: GridCell[] = [];
    for (let minute = request.windowStartMinute; minute + request.stepMinutes <= request.windowEndMinute; minute += request.stepMinutes) {
      const start = zonedToEpoch(date, minute, request.timezone);
      const { available, unavailable } = freeFor(start, start + request.stepMinutes * MINUTE_MS);
      cells.push({ start, startMinute: minute, available, busy: unavailable });
    }
    grid.push({ date, cells });

    for (
      let minute = request.windowStartMinute;
      minute + request.durationMinutes <= request.windowEndMinute;
      minute += request.stepMinutes
    ) {
      const start = zonedToEpoch(date, minute, request.timezone);
      // A wall time skipped by DST resolves to the next real instant, which a
      // later step also lands on; count it once.
      if (seenStarts.has(start)) continue;
      seenStarts.add(start);
      if (start < request.nowMs) {
        skippedAsPast += 1;
        continue;
      }

      const end = start + request.durationMinutes * MINUTE_MS;
      const { available, unavailable } = freeFor(start, end);
      const misses = counted
        .filter((m) => available.includes(m.id))
        .flatMap((m) => preferenceMisses(m, start, end).map((reason) => ({ memberId: m.id, reason })));

      slots.push({
        start,
        end,
        date,
        startMinute: minute,
        available,
        unavailable,
        preferenceMisses: misses,
        score: available.length * SCORE_PER_ATTENDEE - misses.length * SCORE_PER_MISS,
      });
    }
  }

  const base = {
    countedIds,
    unknownIds,
    candidateCount: slots.length,
    grid,
  };

  if (slots.length === 0) {
    return {
      ...base,
      suggestions: [],
      bestAvailableCount: 0,
      everyoneFreeCount: 0,
      fellBack: false,
      reason: skippedAsPast > 0 ? 'all_in_past' : 'window_too_short',
    };
  }

  const everyone = slots.filter((s) => s.available.length === counted.length);
  const bestAvailableCount = Math.max(...slots.map((s) => s.available.length));
  const max = request.maxSuggestions ?? DEFAULT_MAX_SUGGESTIONS;

  if (request.mode === 'everyone' && everyone.length > 0) {
    return {
      ...base,
      suggestions: pickSuggestions(everyone, max),
      bestAvailableCount,
      everyoneFreeCount: everyone.length,
      fellBack: false,
      reason: null,
    };
  }

  const anyone = slots.filter((s) => s.available.length > 0);
  if (anyone.length === 0) {
    return {
      ...base,
      suggestions: [],
      bestAvailableCount,
      everyoneFreeCount: 0,
      fellBack: false,
      reason: 'nobody_free',
    };
  }

  const fellBack = request.mode === 'everyone';
  return {
    ...base,
    suggestions: pickSuggestions(anyone, max),
    bestAvailableCount,
    everyoneFreeCount: everyone.length,
    fellBack,
    reason: fellBack ? 'no_common_time' : null,
  };
}

// ---------------------------------------------------------------------------
// Explanations
// ---------------------------------------------------------------------------

/** Why a search came back empty, in words a student can act on. */
export function explainNoResult(reason: NoResultReason, request: Pick<SlotRequest, 'durationMinutes'>): string {
  switch (reason) {
    case 'invalid_range':
      return 'Check the dates: the end date has to be on or after the start date.';
    case 'range_too_long':
      return `Search at most ${MAX_RANGE_DAYS} days at a time.`;
    case 'window_too_short':
      return `The daily time window is shorter than the ${request.durationMinutes}-minute meeting. Widen the window or shorten the meeting.`;
    case 'no_days':
      return 'Those dates are all on a weekend, and weekends are switched off. Include weekends or pick other dates.';
    case 'no_members':
      return 'Nobody selected has shared a schedule yet, so there is nothing to match. Ask them to add their schedule, or include yourself.';
    case 'all_in_past':
      return 'Every time in that range has already passed. Pick later dates.';
    case 'no_common_time':
      return 'There is no time in that range when everyone is free. These are the times the most people can make.';
    case 'nobody_free':
      return 'Everyone with a schedule is busy for the whole window on every day searched. Try other dates, a wider window or a shorter meeting.';
  }
}

/** "4 of 5 free" — counts members whose availability is known; unknowns are listed separately. */
export function attendanceLabel(slot: Pick<Slot, 'available'>, countedTotal: number): string {
  if (slot.available.length === countedTotal) return countedTotal === 1 ? 'Free' : `All ${countedTotal} free`;
  return `${slot.available.length} of ${countedTotal} free`;
}

const MISS_TEXT: Record<PreferenceMiss['reason'], string> = {
  early: 'earlier than they like',
  late: 'later than they like',
  weekend: 'on a weekend they keep free',
};

export function describeMisses(misses: readonly PreferenceMiss[], labelOf: (id: string) => string): string[] {
  return misses.map((miss) => `${labelOf(miss.memberId)}: ${MISS_TEXT[miss.reason]}`);
}
