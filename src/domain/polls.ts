// src/domain/polls.ts
//
// Group polls (migration 0018). The server decides what results a member may
// see (get_poll_results); these helpers interpret what it sent and validate a
// vote or a new poll before the request, so a student sees a field-level
// message instead of a raw refusal.
import type { SpaceRole } from './spaces';

export type PollKind = 'general' | 'schedule';
export type ResultsVisibility = 'always' | 'after_vote' | 'after_close';

export interface PollOption {
  id: string;
  label: string;
  /** Epoch ms; set for schedule polls only. */
  startsAt: number | null;
  endsAt: number | null;
  position: number;
}

export interface Poll {
  id: string;
  spaceId: string;
  question: string;
  description: string | null;
  kind: PollKind;
  allowMultiple: boolean;
  anonymous: boolean;
  resultsVisibility: ResultsVisibility;
  deadline: number | null;
  durationMinutes: number | null;
  timezone: string | null;
  closedAt: string | null;
  eventId: string | null;
  createdBy: string | null;
  createdAt: string;
  options: PollOption[];
}

export interface PollResults {
  /** False: counts are withheld, not zero. */
  visible: boolean;
  open: boolean;
  voterCount: number;
  myVotes: string[];
  /** Null when anonymous or withheld. */
  voters: string[] | null;
  options: { id: string; votes: number | null; voters: string[] | null }[];
}

export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 20;
export const QUESTION_MAX = 200;
export const OPTION_MAX = 200;

export const VISIBILITY_LABELS: Record<ResultsVisibility, string> = {
  always: 'Show results as votes come in',
  after_vote: 'Show results after someone votes',
  after_close: 'Show results when the poll closes',
};

/** Closed by hand, or past its deadline — the same test as private.poll_is_open. */
export function pollIsOpen(poll: Pick<Poll, 'closedAt' | 'deadline'>, nowMs: number): boolean {
  return poll.closedAt === null && (poll.deadline === null || poll.deadline > nowMs);
}

/** close_poll / schedule_poll_option: the person who asked, or an owner or admin. */
export function canManagePoll(poll: Pick<Poll, 'createdBy'>, userId: string, role: SpaceRole): boolean {
  return poll.createdBy === userId || role === 'owner' || role === 'admin';
}

export type PollOutcome =
  | { kind: 'hidden' }
  | { kind: 'no_votes' }
  | { kind: 'winner'; optionId: string; votes: number }
  | { kind: 'tie'; optionIds: string[]; votes: number };

export function pollOutcome(results: Pick<PollResults, 'visible' | 'options'>): PollOutcome {
  if (!results.visible) return { kind: 'hidden' };
  const top = Math.max(0, ...results.options.map((o) => o.votes ?? 0));
  if (top === 0) return { kind: 'no_votes' };
  const leaders = results.options.filter((o) => (o.votes ?? 0) === top).map((o) => o.id);
  return leaders.length === 1
    ? { kind: 'winner', optionId: leaders[0], votes: top }
    : { kind: 'tie', optionIds: leaders, votes: top };
}

/** Null when the selection is fine; otherwise why not. */
export function voteProblem(poll: Pick<Poll, 'allowMultiple' | 'options'>, selection: readonly string[]): string | null {
  const known = new Set(poll.options.map((o) => o.id));
  if (selection.some((id) => !known.has(id))) return 'That option is not part of this poll.';
  if (!poll.allowMultiple && new Set(selection).size > 1) return 'Pick one answer.';
  return null;
}

export interface PollOptionDraft {
  label: string;
  startsAt?: number | null;
  endsAt?: number | null;
}

export interface PollDraft {
  question: string;
  description: string;
  kind: PollKind;
  options: PollOptionDraft[];
  deadline: number | null;
}

export type PollDraftErrors = Partial<Record<'question' | 'description' | 'options' | 'deadline', string>>;

/** The checks create_poll() makes, in the same order. */
export function validatePollDraft(draft: PollDraft, nowMs: number): PollDraftErrors {
  const errors: PollDraftErrors = {};
  const question = draft.question.trim();
  if (!question) errors.question = 'Ask a question.';
  else if (question.length > QUESTION_MAX) errors.question = `At most ${QUESTION_MAX} characters.`;
  if (draft.description.length > 1000) errors.description = 'At most 1000 characters.';

  const labels = draft.options.map((o) => o.label.trim());
  if (labels.length < MIN_OPTIONS || labels.length > MAX_OPTIONS) {
    errors.options = `Give between ${MIN_OPTIONS} and ${MAX_OPTIONS} options.`;
  } else if (labels.some((l) => l.length === 0)) {
    errors.options = 'Every option needs some text.';
  } else if (labels.some((l) => l.length > OPTION_MAX)) {
    errors.options = `Options can be at most ${OPTION_MAX} characters.`;
  } else if (new Set(labels.map((l) => l.toLowerCase())).size < labels.length) {
    errors.options = 'Two options say the same thing.';
  } else if (draft.kind === 'schedule' && draft.options.some((o) => !o.startsAt || !o.endsAt)) {
    errors.options = 'Every option in a scheduling poll needs a time.';
  }

  if (draft.deadline !== null && draft.deadline <= nowMs) errors.deadline = 'The deadline has to be in the future.';
  return errors;
}

/** "4 of 6 have voted" — participation without who. */
export function participationLabel(voterCount: number, memberCount: number): string {
  return `${voterCount} of ${memberCount} ${memberCount === 1 ? 'member has' : 'members have'} voted`;
}

/**
 * The event a scheduling poll becomes is named for its purpose, not its
 * question: "When should we meet for the lab report?" schedules "The lab
 * report", and "Runoff: " is dropped. Anything else keeps its wording.
 */
export function eventTitleFromQuestion(question: string): string {
  const bare = question.replace(/^Runoff: /, '').trim();
  const match = /^When should we (?:meet|get together) for (.+?)\??$/i.exec(bare);
  if (!match) return bare;
  const purpose = match[1].trim();
  return purpose.charAt(0).toUpperCase() + purpose.slice(1);
}
