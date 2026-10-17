// src/domain/__tests__/zonedTime.test.ts
import { describe, it, expect } from 'vitest';
import {
  addDays,
  daysBetween,
  eachDateKey,
  epochToZoned,
  formatDateKey,
  formatRangeIn,
  formatTimeIn,
  isDateKey,
  isoWeekday,
  isValidTimeZone,
  offsetMinutesAt,
  parseTimeInput,
  startOfWeek,
  toTimeInput,
  zonedToEpoch,
} from '../zonedTime';

const iso = (ms: number) => new Date(ms).toISOString();

describe('calendar arithmetic', () => {
  it('adds days across month and year ends without a zone', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
  });

  it('numbers weekdays the ISO way the schedule does (Mon = 1, Sun = 7)', () => {
    expect(isoWeekday('2026-10-19')).toBe(1);
    expect(isoWeekday('2026-10-25')).toBe(7);
  });

  it('walks a range inclusively and finds the Monday of a week', () => {
    expect(eachDateKey('2026-10-30', '2026-11-02')).toEqual([
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
    ]);
    expect(eachDateKey('2026-11-02', '2026-11-01')).toEqual([]);
    expect(daysBetween('2026-10-01', '2026-10-31')).toBe(30);
    expect(startOfWeek('2026-10-22')).toBe('2026-10-19');
    expect(startOfWeek('2026-10-19')).toBe('2026-10-19');
    expect(startOfWeek('2026-10-25')).toBe('2026-10-19');
  });

  it('rejects impossible dates', () => {
    expect(isDateKey('2026-02-30')).toBe(false);
    expect(isDateKey('2026-2-3')).toBe(false);
    expect(isDateKey('2026-02-28')).toBe(true);
  });
});

