// src/domain/compare.ts
import { DAY_START_MINUTE, DAY_END_MINUTE, MIN_FREE_MINUTES } from './constants';
import { normalizeClassName } from './text';
import type { ClassMeeting, Interval } from './types';

export interface SharedClass {
  name: string;
  day: number;
  startMinute: number;
  endMinute: number;
  /**
   * False when the two students' stored copies of this class disagree about
   * when it runs.
   *
   * `isSameClass` matches on overlap rather than on equal times, deliberately:
   * each schedule is extracted from that student's own screenshot and two
   * readings of one course often differ by a few minutes. That tolerance is
   * what makes the feature work, and it is also what lets a genuinely bad
   * extraction hide — the 1:1 grid draws a shared class once from the viewer's
   * copy, so the other student's wrong time is never rendered. Surfacing this
   * flag is the only thing that tells either of them to go and look.
   */
  timesMatch: boolean;
}

function normalizeCode(value: string | null): string {
  return (value ?? '').trim().toLowerCase();
}

/**
 * Same class = genuinely overlapping time, plus:
 *  - when both sides have a course code, the code AND section must match
 *    (case-insensitive, trimmed) — same code, different section is the same
 *    *course* but a different class, which is exactly what code+section
 *    identity is for;
 *  - otherwise, fall back to the normalized course name, as before.
 */
export function isSameClass(a: ClassMeeting, b: ClassMeeting): boolean {
  const overlaps = a.startMinute < b.endMinute && b.startMinute < a.endMinute;
  if (!overlaps) return false;

  if (a.courseCode && b.courseCode) {
    return (
      normalizeCode(a.courseCode) === normalizeCode(b.courseCode) &&
      normalizeCode(a.section) === normalizeCode(b.section)
    );
  }

  return normalizeClassName(a.name) === normalizeClassName(b.name);
}

export function findSharedClasses(
  mine: ClassMeeting[],
  theirs: ClassMeeting[]
): SharedClass[] {
  const shared: SharedClass[] = [];

  for (const a of mine) {
    for (const b of theirs) {
      if (!isSameClass(a, b)) continue;
      for (const day of a.days) {
        if (!b.days.includes(day)) continue;
        shared.push({
          name: a.name,
          day,
          startMinute: Math.max(a.startMinute, b.startMinute),
          endMinute: Math.min(a.endMinute, b.endMinute),
          timesMatch: a.startMinute === b.startMinute && a.endMinute === b.endMinute,
        });
      }
    }
  }

  return shared.sort((x, y) => x.day - y.day || x.startMinute - y.startMinute);
}

/**
 * Free windows on one day where nobody in the group has a class. Bounded by
 * the fixed 08:00–18:00 axis rather than the union of the group's active
 * hours, so "everyone free 08:00–09:30" is reported even when nobody has an
 * early class.
 *
 * Adding a member can only ever remove free time, never add it — every
 * member's classes go into the same busy union before it is inverted.
 */
export function computeGroupFree(schedules: ClassMeeting[][], day: number): Interval[] {
  const busy = schedules
    .flat()
    .filter((c) => c.days.includes(day))
    .map((c) => ({
      start: Math.max(c.startMinute, DAY_START_MINUTE),
      end: Math.min(c.endMinute, DAY_END_MINUTE),
    }))
    .filter((i) => i.end > i.start)
    .sort((a, b) => a.start - b.start);

  const merged: Interval[] = [];
  for (const interval of busy) {
    const last = merged[merged.length - 1];
    if (last && interval.start <= last.end) last.end = Math.max(last.end, interval.end);
    else merged.push({ ...interval });
  }

  const free: Interval[] = [];
  let cursor = DAY_START_MINUTE;
  for (const block of merged) {
    if (block.start - cursor >= MIN_FREE_MINUTES) free.push({ start: cursor, end: block.start });
    cursor = Math.max(cursor, block.end);
  }
  if (DAY_END_MINUTE - cursor >= MIN_FREE_MINUTES) {
    free.push({ start: cursor, end: DAY_END_MINUTE });
  }

  return free;
}

/** The two-person case, unchanged in behaviour: a group of exactly two. */
export function computeMutualFree(
  mine: ClassMeeting[],
  theirs: ClassMeeting[],
  day: number
): Interval[] {
  return computeGroupFree([mine, theirs], day);
}

export interface GroupMember {
  id: string;
  classes: ClassMeeting[];
}

