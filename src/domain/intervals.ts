// src/domain/intervals.ts
//
// Half-open intervals [start, end) on any numeric axis — minutes of a day for
// the weekly compare view, epoch milliseconds for dated availability. One
// implementation of merge, subtract and gap-finding for both, so the two
// matching features cannot disagree about what "free" means.
import type { Interval } from './types';

/** Sorted by start, overlapping or touching intervals joined, empty ones dropped. */
export function mergeIntervals(intervals: readonly Interval[]): Interval[] {
  const sorted = intervals
    .filter((i) => i.end > i.start)
    .map((i) => ({ start: i.start, end: i.end }))
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const merged: Interval[] = [];
  for (const interval of sorted) {
    const last = merged[merged.length - 1];
    if (last && interval.start <= last.end) last.end = Math.max(last.end, interval.end);
    else merged.push(interval);
  }
  return merged;
}

/** Each interval clipped to `window`; whatever falls entirely outside is dropped. */
export function clipIntervals(intervals: readonly Interval[], window: Interval): Interval[] {
  return intervals
    .map((i) => ({ start: Math.max(i.start, window.start), end: Math.min(i.end, window.end) }))
    .filter((i) => i.end > i.start);
}

/** `from` with every part covered by `remove` cut out. Both may be unsorted. */
export function subtractIntervals(from: readonly Interval[], remove: readonly Interval[]): Interval[] {
  const holes = mergeIntervals(remove);
  const out: Interval[] = [];

  for (const source of mergeIntervals(from)) {
    let cursor = source.start;
    for (const hole of holes) {
      if (hole.end <= cursor) continue;
      if (hole.start >= source.end) break;
      if (hole.start > cursor) out.push({ start: cursor, end: hole.start });
      cursor = Math.max(cursor, hole.end);
      if (cursor >= source.end) break;
    }
    if (cursor < source.end) out.push({ start: cursor, end: source.end });
  }

  return out;
}

/**
 * The free gaps inside `window` around `busy`, keeping only gaps at least
 * `minLength` long (inclusive — a gap of exactly minLength counts).
 */
export function gapsWithin(busy: readonly Interval[], window: Interval, minLength = 0): Interval[] {
  const blocks = mergeIntervals(clipIntervals(busy, window));
  const gaps: Interval[] = [];
  let cursor = window.start;

  for (const block of blocks) {
    if (block.start - cursor >= minLength && block.start > cursor) gaps.push({ start: cursor, end: block.start });
    cursor = Math.max(cursor, block.end);
  }
  if (window.end - cursor >= minLength && window.end > cursor) gaps.push({ start: cursor, end: window.end });

  return gaps;
}

/**
 * Whether [start, end) touches any interval in `merged`, which must be the
 * output of mergeIntervals (sorted, non-overlapping). Binary search, because
 * the availability engine asks this once per member per candidate slot.
 */
export function overlapsAny(merged: readonly Interval[], start: number, end: number): boolean {
  let lo = 0;
  let hi = merged.length - 1;
  // The first interval whose end is after `start` is the only one that can overlap.
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (merged[mid].end <= start) lo = mid + 1;
    else hi = mid - 1;
  }
  return lo < merged.length && merged[lo].start < end;
}