describe('zonedToEpoch / epochToZoned', () => {
  it('converts ordinary times both ways', () => {
    expect(iso(zonedToEpoch('2026-10-20', 9 * 60, 'America/Toronto'))).toBe('2026-10-20T13:00:00.000Z');
    expect(iso(zonedToEpoch('2026-10-20', 9 * 60, 'Asia/Kolkata'))).toBe('2026-10-20T03:30:00.000Z');
    expect(iso(zonedToEpoch('2026-10-20', 9 * 60, 'UTC'))).toBe('2026-10-20T09:00:00.000Z');

    expect(epochToZoned(Date.parse('2026-10-20T13:00:00Z'), 'America/Toronto')).toEqual({
      date: '2026-10-20',
      minute: 540,
      weekday: 2,
    });
  });

  it('keeps a weekly 10:00 class at 10:00 local across the March change', () => {
    // Montreal: EST (UTC-5) on Mar 2, EDT (UTC-4) from Mar 8.
    expect(iso(zonedToEpoch('2026-03-02', 600, 'America/Toronto'))).toBe('2026-03-02T15:00:00.000Z');
    expect(iso(zonedToEpoch('2026-03-09', 600, 'America/Toronto'))).toBe('2026-03-09T14:00:00.000Z');
  });

  it('moves a skipped spring-forward time forward by the gap', () => {
    // 2:30 does not exist in Montreal on 2026-03-08; it becomes 3:30 EDT.
    expect(iso(zonedToEpoch('2026-03-08', 150, 'America/Toronto'))).toBe('2026-03-08T07:30:00.000Z');
    expect(iso(zonedToEpoch('2026-03-08', 210, 'America/Toronto'))).toBe('2026-03-08T07:30:00.000Z');
    expect(iso(zonedToEpoch('2026-03-08', 90, 'America/Toronto'))).toBe('2026-03-08T06:30:00.000Z');
    // Paris skips 2:00–3:00 on 2026-03-29.
    expect(iso(zonedToEpoch('2026-03-29', 150, 'Europe/Paris'))).toBe('2026-03-29T01:30:00.000Z');
    // Sydney skips 2:00–3:00 on 2026-10-04 (southern hemisphere spring).
    expect(iso(zonedToEpoch('2026-10-04', 150, 'Australia/Sydney'))).toBe('2026-10-03T16:30:00.000Z');
  });

  it('resolves a repeated fall-back time to the earlier instant', () => {
    // 1:30 happens twice in Montreal on 2026-11-01: EDT first, then EST.
    expect(iso(zonedToEpoch('2026-11-01', 90, 'America/Toronto'))).toBe('2026-11-01T05:30:00.000Z');
    expect(iso(zonedToEpoch('2026-11-01', 150, 'America/Toronto'))).toBe('2026-11-01T07:30:00.000Z');
    // Paris repeats 2:00–3:00 on 2026-10-25 (east of UTC, the case a naive guess gets wrong).
    expect(iso(zonedToEpoch('2026-10-25', 150, 'Europe/Paris'))).toBe('2026-10-25T00:30:00.000Z');
    // Sydney repeats 2:00–3:00 on 2026-04-05.
    expect(iso(zonedToEpoch('2026-04-05', 150, 'Australia/Sydney'))).toBe('2026-04-04T15:30:00.000Z');
  });

  it('reads midnight at the end of a day as the start of the next', () => {
    expect(iso(zonedToEpoch('2026-10-20', 1440, 'America/Toronto'))).toBe('2026-10-21T04:00:00.000Z');
  });

  it('reports the offset in force at an instant', () => {
    expect(offsetMinutesAt(Date.parse('2026-07-01T12:00:00Z'), 'America/Toronto')).toBe(-240);
    expect(offsetMinutesAt(Date.parse('2026-12-01T12:00:00Z'), 'America/Toronto')).toBe(-300);
    expect(offsetMinutesAt(Date.parse('2026-12-01T12:00:00Z'), 'Asia/Kathmandu')).toBe(345);
  });

  it('round-trips every 15 minutes through a whole fall-back day', () => {
    for (let minute = 0; minute < 1440; minute += 15) {
      const instant = zonedToEpoch('2026-11-01', minute, 'America/Toronto');
      expect(epochToZoned(instant, 'America/Toronto')).toMatchObject({ date: '2026-11-01', minute });
    }
  });
});

describe('formatting', () => {
  it('formats dates without slipping a day in any zone', () => {
    expect(formatDateKey('2026-10-20')).toBe('Tue, Oct 20');
    expect(formatDateKey('2026-10-20', 'long')).toBe('Tuesday, October 20');
  });

  it('formats times and ranges on the zone’s wall clock', () => {
    const start = Date.parse('2026-10-20T18:30:00Z');
    expect(formatTimeIn(start, 'America/Toronto')).toBe('2:30 PM');
    expect(formatRangeIn(start, start + 90 * 60_000, 'America/Toronto')).toBe('Tue, Oct 20 · 2:30 PM – 4:00 PM');
    // Ending exactly at midnight stays on the same day's line.
    expect(formatRangeIn(Date.parse('2026-10-21T02:00:00Z'), Date.parse('2026-10-21T04:00:00Z'), 'America/Toronto')).toBe(
      'Tue, Oct 20 · 10:00 PM – 12:00 AM'
    );
  });
});

describe('inputs and validation', () => {
  it('parses and writes <input type="time"> values', () => {
    expect(parseTimeInput('09:05')).toBe(545);
    expect(parseTimeInput('24:00')).toBeNull();
    expect(parseTimeInput('9:05')).toBeNull();
    expect(toTimeInput(545)).toBe('09:05');
    expect(toTimeInput(1440)).toBe('23:59');
  });

  it('accepts real zones and refuses made-up ones', () => {
    expect(isValidTimeZone('America/Toronto')).toBe(true);
    expect(isValidTimeZone('UTC')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus_Mons')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
    expect(isValidTimeZone('America/Toronto; drop table')).toBe(false);
  });
});
