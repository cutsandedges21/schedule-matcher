// src/domain/__tests__/planMappers.test.ts
import { describe, it, expect } from 'vitest';
import { availabilityToMembers, jsonToPollResults, rowToEvent, rowToPoll, rowToTask } from '../planMappers';
import { DEFAULT_PREFERENCES } from '../availability';

describe('availabilityToMembers', () => {
  const rows = [
    {
      user_id: 'me',
      share_level: 'hidden',
      timezone: 'America/Toronto',
      has_schedule: true,
      preferences: null,
      classes: [{ days: [1], start_minute: 600, end_minute: 660, name: 'BIO 101' }],
      blocks: [],
      events: [],
    },
    { user_id: 'shy', share_level: 'hidden' },
    { user_id: 'new', share_level: 'busy', timezone: 'Europe/Paris', has_schedule: false, classes: [], blocks: [], events: [] },
    {
      user_id: 'bob',
      share_level: 'busy',
      timezone: 'America/Vancouver',
      has_schedule: true,
      preferences: { earliest_minute: 600, latest_minute: 1200, avoid_weekends: true },
      classes: [],
      blocks: [{ kind: 'free', starts_at: '2026-10-20T14:00:00Z', ends_at: '2026-10-20T15:00:00Z', label: null }],
      events: [
        { starts_at: '2026-10-21T18:00:00Z', ends_at: '2026-10-21T19:00:00Z', timezone: 'UTC', repeat_weekly_until: null, event_id: null, title: null },
      ],
    },
  ];

  const members = availabilityToMembers(rows, 'me', (id) => `@${id}`);

  it('counts the viewer even when they hide, and nobody else who hides or has no schedule', () => {
    expect(members.map((m) => [m.id, m.status])).toEqual([
      ['me', 'shared'],
      ['shy', 'hidden'],
      ['new', 'no_schedule'],
      ['bob', 'shared'],
    ]);
  });

  it('converts times to instants and fills default preferences', () => {
    const bob = members[3];
    expect(bob.blocks[0]).toEqual({ kind: 'free', start: Date.parse('2026-10-20T14:00:00Z'), end: Date.parse('2026-10-20T15:00:00Z'), label: null });
    expect(bob.events[0].start).toBe(Date.parse('2026-10-21T18:00:00Z'));
    expect(bob.preferences).toEqual({ earliestMinute: 600, latestMinute: 1200, avoidWeekends: true });
    expect(members[0].preferences).toEqual(DEFAULT_PREFERENCES);
    expect(members[1].timezone).toBe('America/Toronto');
  });
});

describe('row mappers', () => {
  it('maps an event with its attendees', () => {
    const event = rowToEvent({
      id: 'e', space_id: 's', title: 'T', description: null, location: null, meeting_url: null,
      starts_at: '2026-10-22T19:00:00Z', ends_at: '2026-10-22T20:00:00Z', timezone: 'America/Toronto',
      repeat_weekly_until: null, status: 'confirmed', organizer_id: 'u', poll_id: null,
      created_at: 'c', updated_at: 'u', event_attendees: [{ user_id: 'u', response: 'going', responded_at: null }],
      space: { name: 'Club' },
    });
    expect(event.startsAt).toBe(Date.parse('2026-10-22T19:00:00Z'));
    expect(event.attendees).toEqual([{ userId: 'u', response: 'going', respondedAt: null }]);
    expect(event.spaceName).toBe('Club');
  });

  it('maps a task and a poll, ordering options by position', () => {
    const t = rowToTask({
      id: 't', space_id: 's', parent_id: null, is_assignment: true, title: 'Report', description: null, status: 'todo',
      priority: 'high', due_at: null, event_id: null, link_url: null, created_by: 'u', created_at: 'c', updated_at: 'u',
      completed_at: null, completed_by: null, task_assignees: [{ user_id: 'a' }],
    });
    expect(t.assigneeIds).toEqual(['a']);
    expect(t.dueAt).toBeNull();

    const p = rowToPoll({
      id: 'p', space_id: 's', question: 'Q', description: null, kind: 'general', allow_multiple: false, anonymous: false,
      results_visibility: 'always', deadline: null, duration_minutes: null, timezone: null, closed_at: null, event_id: null,
      created_by: 'u', created_at: 'c',
      poll_options: [
        { id: 'b', label: 'B', starts_at: null, ends_at: null, position: 1 },
        { id: 'a', label: 'A', starts_at: null, ends_at: null, position: 0 },
      ],
    });
    expect(p.options.map((o) => o.id)).toEqual(['a', 'b']);

    expect(
      jsonToPollResults({ visible: false, open: true, voter_count: 2, my_votes: [], voters: null, options: [{ id: 'a', votes: null, voters: null }] })
    ).toMatchObject({ voterCount: 2, options: [{ votes: null }] });
  });
});
