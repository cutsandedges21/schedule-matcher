// src/domain/__tests__/availability.test.ts
import { describe, it, expect } from 'vitest';
import {
  attendanceLabel,
  DEFAULT_PREFERENCES,
  explainNoResult,
  findSlots,
  memberBusy,
  type MemberAvailability,
  type NoResultReason,
  type SlotRequest,
} from '../availability';
import { epochToZoned, formatTimeIn, zonedToEpoch } from '../zonedTime';

const TORONTO = 'America/Toronto';
const h = (hour: number, minute = 0) => hour * 60 + minute;

function member(id: string, over: Partial<MemberAvailability> = {}): MemberAvailability {
  return {
    id,
    label: `@${id}`,
    timezone: TORONTO,
    status: 'shared',
    weekly: [],
    blocks: [],
    events: [],
    preferences: { ...DEFAULT_PREFERENCES },
    ...over,
  };
}

function request(over: Partial<SlotRequest> = {}): SlotRequest {
  return {
    timezone: TORONTO,
    fromDate: '2026-10-19', // a Monday
    toDate: '2026-10-19',
    windowStartMinute: h(9),
    windowEndMinute: h(17),
    durationMinutes: 60,
    stepMinutes: 30,
    mode: 'everyone',
    includeWeekends: true,
    nowMs: Date.parse('2026-10-18T12:00:00Z'),
    ...over,
  };
}

/** "12:00 PM" etc. on the Toronto wall clock. */
const clock = (ms: number) => formatTimeIn(ms, TORONTO);

// A realistic Monday for three students and one who never uploaded:
//   alice (Montreal)   Mon/Wed 10:00–11:30, Tue/Thu 13:00–14:30
//   bob   (Montreal)   Mon/Wed 9:00–10:00, Mon 13:00–16:00
//   cara  (Vancouver)  Mon 8:00–9:00 her time = 11:00–12:00 in Montreal
//   dan                no schedule at all
const alice = member('alice', {
  weekly: [
    { days: [1, 3], startMinute: h(10), endMinute: h(11, 30) },
    { days: [2, 4], startMinute: h(13), endMinute: h(14, 30) },
  ],
});
const bob = member('bob', {
  weekly: [
    { days: [1, 3], startMinute: h(9), endMinute: h(10) },
    { days: [1], startMinute: h(13), endMinute: h(16) },
  ],
});
const cara = member('cara', {
  timezone: 'America/Vancouver',
  weekly: [{ days: [1], startMinute: h(8), endMinute: h(9) }],
});
const dan = member('dan', { status: 'no_schedule' });

describe('findSlots — everyone mode', () => {
  it('finds the hours all three are free, across two time zones', () => {
    const result = findSlots([alice, bob, cara, dan], request());

    expect(result.reason).toBeNull();
    expect(result.fellBack).toBe(false);
    expect(result.suggestions.map((s) => clock(s.start))).toEqual(['12:00 PM', '4:00 PM']);
    for (const slot of result.suggestions) {
      expect(slot.available).toEqual(['alice', 'bob', 'cara']);
      expect(slot.unavailable).toEqual([]);
    }
  });

  it('never counts a member without a schedule as free, and names them', () => {
    const result = findSlots([alice, bob, cara, dan], request());

    expect(result.countedIds).toEqual(['alice', 'bob', 'cara']);
    expect(result.unknownIds).toEqual(['dan']);
    for (const slot of result.suggestions) expect(slot.available).not.toContain('dan');
    expect(attendanceLabel(result.suggestions[0], result.countedIds.length)).toBe('All 3 free');
  });

  it('treats a hidden member the same way: unknown, never free', () => {
    const hidden = member('hana', { status: 'hidden' });
    const result = findSlots([alice, hidden], request());
    expect(result.unknownIds).toEqual(['hana']);
    expect(result.countedIds).toEqual(['alice']);
  });
});

