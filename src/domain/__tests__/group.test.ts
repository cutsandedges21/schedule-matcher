// src/domain/__tests__/group.test.ts
import { describe, it, expect } from 'vitest';
import { computeGroupFree, findGroupSharedClasses, type GroupMember } from '../compare';
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

function member(id: string, classes: ClassMeeting[]): GroupMember {
  return { id, classes };
}

describe('computeGroupFree', () => {
  it('returns the whole window for a group with no classes at all', () => {
    expect(computeGroupFree([[], [], []], 1)).toEqual([
      { start: DAY_START_MINUTE, end: DAY_END_MINUTE },
    ]);
  });

  it('returns the whole window when the group is empty', () => {
    expect(computeGroupFree([], 1)).toEqual([
      { start: DAY_START_MINUTE, end: DAY_END_MINUTE },
    ]);
  });

  it('subtracts every member busy block, not just the first two', () => {
    const free = computeGroupFree(
      [
        [meeting({ startMinute: 480, endMinute: 600 })],
        [meeting({ id: 'b', name: 'MATH 220', startMinute: 600, endMinute: 720 })],
        [meeting({ id: 'c', name: 'CHEM 110', startMinute: 800, endMinute: 900 })],
      ],
      1
    );
    expect(free).toEqual([
      { start: 720, end: 800 },
      { start: 900, end: DAY_END_MINUTE },
    ]);
  });

  it('narrows as members are added — a fourth person can erase the last window', () => {
    const three = computeGroupFree(
      [
        [meeting({ startMinute: 480, endMinute: 600 })],
        [meeting({ id: 'b', name: 'MATH 220', startMinute: 600, endMinute: 720 })],
        [meeting({ id: 'c', name: 'CHEM 110', startMinute: 780, endMinute: 1080 })],
      ],
      1
    );
    expect(three).toEqual([{ start: 720, end: 780 }]);

    const four = computeGroupFree(
      [
        [meeting({ startMinute: 480, endMinute: 600 })],
        [meeting({ id: 'b', name: 'MATH 220', startMinute: 600, endMinute: 720 })],
        [meeting({ id: 'c', name: 'CHEM 110', startMinute: 780, endMinute: 1080 })],
        [meeting({ id: 'd', name: 'ART 101', startMinute: 700, endMinute: 800 })],
      ],
      1
    );
    expect(four).toEqual([]);
  });

  it('ignores members classes on other days', () => {
    expect(computeGroupFree([[meeting({ days: [2] })], [meeting({ id: 'b', days: [3] })]], 1)).toEqual([
      { start: DAY_START_MINUTE, end: DAY_END_MINUTE },
    ]);
  });

  it('honours the 30 minute floor across the whole group', () => {
    const free = computeGroupFree(
      [
        [meeting({ startMinute: 480, endMinute: 600 })],
        [meeting({ id: 'b', name: 'MATH 220', startMinute: 620, endMinute: 1080 })],
      ],
      1
    );
    expect(free).toEqual([]);
  });
});

describe('findGroupSharedClasses', () => {
  it('reports a class every member has, with all their ids', () => {
    const shared = findGroupSharedClasses([
      member('me', [meeting({ id: 'm1', days: [1, 3] })]),
      member('alice', [meeting({ id: 'a1', name: 'bio-101', days: [1, 3] })]),
      member('bob', [meeting({ id: 'b1', name: 'BIO 101', days: [1] })]),
    ]);

    expect(shared).toHaveLength(2);
    expect(shared[0].day).toBe(1);
    expect(shared[0].memberIds).toEqual(['me', 'alice', 'bob']);
    expect(shared[1].day).toBe(3);
    expect(shared[1].memberIds).toEqual(['me', 'alice']);
  });

  it('reports a class shared by a subset that does not include me', () => {
    const shared = findGroupSharedClasses([
      member('me', [meeting({ id: 'm1', name: 'MATH 220' })]),
      member('alice', [meeting({ id: 'a1', name: 'BIO 101' })]),
      member('bob', [meeting({ id: 'b1', name: 'bio 101' })]),
    ]);

    expect(shared).toHaveLength(1);
    expect(shared[0].memberIds).toEqual(['alice', 'bob']);
    expect(shared[0].name).toBe('BIO 101');
  });

  it('ignores a class only one member has', () => {
    expect(
      findGroupSharedClasses([
        member('me', [meeting({ name: 'BIO 101' })]),
        member('alice', [meeting({ id: 'a1', name: 'MATH 220' })]),
      ])
    ).toEqual([]);
  });

  it('returns the intersected window, not either members full block', () => {
    const shared = findGroupSharedClasses([
      member('me', [meeting({ id: 'm1', startMinute: 600, endMinute: 700 })]),
      member('alice', [meeting({ id: 'a1', startMinute: 630, endMinute: 720 })]),
    ]);

    expect(shared[0].startMinute).toBe(630);
    expect(shared[0].endMinute).toBe(700);
  });

  it('never produces an empty or inverted window when members only chain-overlap', () => {
    // me 9:00-11:00, alice 8:00-9:30, bob 10:30-12:00. Alice and Bob each
    // overlap me but not each other; naively intersecting all three gives
    // 10:30-9:30, which is nonsense.
    const shared = findGroupSharedClasses([
      member('me', [meeting({ id: 'm1', startMinute: 540, endMinute: 660 })]),
      member('alice', [meeting({ id: 'a1', startMinute: 480, endMinute: 570 })]),
      member('bob', [meeting({ id: 'b1', startMinute: 630, endMinute: 720 })]),
    ]);

    for (const entry of shared) {
      expect(entry.endMinute).toBeGreaterThan(entry.startMinute);
    }
  });

  it('separates sections: same course code, different section is not a shared class', () => {
    expect(
      findGroupSharedClasses([
        member('me', [meeting({ id: 'm1', courseCode: '420-SF3-RE', section: '00001' })]),
        member('alice', [meeting({ id: 'a1', courseCode: '420-SF3-RE', section: '00002' })]),
      ])
    ).toEqual([]);
  });

  it('carries the meeting ids so the grid can mark exactly those blocks', () => {
    const shared = findGroupSharedClasses([
      member('me', [meeting({ id: 'm1' })]),
      member('alice', [meeting({ id: 'a1', name: 'bio 101' })]),
    ]);
    expect(shared[0].meetingIds.sort()).toEqual(['a1', 'm1']);
  });

  it('sorts by day, then by start time', () => {
    const shared = findGroupSharedClasses([
      member('me', [
        meeting({ id: 'm1', name: 'BIO 101', days: [3], startMinute: 600, endMinute: 660 }),
        meeting({ id: 'm2', name: 'MATH 220', days: [1], startMinute: 800, endMinute: 860 }),
        meeting({ id: 'm3', name: 'CHEM 110', days: [1], startMinute: 500, endMinute: 560 }),
      ]),
      member('alice', [
        meeting({ id: 'a1', name: 'BIO 101', days: [3], startMinute: 600, endMinute: 660 }),
        meeting({ id: 'a2', name: 'MATH 220', days: [1], startMinute: 800, endMinute: 860 }),
        meeting({ id: 'a3', name: 'CHEM 110', days: [1], startMinute: 500, endMinute: 560 }),
      ]),
    ]);

    expect(shared.map((s) => [s.day, s.startMinute])).toEqual([
      [1, 500],
      [1, 800],
      [3, 600],
    ]);
  });

  it('returns nothing for a single member', () => {
    expect(findGroupSharedClasses([member('me', [meeting()])])).toEqual([]);
  });
});
