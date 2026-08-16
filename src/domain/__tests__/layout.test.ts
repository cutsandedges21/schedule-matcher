// src/domain/__tests__/layout.test.ts
import { describe, it, expect } from 'vitest';
import { computeAxis, computeLayout } from '../layout';
import { DAY_START_MINUTE, DAY_END_MINUTE } from '../constants';
import type { ClassMeeting } from '../types';

function meeting(over: Partial<ClassMeeting> = {}): ClassMeeting {
  return {
    id: over.id ?? 'c1',
    name: over.name ?? 'BIO 101',
    instructor: null,
    room: null,
    courseCode: null,
    section: null,
    days: over.days ?? [1],
    startMinute: over.startMinute ?? 600,
    endMinute: over.endMinute ?? 650,
    color: 'indigo',
    ...over,
  };
}

describe('computeAxis', () => {
  it('uses the fixed 08:00-18:00 window when everything fits', () => {
    expect(computeAxis([meeting()])).toEqual({
      startMinute: DAY_START_MINUTE,
      endMinute: DAY_END_MINUTE,
    });
  });

  it('uses the fixed window for an empty schedule', () => {
    expect(computeAxis([])).toEqual({
      startMinute: DAY_START_MINUTE,
      endMinute: DAY_END_MINUTE,
    });
  });

  it('extends downward to the hour for an early class', () => {
    const axis = computeAxis([meeting({ startMinute: 435, endMinute: 500 })]);
    expect(axis.startMinute).toBe(420);
    expect(axis.endMinute).toBe(DAY_END_MINUTE);
  });

  it('extends upward to the hour for a night class', () => {
    const axis = computeAxis([meeting({ startMinute: 1140, endMinute: 1265 })]);
    expect(axis.startMinute).toBe(DAY_START_MINUTE);
    expect(axis.endMinute).toBe(1320);
  });

  it('extends in both directions across several classes', () => {
    const axis = computeAxis([
      meeting({ id: 'a', startMinute: 420, endMinute: 470 }),
      meeting({ id: 'b', startMinute: 1100, endMinute: 1200 }),
    ]);
    expect(axis).toEqual({ startMinute: 420, endMinute: 1200 });
  });
});

describe('computeLayout', () => {
  const axis = { startMinute: DAY_START_MINUTE, endMinute: DAY_END_MINUTE };

  it('places a block proportionally in the window', () => {
    const [block] = computeLayout([meeting({ startMinute: 480, endMinute: 540 })], [1], axis);
    expect(block.topPct).toBeCloseTo(0);
    expect(block.heightPct).toBeCloseTo(10);
  });

  it('emits one block per weekday the class meets', () => {
    const blocks = computeLayout([meeting({ days: [1, 3, 5] })], [1, 2, 3, 4, 5], axis);
    expect(blocks).toHaveLength(3);
    expect(blocks.map((b) => b.day).sort()).toEqual([1, 3, 5]);
  });

  it('ignores classes that do not meet on the requested days', () => {
    expect(computeLayout([meeting({ days: [6] })], [1, 2, 3, 4, 5], axis)).toHaveLength(0);
  });

  it('gives non-overlapping blocks a single full-width lane', () => {
    const blocks = computeLayout(
      [
        meeting({ id: 'a', startMinute: 480, endMinute: 540 }),
        meeting({ id: 'b', startMinute: 540, endMinute: 600 }),
      ],
      [1],
      axis
    );
    expect(blocks.every((b) => b.laneCount === 1 && b.lane === 0)).toBe(true);
  });

  it('splits overlapping blocks into side-by-side lanes', () => {
    const blocks = computeLayout(
      [
        meeting({ id: 'a', startMinute: 480, endMinute: 600 }),
        meeting({ id: 'b', startMinute: 540, endMinute: 660 }),
      ],
      [1],
      axis
    );
    expect(blocks.every((b) => b.laneCount === 2)).toBe(true);
    expect(blocks.map((b) => b.lane).sort()).toEqual([0, 1]);
  });

  it('keeps a class outside the fixed window visible when the axis is extended', () => {
    const nightAxis = { startMinute: DAY_START_MINUTE, endMinute: 1320 };
    const [block] = computeLayout(
      [meeting({ startMinute: 1140, endMinute: 1260 })],
      [1],
      nightAxis
    );
    expect(block).toBeDefined();
    expect(block.topPct).toBeGreaterThan(0);
    expect(block.topPct + block.heightPct).toBeLessThanOrEqual(100.0001);
  });
});