describe('findSlots — no common time', () => {
  it('falls back to the best alternatives and says who cannot make each', () => {
    const result = findSlots([alice, bob, cara], request({ windowEndMinute: h(12) }));

    expect(result.fellBack).toBe(true);
    expect(result.reason).toBe('no_common_time');
    expect(result.everyoneFreeCount).toBe(0);
    expect(result.bestAvailableCount).toBe(2);

    const summary = result.suggestions.map((s) => [clock(s.start), s.unavailable]);
    expect(summary).toEqual([
      ['9:00 AM', ['bob']],
      ['10:00 AM', ['alice']],
    ]);
    expect(attendanceLabel(result.suggestions[0], 3)).toBe('2 of 3 free');
  });

  it('ranks by attendance in "most" mode even when a full-group time exists', () => {
    const result = findSlots([alice, bob, cara], request({ mode: 'most' }));
    expect(result.fellBack).toBe(false);
    expect(result.reason).toBeNull();
    expect(result.suggestions[0].available).toHaveLength(3);
  });

  it('reports nobody_free when every counted member is busy all window', () => {
    const swamped = member('sam', { weekly: [{ days: [1], startMinute: h(8), endMinute: h(18) }] });
    const result = findSlots([swamped], request());
    expect(result.reason).toBe('nobody_free');
    expect(result.suggestions).toEqual([]);
  });
});

describe('findSlots — preferences', () => {
  it('ranks a slot inside everyone’s preferred hours above one outside them', () => {
    const early = member('erin', { preferences: { earliestMinute: h(11), latestMinute: h(21), avoidWeekends: false } });
    const result = findSlots([early], request({ windowStartMinute: h(9), windowEndMinute: h(13), durationMinutes: 60 }));

    expect(clock(result.suggestions[0].start)).toBe('11:00 AM');
    const nine = findSlots([early], request({ windowStartMinute: h(9), windowEndMinute: h(10), durationMinutes: 60 }));
    expect(nine.suggestions[0].preferenceMisses).toEqual([{ memberId: 'erin', reason: 'early' }]);
  });

  it('reads preferences on each member’s own clock', () => {
    const vee = member('vee', { timezone: 'America/Vancouver' });
    // 12:00 in Montreal is 9:00 in Vancouver, exactly the default earliest — not a miss.
    const result = findSlots([vee], request({ windowStartMinute: h(12), windowEndMinute: h(13) }));
    expect(result.suggestions[0].preferenceMisses).toEqual([]);
    // Half an hour earlier is 8:30 for her: too early, though fine on the Montreal clock.
    const earlier = findSlots([vee], request({ windowStartMinute: h(11, 30), windowEndMinute: h(12, 30) }));
    expect(earlier.suggestions[0].preferenceMisses).toEqual([{ memberId: 'vee', reason: 'early' }]);
  });

  it('flags weekends for members who keep them free', () => {
    const weekender = member('wes', { preferences: { ...DEFAULT_PREFERENCES, avoidWeekends: true } });
    const result = findSlots([weekender], request({ fromDate: '2026-10-24', toDate: '2026-10-24' }));
    expect(result.suggestions[0].preferenceMisses).toContainEqual({ memberId: 'wes', reason: 'weekend' });
  });
});

describe('findSlots — schedule sources', () => {
  it('lets a one-off free block cancel a class, and a busy block add one', () => {
    const cancelled = member('cora', {
      weekly: [{ days: [1], startMinute: h(9), endMinute: h(17) }],
      blocks: [
        // The class is off on this Monday afternoon…
        { kind: 'free', start: zonedToEpoch('2026-10-19', h(13), TORONTO), end: zonedToEpoch('2026-10-19', h(17), TORONTO) },
        // …but a dentist appointment takes 14:00–15:00.
        { kind: 'busy', start: zonedToEpoch('2026-10-19', h(14), TORONTO), end: zonedToEpoch('2026-10-19', h(15), TORONTO) },
      ],
    });
    const result = findSlots([cancelled], request());
    expect(result.suggestions.map((s) => clock(s.start))).toEqual(['1:00 PM', '3:00 PM']);
  });

  it('counts a weekly event the member is going to as busy, and can ignore it when rescheduling', () => {
    const start = zonedToEpoch('2026-10-12', h(12), TORONTO);
    const attending = member('evan', {
      events: [
        { start, end: start + 60 * 60_000, timezone: TORONTO, repeatWeeklyUntil: '2026-12-31', eventId: 'standup' },
      ],
    });
    const window = { windowStartMinute: h(12), windowEndMinute: h(13) };

    expect(findSlots([attending], request(window)).reason).toBe('nobody_free');
    const moving = findSlots([attending], request({ ...window, ignoreEventId: 'standup' }));
    expect(clock(moving.suggestions[0].start)).toBe('12:00 PM');
  });
});

