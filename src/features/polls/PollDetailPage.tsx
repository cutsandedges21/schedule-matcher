// src/features/polls/PollDetailPage.tsx
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAsyncData } from '@/lib/useAsyncData';
import { useBusyAction } from '@/lib/useBusyAction';
import { messageOf } from '@/lib/supabaseErrors';
import {
  canManagePoll,
  eventTitleFromQuestion,
  participationLabel,
  pollIsOpen,
  pollOutcome,
  voteProblem,
  type Poll,
  type PollOption,
} from '@/domain/polls';
import { formatInstantIn } from '@/domain/zonedTime';
import Button, { buttonClassName } from '@/components/Button';
import { Badge, Card, Notice, Section } from '@/components/Layout';
import Spinner from '@/components/Spinner';
import { useConfirm } from '@/components/ConfirmDialog';
import { useToast } from '@/components/Toast';
import { useSpace } from '@/features/spaces/SpaceLayout';
import { castVote, closePoll, deletePoll, getPoll, getPollResults, schedulePollOption } from './api';

const HIDDEN_RESULTS: Record<Poll['resultsVisibility'], string> = {
  always: '',
  after_vote: 'Results appear once you vote.',
  after_close: 'Results appear when the poll closes.',
};

export default function PollDetailPage() {
  const { pollId = '' } = useParams<{ pollId: string }>();
  const { space, members, me } = useSpace();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();
  const { busy, run } = useBusyAction();
  const poll = useAsyncData(() => getPoll(pollId), [pollId], 'Could not load this poll.');
  const results = useAsyncData(() => getPollResults(pollId), [pollId], 'Could not load the results.');
  const [selection, setSelection] = useState<string[]>([]);
  const [voteError, setVoteError] = useState<string | null>(null);

  // Start from the vote already cast, so changing it is an edit, not a redo.
  const myVotes = results.data?.myVotes.join(',');
  useEffect(() => {
    if (myVotes !== undefined) setSelection(myVotes ? myVotes.split(',') : []);
  }, [myVotes]);

  if (poll.loading && !poll.data) return <Spinner inline label="Loading the poll" />;
  const data = poll.data;
  if (!data) return <Notice tone="warning">{poll.error ?? 'This poll was deleted.'}</Notice>;

  const now = Date.now();
  const open = pollIsOpen(data, now);
  const res = results.data;
  const outcome = res ? pollOutcome(res) : { kind: 'hidden' as const };
  const manage = canManagePoll(data, me.userId, me.role);
  const labelOf = (id: string) =>
    id === me.userId ? 'You' : `@${members.find((m) => m.userId === id)?.profile.username ?? 'former member'}`;
  const optionLabel = (id: string) => data.options.find((o) => o.id === id)?.label ?? 'an option';
  const maxVotes = Math.max(1, ...(res?.options.map((o) => o.votes ?? 0) ?? [1]));
  const voted = (res?.myVotes.length ?? 0) > 0;

  function toggle(id: string) {
    setVoteError(null);
    if (!data) return;
    setSelection((current) =>
      data.allowMultiple ? (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]) : [id]
    );
  }

  function submitVote(choice: string[]) {
    if (!data) return;
    const problem = voteProblem(data, choice);
    if (problem) return setVoteError(problem);
    void run(async () => {
      try {
        await castVote(data.id, choice);
        await results.reload();
        toast(choice.length === 0 ? 'Vote taken back.' : voted ? 'Vote changed.' : 'Vote counted.');
      } catch (caught) {
        setVoteError(messageOf(caught, 'Could not record your vote.'));
      }
    });
  }

  async function close() {
    if (!data || !(await confirm({ title: 'Close this poll?', body: 'Nobody can vote after this. Everyone who voted gets the result.', confirmLabel: 'Close poll' }))) return;
    void run(async () => {
      try {
        await closePoll(data.id);
        await Promise.all([poll.reload(), results.reload()]);
        toast('Poll closed.');
      } catch (caught) {
        toast(messageOf(caught, 'Could not close the poll.'), 'error');
      }
    });
  }

  async function schedule(option: PollOption) {
    if (!data) return;
    const ok = await confirm({
      title: `Schedule ${option.label}?`,
      body: 'This creates the event for everyone in the space, marks people who voted for this time as going, and closes the poll.',
      confirmLabel: 'Schedule it',
    });
    if (!ok) return;
    void run(async () => {
      try {
        const eventId = await schedulePollOption(data.id, option.id, { title: eventTitleFromQuestion(data.question), location: '' });
        toast('Scheduled. Everyone was invited.');
        navigate(`/spaces/${space.id}/events/${eventId}`);
      } catch (caught) {
        toast(messageOf(caught, 'Could not schedule that time.'), 'error');
      }
    });
  }

  async function remove() {
    if (!data || !(await confirm({ title: 'Delete this poll?', body: 'Its votes are deleted too.', confirmLabel: 'Delete', destructive: true }))) return;
    void run(async () => {
      try {
        await deletePoll(data.id);
        toast('Poll deleted.', 'info');
        navigate(`/spaces/${space.id}/polls`, { replace: true });
      } catch (caught) {
        toast(messageOf(caught, 'Could not delete the poll.'), 'error');
      }
    });
  }

  const canSchedule = manage && data.kind === 'schedule' && !data.eventId;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="flex flex-wrap items-center gap-1.5">
          {data.kind === 'schedule' && <Badge tone="violet">Scheduling</Badge>}
          {open ? <Badge tone="emerald">Open</Badge> : <Badge>Closed</Badge>}
          {data.anonymous && <Badge tone="sky">Anonymous</Badge>}
        </div>
        <h2 className="mt-1 text-xl font-bold">{data.question}</h2>
        {data.description && <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{data.description}</p>}
        <p className="mt-1 text-xs text-slate-500">
          {res ? participationLabel(res.voterCount, members.length) : ''}
          {open && data.deadline !== null && ` · closes ${formatInstantIn(data.deadline, space.timezone)}`}
          {data.allowMultiple ? ' · pick as many as work' : ' · pick one'}
        </p>
      </div>

      {data.eventId && (
        <Notice tone="success">
          This was scheduled.{' '}
          <Link to={`/spaces/${space.id}/events/${data.eventId}`} className="font-semibold underline">
            See the event
          </Link>
        </Notice>
      )}

      {!open && res?.visible && (
        <Notice tone={outcome.kind === 'tie' ? 'warning' : 'info'}>
          {outcome.kind === 'winner' && (
            <>
              <strong>{optionLabel(outcome.optionId)}</strong> won with {outcome.votes} {outcome.votes === 1 ? 'vote' : 'votes'}.
            </>
          )}
          {outcome.kind === 'no_votes' && 'Nobody voted.'}
          {outcome.kind === 'tie' && (
            <>
              Tie between {outcome.optionIds.map(optionLabel).join(' and ')} ({outcome.votes} each). The group can pick one of
              them below{manage ? '' : ' (the person who asked, or an admin, decides)'}, or{' '}
              <Link
                to={`/spaces/${space.id}/polls/new?runoff=${data.id}&keep=${outcome.optionIds.join(',')}`}
                className="font-semibold underline"
              >
                run a quick runoff vote
              </Link>
              .
            </>
          )}
        </Notice>
      )}

      <Section title={open ? (voted ? 'Your vote' : 'Vote') : 'Results'}>
        <ul className="flex flex-col gap-2">
          {data.options.map((option) => {
            const result = res?.options.find((o) => o.id === option.id);
            const chosen = selection.includes(option.id);
            const votes = result?.votes;
            const winner = outcome.kind === 'winner' && outcome.optionId === option.id;
            return (
              <li key={option.id}>
                <Card className={`flex flex-col gap-2 p-3 ${winner ? 'border-emerald-400' : ''}`}>
                  <label className={`flex min-h-touch items-center gap-3 ${open ? 'cursor-pointer' : ''}`}>
                    {open && (
                      <input
                        type={data.allowMultiple ? 'checkbox' : 'radio'}
                        name="poll-option"
                        checked={chosen}
                        onChange={() => toggle(option.id)}
                        className="h-5 w-5 shrink-0 accent-slate-900"
                      />
                    )}
                    <span className="min-w-0 flex-1 text-sm font-semibold">{option.label}</span>
                    {votes !== null && votes !== undefined && (
                      <span className="text-sm font-semibold text-slate-700">
                        {votes} {votes === 1 ? 'vote' : 'votes'}
                      </span>
                    )}
                  </label>
                  {votes !== null && votes !== undefined && (
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                      <div className="h-full rounded-full bg-accent" style={{ width: `${(votes / maxVotes) * 100}%` }} />
                    </div>
                  )}
                  {result?.voters && result.voters.length > 0 && (
                    <p className="text-xs text-slate-500">{result.voters.map(labelOf).join(', ')}</p>
                  )}
                  {canSchedule && option.startsAt !== null && (
                    <Button size="sm" variant={winner ? 'primary' : 'secondary'} className="self-start" disabled={busy} onClick={() => void schedule(option)}>
                      Schedule this time
                    </Button>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>

        {res && !res.visible && HIDDEN_RESULTS[data.resultsVisibility] && (
          <p className="mt-2 text-xs text-slate-500">{HIDDEN_RESULTS[data.resultsVisibility]}</p>
        )}
        {voteError && <Notice tone="error" className="mt-2">{voteError}</Notice>}

        {open && (
          <div className="mt-3 flex gap-2">
            <Button className="flex-1" disabled={busy || selection.length === 0} onClick={() => submitVote(selection)}>
              {voted ? 'Change vote' : 'Vote'}
            </Button>
            {voted && (
              <Button variant="secondary" disabled={busy} onClick={() => submitVote([])}>
                Take back
              </Button>
            )}
          </div>
        )}
      </Section>

      {manage && (
        <Card className="flex flex-wrap gap-2">
          {open && (
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => void close()}>
              Close poll now
            </Button>
          )}
          <Button size="sm" variant="ghost" className="text-rose-700" disabled={busy} onClick={() => void remove()}>
            Delete poll
          </Button>
        </Card>
      )}

      <Link to={`/spaces/${space.id}/polls`} className={buttonClassName('ghost', 'self-start')}>
        ← All polls
      </Link>
    </div>
  );
}
