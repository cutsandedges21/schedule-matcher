// src/features/polls/PollsPage.tsx
import { Link } from 'react-router-dom';
import { useAsyncData } from '@/lib/useAsyncData';
import { pollIsOpen, type Poll } from '@/domain/polls';
import { formatInstantIn } from '@/domain/zonedTime';
import { buttonClassName } from '@/components/Button';
import Icon from '@/components/Icon';
import { Badge, InlineEmpty, Notice, Section } from '@/components/Layout';
import Spinner from '@/components/Spinner';
import { useSpace } from '@/features/spaces/SpaceLayout';
import { listPolls, myVotedPollIds } from './api';

export default function PollsPage() {
  const { space } = useSpace();
  const polls = useAsyncData(() => listPolls(space.id), [space.id], 'Could not load the polls.');
  const voted = useAsyncData(myVotedPollIds, [], 'Could not load your votes.');
  const now = Date.now();

  if (polls.loading && !polls.data) return <Spinner inline label="Loading polls" />;

  const all = polls.data ?? [];
  const open = all.filter((p) => pollIsOpen(p, now));
  const closed = all.filter((p) => !pollIsOpen(p, now));

  const card = (poll: Poll) => {
    const isOpen = pollIsOpen(poll, now);
    const hasVoted = voted.data?.has(poll.id) ?? false;
    return (
      <li key={poll.id}>
        <Link to={`/spaces/${space.id}/polls/${poll.id}`} className="block rounded-xl border border-slate-200 bg-white p-3 active:bg-slate-50">
          <p className="font-semibold">{poll.question}</p>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
            {poll.kind === 'schedule' && <Badge tone="violet">Scheduling</Badge>}
            {isOpen ? (
              hasVoted ? <Badge tone="emerald">You voted</Badge> : <Badge tone="amber">Waiting for your vote</Badge>
            ) : poll.eventId ? (
              <Badge tone="emerald">Scheduled</Badge>
            ) : (
              <Badge>Closed</Badge>
            )}
            {isOpen && poll.deadline !== null && <span>Closes {formatInstantIn(poll.deadline, space.timezone)}</span>}
            <span>{poll.options.length} options</span>
          </p>
        </Link>
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-2">
        <Link to={`/spaces/${space.id}/polls/new`} className={buttonClassName('primary', 'gap-1')}>
          <Icon name="plus" className="h-4 w-4" /> New poll
        </Link>
        <Link to={`/spaces/${space.id}/availability`} className={buttonClassName('secondary')}>
          Vote on a time
        </Link>
      </div>

      {polls.error && <Notice tone="warning">{polls.error}</Notice>}

      <Section title={`Open (${open.length})`}>
        {open.length === 0 ? (
          <InlineEmpty>No open polls. Ask the group something, or find a few times and let everyone vote.</InlineEmpty>
        ) : (
          <ul className="flex flex-col gap-2">{open.map(card)}</ul>
        )}
      </Section>

      {closed.length > 0 && (
        <Section title={`Closed (${closed.length})`}>
          <ul className="flex flex-col gap-2">{closed.map(card)}</ul>
        </Section>
      )}
    </div>
  );
}
