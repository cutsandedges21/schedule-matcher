// src/domain/__tests__/events.test.ts
import { describe, it, expect } from 'vitest';
import {
  attendanceSummary,
  canManageEvent,
  draftToInstants,
  expandOccurrences,
  groupByDate,
  isWebUrl,
  occurrencesInRange,
  validateEventDraft,
  type EventDraft,
  type SpaceEvent,
} from '../events';
import { zonedToEpoch } from '../zonedTime';

const TORONTO = 'America/Toronto';
const iso = (ms: number) => new Date(ms).toISOString();

function event(over: Partial<SpaceEvent> = {}): SpaceEvent {
  const startsAt = zonedToEpoch('2026-10-22', 15 * 60, TORONTO);
  return {
    id: 'e1',
    spaceId: 's1',
    title: 'Group meeting',
    description: null,
    location: null,
    meetingUrl: null,
    startsAt,
    endsAt: startsAt + 60 * 60_000,
    timezone: TORONTO,
    repeatWeeklyUntil: null,
    status: 'confirmed',
    organizerId: 'u1',
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
    attendees: [],
    ...over,
  };
}

describe('expandOccurrences', () => {
  it('returns a one-off event only when it overlaps the range', () => {
    const e = event();
    expect(expandOccurrences(e, e.startsAt - 1, e.startsAt + 1)).toHaveLength(1);
    expect(expandOccurrences(e, e.endsAt, e.endsAt + 1000)).toHaveLength(0);
  });

  it('repeats weekly on the local clock across the November change, through the last date inclusive', () => {
    const weekly = event({ repeatWeeklyUntil: '2026-11-12' });
    const occurrences = expandOccurrences(weekly, Date.parse('2026-10-01T00:00:00Z'), Date.parse('2027-01-01T00:00:00Z'));
    expect(occurrences.map((o) => iso(o.start))).toEqual([
      '2026-10-22T19:00:00.000Z', // 15:00 EDT
      '2026-10-29T19:00:00.000Z',
      '2026-11-05T20:00:00.000Z', // 15:00 EST
      '2026-11-12T20:00:00.000Z',
    ]);
    for (const o of occurrences) expect(o.end - o.start).toBe(60 * 60_000);
  });

  it('starts deep inside a long series without walking every earlier week', () => {
    const weekly = event({ repeatWeeklyUntil: '2027-06-30' });
    // Montreal moves to summer time on 2027-03-14, between these two Thursdays.
    const occurrences = expandOccurrences(weekly, Date.parse('2027-03-08T00:00:00Z'), Date.parse('2027-03-22T00:00:00Z'));
    expect(occurrences.map((o) => iso(o.start))).toEqual(['2027-03-11T20:00:00.000Z', '2027-03-18T19:00:00.000Z']);
  });
});

describe('occurrencesInRange / groupByDate', () => {
  it('sorts occurrences and groups them by local start date', () => {
    const a = event({ id: 'a', repeatWeeklyUntil: '2026-10-29' });
    const b = event({ id: 'b', startsAt: zonedToEpoch('2026-10-22', 9 * 60, TORONTO), endsAt: zonedToEpoch('2026-10-22', 10 * 60, TORONTO) });
    const list = occurrencesInRange([a, b], Date.parse('2026-10-20T00:00:00Z'), Date.parse('2026-11-01T00:00:00Z'));
    expect(list.map((o) => o.event.id)).toEqual(['b', 'a', 'a']);
    expect(groupByDate(list, TORONTO).map((g) => [g.date, g.items.length])).toEqual([
      ['2026-10-22', 2],
      ['2026-10-29', 1],
    ]);
  });
});

describe('attendance and permissions', () => {
  it('summarises responses', () => {
    expect(
      attendanceSummary([
        { userId: 'a', response: 'going', respondedAt: null },
        { userId: 'b', response: 'going', respondedAt: null },
        { userId: 'c', response: 'declined', respondedAt: null },
        { userId: 'd', response: 'pending', respondedAt: null },
      ])
    ).toEqual({ going: 2, maybe: 0, declined: 1, pending: 1 });
  });

  it('lets the organizer and managers manage an event', () => {
    expect(canManageEvent({ organizerId: 'u1' }, 'u1', 'member')).toBe(true);
    expect(canManageEvent({ organizerId: 'u1' }, 'u2', 'member')).toBe(false);
    expect(canManageEvent({ organizerId: 'u1' }, 'u2', 'admin')).toBe(true);
    expect(canManageEvent({ organizerId: null }, 'u2', 'owner')).toBe(true);
  });
});

describe('drafts', () => {
  const now = Date.parse('2026-10-18T12:00:00Z');
  const draft: EventDraft = {
    title: 'Study session',
    description: '',
    location: 'Library',
    meetingUrl: '',
    date: '2026-10-22',
    startMinute: 15 * 60,
    endMinute: 16 * 60,
    timezone: TORONTO,
    repeatWeekly: false,
    repeatUntil: '',
  };

  it('accepts a normal draft and converts it on the event’s clock', () => {
    expect(validateEventDraft(draft, now)).toEqual({});
    const { startsAt, endsAt } = draftToInstants(draft);
    expect([iso(startsAt), iso(endsAt)]).toEqual(['2026-10-22T19:00:00.000Z', '2026-10-22T20:00:00.000Z']);
  });

  it('reads an end before the start as running past midnight', () => {
    const late = { ...draft, startMinute: 22 * 60, endMinute: 60 };
    const { startsAt, endsAt } = draftToInstants(late);
    expect((endsAt - startsAt) / 60_000).toBe(180);
    expect(validateEventDraft(late, now)).toEqual({});
  });

  it('catches the mistakes the database would refuse', () => {
    expect(validateEventDraft({ ...draft, title: ' ' }, now).title).toBeDefined();
    expect(validateEventDraft({ ...draft, endMinute: draft.startMinute }, now).endMinute).toBeDefined();
    expect(validateEventDraft({ ...draft, meetingUrl: 'zoom.us/j/1' }, now).meetingUrl).toBeDefined();
    expect(validateEventDraft({ ...draft, date: '2026-10-01' }, now).date).toMatch(/passed/);
    expect(validateEventDraft({ ...draft, repeatWeekly: true, repeatUntil: '2026-10-01' }, now).repeatUntil).toBeDefined();
    expect(validateEventDraft({ ...draft, repeatWeekly: true, repeatUntil: '2028-01-01' }, now).repeatUntil).toMatch(/year/);
    expect(validateEventDraft({ ...draft, timezone: 'Nowhere/Land' }, now).timezone).toBeDefined();
  });

  it('accepts only http(s) links with a host', () => {
    expect(isWebUrl('https://meet.google.com/abc-defg-hij')).toBe(true);
    expect(isWebUrl('http://example.com')).toBe(true);
    expect(isWebUrl('javascript:alert(1)')).toBe(false);
    expect(isWebUrl('https://')).toBe(false);
    expect(isWebUrl('ftp://example.com')).toBe(false);
  });
});
