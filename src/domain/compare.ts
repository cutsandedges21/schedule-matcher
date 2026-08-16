// src/domain/compare.ts
import { DAY_START_MINUTE, DAY_END_MINUTE, MIN_FREE_MINUTES } from './constants';
import { normalizeClassName } from './text';
import type { ClassMeeting, Interval } from './types';

export interface SharedClass {
  name: string;
  day: number;
  startMinute: number;
  endMinute: number;
}

/** Same class = same normalized name and genuinely overlapping time. */
export function isSameClass(a: ClassMeeting, b: ClassMeeting): boolean {
  if (normalizeClassName(a.name) !== normalizeClassName(b.name)) return false;
  return a.startMinute < b.endMinute && b.startMinute < a.endMinute;
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
        });
      }
    }
  }

  return shared.sort((x, y) => x.day - y.day || x.startMinute - y.startMinute);
}

/**
 * Free windows on one day where neither student has a class. Bounded by the
 * fixed 08:00–18:00 axis rather than the union of both students' active hours,
 * so "both free 08:00–09:30" is reported even when neither has an early class.
 */
export function computeMutualFree(
  mine: ClassMeeting[],
  theirs: ClassMeeting[],
  day: number
): Interval[] {
  const busy = [...mine, ...theirs]
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