describe('time zones and DST', () => {
  it('keeps a weekly class at the same local time across the November change', () => {
    const monday10 = member('mo', { weekly: [{ days: [1], startMinute: h(10), endMinute: h(11) }] });
    const busy = memberBusy(monday10, Date.parse('2026-10-25T00:00:00Z'), Date.parse('2026-11-04T00:00:00Z'));

    expect(busy.map((b) => new Date(b.start).toISOString())).toEqual([
      '2026-10-26T14:00:00.000Z', // 10:00 EDT
      '2026-11-02T15:00:00.000Z', // 10:00 EST
    ]);
  });

  it('moves a Paris class across the Montreal grid when only one side changes clocks', () => {
    // Paris leaves summer time on Oct 25, Montreal on Nov 1: in between, the
    // gap shrinks from 6 hours to 5, and an 18:00 Paris class moves an hour
    // later on the Montreal clock.
    const parisian = member('pia', {
      timezone: 'Europe/Paris',
      weekly: [{ days: [1], startMinute: h(18), endMinute: h(19) }],
    });
    const busy = memberBusy(parisian, Date.parse('2026-10-18T00:00:00Z'), Date.parse('2026-10-28T00:00:00Z'));
    expect(busy.map((b) => epochToZoned(b.start, TORONTO).minute)).toEqual([h(12), h(13)]);
  });

  it('keeps slot lengths exact and counts each start once on the spring-forward night', () => {
    const night = findSlots(
      [member('owl')],
      request({
        fromDate: '2026-03-08',
        toDate: '2026-03-08',
        windowStartMinute: h(1),
        windowEndMinute: h(4),
        durationMinutes: 30,
        nowMs: Date.parse('2026-03-01T00:00:00Z'),
        mode: 'most',
        maxSuggestions: 10,
      })
    );
    // 2:00 and 2:30 do not exist that night; they resolve onto 3:00 and 3:30.
    expect(night.candidateCount).toBe(4);
    for (const slot of night.suggestions) expect(slot.end - slot.start).toBe(30 * 60_000);
  });
});

describe('suggestions', () => {
  it('never overlap, spread across days, and respect the maximum', () => {
    const free = member('fay');
    const result = findSlots(
      [free],
      request({ fromDate: '2026-10-19', toDate: '2026-10-23', mode: 'most', maxSuggestions: 5 })
    );
    expect(result.suggestions).toHaveLength(5);
    const perDay = new Map<string, number>();
    for (const slot of result.suggestions) perDay.set(slot.date, (perDay.get(slot.date) ?? 0) + 1);
    expect(Math.max(...perDay.values())).toBeLessThanOrEqual(2);

    const sorted = [...result.suggestions].sort((a, b) => a.start - b.start);
    for (let i = 1; i < sorted.length; i += 1) expect(sorted[i].start).toBeGreaterThanOrEqual(sorted[i - 1].end);
  });

  it('builds a heat-map grid cell per step with who is free', () => {
    const result = findSlots([alice, bob], request({ windowStartMinute: h(9), windowEndMinute: h(11) }));
    const cells = result.grid[0].cells;
    // 9:00 and 9:30: bob is in class. 10:00 and 10:30: alice is.
    expect(cells.map((c) => c.busy)).toEqual([['bob'], ['bob'], ['alice'], ['alice']]);
    expect(cells.map((c) => c.available.length)).toEqual([1, 1, 1, 1]);

    const lunch = findSlots([alice, bob], request({ windowStartMinute: h(12), windowEndMinute: h(13) }));
    expect(lunch.grid[0].cells.map((c) => c.available)).toEqual([
      ['alice', 'bob'],
      ['alice', 'bob'],
    ]);
  });
});

describe('empty results always carry a reason', () => {
  const cases: Array<[NoResultReason, Partial<SlotRequest>, MemberAvailability[]]> = [
    ['invalid_range', { fromDate: '2026-10-20', toDate: '2026-10-19' }, [alice]],
    ['range_too_long', { fromDate: '2026-10-01', toDate: '2026-12-31' }, [alice]],
    ['window_too_short', { windowStartMinute: h(9), windowEndMinute: h(9, 30) }, [alice]],
    ['no_days', { fromDate: '2026-10-24', toDate: '2026-10-25', includeWeekends: false }, [alice]],
    ['no_members', {}, [dan]],
    ['all_in_past', { nowMs: Date.parse('2026-10-30T00:00:00Z') }, [alice]],
  ];

  for (const [reason, over, members] of cases) {
    it(reason, () => {
      const result = findSlots(members, request(over));
      expect(result.reason).toBe(reason);
      expect(result.suggestions).toEqual([]);
      expect(explainNoResult(reason, { durationMinutes: 60 }).length).toBeGreaterThan(20);
    });
  }
});
