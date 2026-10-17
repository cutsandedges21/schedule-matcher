// src/domain/__tests__/intervals.test.ts
import { describe, it, expect } from 'vitest';
import { clipIntervals, gapsWithin, mergeIntervals, overlapsAny, subtractIntervals } from '../intervals';

const i = (start: number, end: number) => ({ start, end });

describe('mergeIntervals', () => {
  it('sorts, joins overlapping and touching intervals, and drops empty ones', () => {
    expect(mergeIntervals([i(30, 40), i(0, 10), i(10, 20), i(35, 50), i(60, 60)])).toEqual([i(0, 20), i(30, 50)]);
  });

  it('does not mutate its input', () => {
    const input = [i(0, 10), i(5, 15)];
    mergeIntervals(input);
    expect(input).toEqual([i(0, 10), i(5, 15)]);
  });
});

describe('subtractIntervals', () => {
  it('cuts holes out of intervals', () => {
    expect(subtractIntervals([i(0, 100)], [i(10, 20), i(50, 60)])).toEqual([i(0, 10), i(20, 50), i(60, 100)]);
  });

  it('removes an interval that is covered entirely, and trims partial overlaps', () => {
    expect(subtractIntervals([i(10, 20), i(30, 40)], [i(0, 25), i(35, 100)])).toEqual([i(30, 35)]);
  });

  it('leaves untouched intervals alone', () => {
    expect(subtractIntervals([i(0, 10)], [i(20, 30)])).toEqual([i(0, 10)]);
    expect(subtractIntervals([i(0, 10)], [])).toEqual([i(0, 10)]);
  });
});

describe('gapsWithin', () => {
  it('finds the free gaps inside a window, honouring a minimum length', () => {
    expect(gapsWithin([i(10, 20), i(40, 45)], i(0, 60), 15)).toEqual([i(20, 40), i(45, 60)]);
    expect(gapsWithin([i(10, 20), i(40, 45)], i(0, 60), 10)).toEqual([i(0, 10), i(20, 40), i(45, 60)]);
  });

  it('ignores busy time outside the window and returns the whole window when nothing is busy', () => {
    expect(gapsWithin([i(-50, -10), i(70, 90)], i(0, 60))).toEqual([i(0, 60)]);
    expect(gapsWithin([i(-10, 100)], i(0, 60))).toEqual([]);
  });
});

describe('clipIntervals', () => {
  it('clips to the window', () => {
    expect(clipIntervals([i(-5, 5), i(8, 12), i(20, 30)], i(0, 10))).toEqual([i(0, 5), i(8, 10)]);
  });
});

describe('overlapsAny', () => {
  const merged = mergeIntervals([i(10, 20), i(30, 40), i(50, 60)]);

  it('finds an overlap anywhere in the list', () => {
    expect(overlapsAny(merged, 15, 16)).toBe(true);
    expect(overlapsAny(merged, 35, 55)).toBe(true);
    expect(overlapsAny(merged, 0, 11)).toBe(true);
    expect(overlapsAny(merged, 59, 100)).toBe(true);
  });

  it('treats intervals as half-open: touching is not overlapping', () => {
    expect(overlapsAny(merged, 20, 30)).toBe(false);
    expect(overlapsAny(merged, 0, 10)).toBe(false);
    expect(overlapsAny(merged, 60, 70)).toBe(false);
    expect(overlapsAny([], 0, 10)).toBe(false);
  });
});
