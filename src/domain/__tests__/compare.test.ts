// src/domain/__tests__/compare.test.ts
import { describe, it, expect } from 'vitest';
import { findSharedClasses, computeMutualFree, isSameClass } from '../compare';
import { DAY_START_MINUTE, DAY_END_MINUTE } from '../constants';
import type { ClassMeeting } from '../types';

function meeting(over: Partial<ClassMeeting> = {}): ClassMeeting {
  return {
    id: 'c1', name: 'BIO 101', instructor: null, room: null,
    courseCode: null, section: null,
    days: [1], startMinute: 600, endMinute: 650, color: 'indigo',
    ...over,
  };
}

describe('isSameClass', () => {
  it('matches on normalized name and overlapping time', () => {
    expect(isSameClass(meeting(), meeting({ id: 'x', name: 'bio-101' }))).toBe(true);
  });

  it('rejects the same name at a non-overlapping time', () => {
    expect(isSameClass(meeting(), meeting({ id: 'x', startMinute: 700, endMinute: 750 }))).toBe(false);
  });

  it('rejects different names at the same time', () => {
    expect(isSameClass(meeting(), meeting({ id: 'x', name: 'MATH 220' }))).toBe(false);
  });

  it('treats back-to-back classes as non-overlapping', () => {
    expect(isSameClass(
      meeting({ startMinute: 600, endMinute: 650 }),
      meeting({ id: 'x', startMinute: 650, endMinute: 700 })
    )).toBe(false);
  });

  it('matches on course code + section, case-insensitively, even with different truncated names', () => {
    expect(isSameClass(
      meeting({ name: 'Program Development', courseCode: '420-SF3-RE', section: '00001' }),
      meeting({ id: 'x', name: 'Program Dev (cont.)', courseCode: '420-sf3-re', section: '00001' })
    )).toBe(true);
  });

  it('rejects the same course code in different sections — same course, different class', () => {
    expect(isSameClass(
      meeting({ name: 'Program Development', courseCode: '420-SF3-RE', section: '00001' }),
      meeting({ id: 'x', name: 'Program Development', courseCode: '420-SF3-RE', section: '00002' })
    )).toBe(false);
  });

  it('still requires overlapping time when course code and section both match', () => {
    expect(isSameClass(
      meeting({ courseCode: '420-SF3-RE', section: '00001', startMinute: 600, endMinute: 650 }),
      meeting({ id: 'x', courseCode: '420-SF3-RE', section: '00001', startMinute: 700, endMinute: 750 })
    )).toBe(false);
  });

  it('falls back to name comparison when one side has no course code', () => {
    expect(isSameClass(
      meeting({ name: 'BIO 101', courseCode: '420-SF3-RE', section: '00001' }),
      meeting({ id: 'x', name: 'bio-101', courseCode: null, section: null })
    )).toBe(true);
  });

  it('falls back to name comparison and still rejects a real mismatch when one side has no course code', () => {
    expect(isSameClass(
      meeting({ name: 'BIO 101', courseCode: '420-SF3-RE', section: '00001' }),
      meeting({ id: 'x', name: 'MATH 220', courseCode: null, section: null })
    )).toBe(false);
  });

  it('behaves exactly as today (name-based) when neither side has a course code', () => {
    expect(isSameClass(
      meeting({ name: 'BIO 101', courseCode: null, section: null }),
      meeting({ id: 'x', name: 'bio 101', courseCode: null, section: null })
    )).toBe(true);
    expect(isSameClass(
      meeting({ name: 'BIO 101', courseCode: null, section: null }),
      meeting({ id: 'x', name: 'MATH 220', courseCode: null, section: null })
    )).toBe(false);
  });
});

describe('findSharedClasses', () => {
  it('finds a class two students share on the days both attend', () => {
    const shared = findSharedClasses(
      [meeting({ days: [1, 3, 5] })],
      [meeting({ id: 'x', name: 'bio 101', days: [1, 3] })]
    );
    expect(shared.map((s) => s.day)).toEqual([1, 3]);
    expect(shared[0].name).toBe('BIO 101');
  });

  it('returns nothing when there is no overlap', () => {
    expect(findSharedClasses([meeting()], [meeting({ id: 'x', name: 'MATH 220' })])).toEqual([]);
  });

  it('returns nothing when one schedule is empty', () => {
    expect(findSharedClasses([meeting()], [])).toEqual([]);
    expect(findSharedClasses([], [meeting()])).toEqual([]);
  });
});

describe('computeMutualFree', () => {
  it('returns the whole window when neither student has a class', () => {
    expect(computeMutualFree([], [], 1)).toEqual([
      { start: DAY_START_MINUTE, end: DAY_END_MINUTE },
    ]);
  });

  it('finds the gap between two students classes', () => {
    const free = computeMutualFree(
      [meeting({ startMinute: 480, endMinute: 600 })],
      [meeting({ id: 'x', name: 'MATH 220', startMinute: 720, endMinute: 780 })],
      1
    );
    expect(free).toEqual([
      { start: 600, end: 720 },
      { start: 780, end: DAY_END_MINUTE },
    ]);
  });

  it('merges overlapping busy blocks from both students', () => {
    const free = computeMutualFree(
      [meeting({ startMinute: 480, endMinute: 660 })],
      [meeting({ id: 'x', name: 'MATH 220', startMinute: 600, endMinute: 720 })],
      1
    );
    expect(free).toEqual([{ start: 720, end: DAY_END_MINUTE }]);
  });

  it('discards gaps shorter than the 30 minute floor', () => {
    const free = computeMutualFree(
      [meeting({ startMinute: 480, endMinute: 600 })],
      [meeting({ id: 'x', name: 'MATH 220', startMinute: 620, endMinute: 1080 })],
      1
    );
    expect(free).toEqual([]);
  });

  it('keeps a gap exactly at the 30 minute floor', () => {
    const free = computeMutualFree(
      [meeting({ startMinute: 480, endMinute: 600 })],
      [meeting({ id: 'x', name: 'MATH 220', startMinute: 630, endMinute: 1080 })],
      1
    );
    expect(free).toEqual([{ start: 600, end: 630 }]);
  });

  it('reports leading free time before anyone has a class', () => {
    const free = computeMutualFree([meeting({ startMinute: 600, endMinute: 1080 })], [], 1);
    expect(free).toEqual([{ start: DAY_START_MINUTE, end: 600 }]);
  });

  it('clips classes that start before or end after the window', () => {
    const free = computeMutualFree([meeting({ startMinute: 420, endMinute: 540 })], [], 1);
    expect(free).toEqual([{ start: 540, end: DAY_END_MINUTE }]);
  });

  it('ignores classes on other days', () => {
    expect(computeMutualFree([meeting({ days: [2] })], [], 1)).toEqual([
      { start: DAY_START_MINUTE, end: DAY_END_MINUTE },
    ]);
  });
});
