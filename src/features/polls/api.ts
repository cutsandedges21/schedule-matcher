// src/features/polls/api.ts
import { supabase } from '@/lib/supabase';
import { throwIfError } from '@/lib/supabaseErrors';
import { POLL_COLUMNS, jsonToPollResults, rowToPoll, type PollResultsJson, type PollRow } from '@/domain/planMappers';
import type { Poll, PollKind, PollOptionDraft, PollResults, ResultsVisibility } from '@/domain/polls';

export async function listPolls(spaceId: string): Promise<Poll[]> {
  const { data, error } = await supabase
    .from('polls')
    .select(POLL_COLUMNS)
    .eq('space_id', spaceId)
    .order('created_at', { ascending: false });
  throwIfError(error, 'Could not load the polls.');
  return ((data ?? []) as unknown as PollRow[]).map(rowToPoll);
}

/** Open polls across every space the student is in (RLS filters). */
export async function listOpenPolls(): Promise<(Poll & { spaceName: string | null })[]> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('polls')
    .select(`${POLL_COLUMNS}, space:spaces(name)`)
    .is('closed_at', null)
    .or(`deadline.is.null,deadline.gt."${now}"`)
    .order('created_at', { ascending: false })
    .limit(50);
  throwIfError(error, 'Could not load open polls.');
  return ((data ?? []) as unknown as (PollRow & { space: { name: string } | null })[]).map((row) => ({
    ...rowToPoll(row),
    spaceName: row.space?.name ?? null,
  }));
}

/** Poll ids the student has voted in — their own vote rows are the only ones they can read. */
export async function myVotedPollIds(): Promise<Set<string>> {
  const { data, error } = await supabase.from('poll_votes').select('poll_id');
  throwIfError(error, 'Could not load your votes.');
  return new Set(((data ?? []) as { poll_id: string }[]).map((v) => v.poll_id));
}

export async function getPoll(pollId: string): Promise<Poll | null> {
  const { data, error } = await supabase.from('polls').select(POLL_COLUMNS).eq('id', pollId).maybeSingle();
  throwIfError(error, 'Could not load this poll.');
  return data ? rowToPoll(data as unknown as PollRow) : null;
}

export async function getPollResults(pollId: string): Promise<PollResults> {
  const { data, error } = await supabase.rpc('get_poll_results', { p_poll_id: pollId });
  throwIfError(error, 'Could not load the results.');
  return jsonToPollResults(data as PollResultsJson);
}

export interface PollInput {
  question: string;
  description: string;
  kind: PollKind;
  options: PollOptionDraft[];
  allowMultiple: boolean;
  anonymous: boolean;
  resultsVisibility: ResultsVisibility;
  deadline: number | null;
  durationMinutes: number | null;
  timezone: string | null;
}

export async function createPoll(spaceId: string, input: PollInput): Promise<string> {
  const { data, error } = await supabase.rpc('create_poll', {
    p_space_id: spaceId,
    p_question: input.question.trim(),
    p_options: input.options.map((o) => ({
      label: o.label.trim(),
      starts_at: o.startsAt ? new Date(o.startsAt).toISOString() : null,
      ends_at: o.endsAt ? new Date(o.endsAt).toISOString() : null,
    })),
    p_description: input.description,
    p_kind: input.kind,
    p_allow_multiple: input.allowMultiple,
    p_anonymous: input.anonymous,
    p_results_visibility: input.resultsVisibility,
    p_deadline: input.deadline === null ? null : new Date(input.deadline).toISOString(),
    p_duration_minutes: input.durationMinutes,
    p_timezone: input.timezone,
  });
  throwIfError(error, 'Could not create the poll.');
  return data as string;
}

export async function castVote(pollId: string, optionIds: string[]): Promise<void> {
  const { error } = await supabase.rpc('cast_vote', { p_poll_id: pollId, p_option_ids: optionIds });
  throwIfError(error, 'Could not record your vote.');
}

export async function closePoll(pollId: string): Promise<void> {
  const { error } = await supabase.rpc('close_poll', { p_poll_id: pollId });
  throwIfError(error, 'Could not close the poll.');
}

export async function schedulePollOption(
  pollId: string,
  optionId: string,
  details: { title: string; location: string }
): Promise<string> {
  const { data, error } = await supabase.rpc('schedule_poll_option', {
    p_poll_id: pollId,
    p_option_id: optionId,
    p_title: details.title,
    p_location: details.location,
  });
  throwIfError(error, 'Could not schedule that time.');
  return data as string;
}

export async function deletePoll(pollId: string): Promise<void> {
  const { data, error } = await supabase.from('polls').delete().eq('id', pollId).select('id');
  throwIfError(error, 'Could not delete the poll.');
  if (!data || data.length === 0) throw new Error('Only the person who asked, or an admin, can delete this poll.');
}