export interface GroupSharedClass {
  name: string;
  day: number;
  /**
   * The window every listed member is actually in the room together — the
   * intersection of their copies, not the class's time.
   *
   * These two are only equal when every member's stored copy agrees to the
   * minute, which is not guaranteed: each schedule is extracted from that
   * student's own screenshot, and `isSameClass` matches on overlap precisely
   * because two extractions of one course often disagree slightly. **Never
   * display these as the time a class starts** — a 14:00 class that one member
   * stored as 14:30 would be reported to everybody as a 14:30 class. Use
   * `classStartMinute` for that.
   */
  startMinute: number;
  endMinute: number;
  /**
   * The class's own time, taken from the cluster's anchor. Members are scanned
   * in the order given and the caller passes the viewer first, so this is the
   * viewer's own copy whenever they are in the cluster — which is the same
   * value the 1:1 compare view shows, so the two screens agree.
   */
  classStartMinute: number;
  classEndMinute: number;
  /**
   * False when the members' stored copies disagree about when this class runs.
   * See the note on SharedClass.timesMatch — the same tolerance applies here,
   * and the same silent failure follows from not surfacing it.
   */
  timesMatch: boolean;
  /** Ids of the members who share it, in the order they were passed in. */
  memberIds: string[];
  /** The individual meeting rows behind it, so a grid can mark exactly those blocks. */
  meetingIds: string[];
}

interface Occurrence {
  memberIndex: number;
  memberId: string;
  meeting: ClassMeeting;
}

/**
 * Classes shared by two or more members of a group, per day.
 *
 * Pairwise `isSameClass` is not transitive — A can overlap B and B overlap C
 * while A and C never meet — so clustering by union-find would happily emit a
 * "shared" class whose intersected window is empty or inverted. Instead each
 * cluster grows from an anchor and a candidate joins only if it still overlaps
 * the *running intersection*, which keeps `startMinute < endMinute` true by
 * construction.
 *
 * Members are scanned in the order given (caller passes the viewer first), so
 * the viewer's own classes anchor their clusters and `memberIds` reads
 * "you, alice, bob" rather than an arbitrary permutation.
 */
export function findGroupSharedClasses(members: GroupMember[]): GroupSharedClass[] {
  if (members.length < 2) return [];

  const days = new Set<number>();
  for (const m of members) for (const c of m.classes) for (const d of c.days) days.add(d);

  const out: GroupSharedClass[] = [];

  for (const day of [...days].sort((a, b) => a - b)) {
    const occurrences: Occurrence[] = [];
    members.forEach((m, memberIndex) => {
      for (const meeting of m.classes) {
        if (meeting.days.includes(day)) {
          occurrences.push({ memberIndex, memberId: m.id, meeting });
        }
      }
    });

    const taken = new Set<number>();

    for (let i = 0; i < occurrences.length; i += 1) {
      if (taken.has(i)) continue;
      const anchor = occurrences[i];

      const cluster = [anchor];
      const seenMembers = new Set([anchor.memberIndex]);
      let start = anchor.meeting.startMinute;
      let end = anchor.meeting.endMinute;

      for (let j = i + 1; j < occurrences.length; j += 1) {
        if (taken.has(j)) continue;
        const candidate = occurrences[j];
        // One slot per member: a second copy of the same class in one person's
        // own schedule is a data error, not a second person to match against.
        if (seenMembers.has(candidate.memberIndex)) continue;
        if (!isSameClass(anchor.meeting, candidate.meeting)) continue;
        if (!(candidate.meeting.startMinute < end && start < candidate.meeting.endMinute)) continue;

        taken.add(j);
        cluster.push(candidate);
        seenMembers.add(candidate.memberIndex);
        start = Math.max(start, candidate.meeting.startMinute);
        end = Math.min(end, candidate.meeting.endMinute);
      }

      if (cluster.length < 2) continue;
      taken.add(i);

      out.push({
        name: anchor.meeting.name,
        day,
        startMinute: start,
        endMinute: end,
        classStartMinute: anchor.meeting.startMinute,
        classEndMinute: anchor.meeting.endMinute,
        timesMatch: cluster.every(
          (o) =>
            o.meeting.startMinute === anchor.meeting.startMinute &&
            o.meeting.endMinute === anchor.meeting.endMinute
        ),
        memberIds: cluster
          .slice()
          .sort((a, b) => a.memberIndex - b.memberIndex)
          .map((o) => o.memberId),
        meetingIds: cluster.map((o) => o.meeting.id),
      });
    }
  }

  return out.sort((x, y) => x.day - y.day || x.startMinute - y.startMinute);
}
