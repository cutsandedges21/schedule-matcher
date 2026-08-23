// src/domain/__tests__/gridTime.test.ts
import { describe, it, expect } from 'vitest';
import { minuteFromOffset, NEW_CLASS_DURATION_MINUTES } from '../gridTime';

// The default axis: 08:00 (480) to 18:00 (1080), 600 minutes over 640px.
const axis = { startMinute: 480, endMinute: 1080 };

describe('minuteFromOffset', () => {
  it('maps the very top of the grid to the axis start', () => {
    expect(minuteFromOffset(0, axis)).toBe(480);
  });

  it('maps one hour down to one hour later', () => {
    expect(minuteFromOffset(64, axis)).toBe(540);
  });

  it('snaps down to the nearest half hour', () => {
    // 40px = 37.5 minutes past 08:00 -> 08:30, not 08:37.
    expect(minuteFromOffset(40, axis)).toBe(510);
  });

  it('snaps a position just short of the half hour down to the hour', () => {
    // 31px = 29 minutes past 08:00 -> 08:00.
    expect(minuteFromOffset(31, axis)).toBe(480);
  });

  it('clamps a negative offset to the axis start', () => {
    expect(minuteFromOffset(-50, axis)).toBe(480);
  });

  it('leaves room for the default duration at the bottom of the axis', () => {
    // The last usable start is 1080 - 50 = 1030, snapped down to 1020 (17:00).
    expect(minuteFromOffset(640, axis)).toBe(1020);
  });

  it('clamps an offset past the bottom of the grid the same way', () => {
    expect(minuteFromOffset(5000, axis)).toBe(1020);
  });

  it('respects an axis extended by an early class', () => {
    const early = { startMinute: 420, endMinute: 1080 };
    expect(minuteFromOffset(0, early)).toBe(420);
    expect(minuteFromOffset(64, early)).toBe(480);
  });

  it('never returns a start that would push the class past the axis end', () => {
    for (const offset of [600, 620, 640, 700]) {
      expect(minuteFromOffset(offset, axis) + NEW_CLASS_DURATION_MINUTES).toBeLessThanOrEqual(1080);
    }
  });
});
