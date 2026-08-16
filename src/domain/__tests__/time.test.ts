// src/domain/__tests__/time.test.ts
import { describe, it, expect } from 'vitest';
import { parseTimeToMinutes, formatMinutes, formatHourLabel } from '../time';

describe('parseTimeToMinutes', () => {
  it('parses 12-hour times with a meridiem', () => {
    expect(parseTimeToMinutes('10:00 AM')).toBe(600);
    expect(parseTimeToMinutes('10:00am')).toBe(600);
    expect(parseTimeToMinutes('1:15p')).toBe(795);
    expect(parseTimeToMinutes('9:05 PM')).toBe(1265);
    expect(parseTimeToMinutes('8 a.m.')).toBe(480);
  });

  it('handles the 12 o clock edge cases', () => {
    expect(parseTimeToMinutes('12:00 AM')).toBe(0);
    expect(parseTimeToMinutes('12:00 PM')).toBe(720);
    expect(parseTimeToMinutes('12:30 AM')).toBe(30);
  });

  it('parses 24-hour times', () => {
    expect(parseTimeToMinutes('13:00')).toBe(780);
    expect(parseTimeToMinutes('08:05')).toBe(485);
    expect(parseTimeToMinutes('00:00')).toBe(0);
  });

  it('returns null for input it cannot trust', () => {
    expect(parseTimeToMinutes('')).toBeNull();
    expect(parseTimeToMinutes('noon')).toBeNull();
    expect(parseTimeToMinutes('25:00')).toBeNull();
    expect(parseTimeToMinutes('10:75')).toBeNull();
    expect(parseTimeToMinutes('13:00 PM')).toBeNull();
    expect(parseTimeToMinutes('1300')).toBeNull();
  });
});

describe('formatMinutes', () => {
  it('renders 12-hour clock time', () => {
    expect(formatMinutes(600)).toBe('10:00 AM');
    expect(formatMinutes(795)).toBe('1:15 PM');
    expect(formatMinutes(0)).toBe('12:00 AM');
    expect(formatMinutes(720)).toBe('12:00 PM');
    expect(formatMinutes(1440)).toBe('12:00 AM');
  });
});

describe('formatHourLabel', () => {
  it('renders a compact axis label', () => {
    expect(formatHourLabel(480)).toBe('8 AM');
    expect(formatHourLabel(720)).toBe('12 PM');
    expect(formatHourLabel(1080)).toBe('6 PM');
  });
});
