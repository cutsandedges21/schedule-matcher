// src/domain/__tests__/polls.test.ts
import { describe, it, expect } from 'vitest';
import {
  canManagePoll,
  eventTitleFromQuestion,
  participationLabel,
  pollIsOpen,
  pollOutcome,
  validatePollDraft,
  voteProblem,
  type PollDraft,
} from '../polls';

const NOW = Date.parse('2026-10-20T12:00:00Z');

describe('pollIsOpen', () => {
  it('is closed by hand or by its deadline', () => {
    expect(pollIsOpen({ closedAt: null, deadline: null }, NOW)).toBe(true);
    expect(pollIsOpen({ closedAt: null, deadline: NOW + 1 }, NOW)).toBe(true);
    expect(pollIsOpen({ closedAt: null, deadline: NOW }, NOW)).toBe(false);
    expect(pollIsOpen({ closedAt: '2026-10-19T00:00:00Z', deadline: null }, NOW)).toBe(false);
  });
});

describe('pollOutcome', () => {
  const opts = (...votes: (number | null)[]) => votes.map((v, i) => ({ id: `o${i}`, votes: v, voters: null }));

  it('reports a winner, a tie, no votes, or withheld results', () => {
    expect(pollOutcome({ visible: true, options: opts(3, 1, 0) })).toEqual({ kind: 'winner', optionId: 'o0', votes: 3 });
    expect(pollOutcome({ visible: true, options: opts(2, 2, 1) })).toEqual({ kind: 'tie', optionIds: ['o0', 'o1'], votes: 2 });
    expect(pollOutcome({ visible: true, options: opts(0, 0) })).toEqual({ kind: 'no_votes' });
    expect(pollOutcome({ visible: false, options: opts(null, null) })).toEqual({ kind: 'hidden' });
  });
});

describe('voteProblem', () => {
  const poll = { allowMultiple: false, options: [{ id: 'a' }, { id: 'b' }] as never[] };
  it('enforces single choice and known options', () => {
    expect(voteProblem(poll, ['a'])).toBeNull();
    expect(voteProblem(poll, [])).toBeNull();
    expect(voteProblem(poll, ['a', 'b'])).toMatch(/one answer/);
    expect(voteProblem(poll, ['z'])).toMatch(/not part/);
    expect(voteProblem({ ...poll, allowMultiple: true }, ['a', 'b'])).toBeNull();
  });
});

describe('validatePollDraft', () => {
  const draft: PollDraft = {
    question: 'Where do we meet?',
    description: '',
    kind: 'general',
    options: [{ label: 'Library' }, { label: 'Café' }],
    deadline: null,
  };

  it('accepts a normal poll', () => {
    expect(validatePollDraft(draft, NOW)).toEqual({});
  });

  it('mirrors create_poll()', () => {
    expect(validatePollDraft({ ...draft, question: ' ' }, NOW).question).toBeDefined();
    expect(validatePollDraft({ ...draft, options: [{ label: 'Only' }] }, NOW).options).toMatch(/between 2 and 20/);
    expect(validatePollDraft({ ...draft, options: [{ label: 'Same' }, { label: 'same ' }] }, NOW).options).toMatch(/same thing/);
    expect(validatePollDraft({ ...draft, options: [{ label: 'A' }, { label: '' }] }, NOW).options).toMatch(/needs some text/);
    expect(validatePollDraft({ ...draft, kind: 'schedule' }, NOW).options).toMatch(/needs a time/);
    expect(validatePollDraft({ ...draft, deadline: NOW - 1 }, NOW).deadline).toBeDefined();
  });
});

describe('labels and permissions', () => {
  it('counts participation without naming anyone', () => {
    expect(participationLabel(4, 6)).toBe('4 of 6 members have voted');
  });

  it('lets the person asking or a manager close', () => {
    expect(canManagePoll({ createdBy: 'u' }, 'u', 'member')).toBe(true);
    expect(canManagePoll({ createdBy: 'u' }, 'v', 'member')).toBe(false);
    expect(canManagePoll({ createdBy: 'u' }, 'v', 'admin')).toBe(true);
  });
});

describe('eventTitleFromQuestion', () => {
  it('names the event for the purpose the poll was asking about', () => {
    expect(eventTitleFromQuestion('When should we meet for the lab report?')).toBe('The lab report');
    expect(eventTitleFromQuestion('Runoff: When should we meet for study group?')).toBe('Study group');
    expect(eventTitleFromQuestion('Movie night: which day?')).toBe('Movie night: which day?');
  });
});
