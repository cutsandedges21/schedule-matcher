// src/features/spaces/SpaceOverviewPage.tsx
import { Link } from 'react-router-dom';
import { useAsyncData } from '@/lib/useAsyncData';
import { canInSpace } from '@/domain/spaces';
import { occurrencesInRange, responseOf } from '@/domain/events';
import { pollIsOpen } from '@/domain/polls';
import { assignmentProgress, filterTasks, progressLabel } from '@/domain/tasks';
import { formatRangeIn } from '@/domain/zonedTime';
import { buttonClassName } from '@/components/Button';
import { Badge, Card, InlineEmpty, Notice, Section } from '@/components/Layout';
import Spinner from '@/components/Spinner';
import { listSpaceEvents } from '@/features/events/api';
import { listPolls, myVotedPollIds } from '@/features/polls/api';
import { listSpaceTasks } from '@/features/tasks/api';
import ActivityList from './ActivityList';
import { useSpace } from './SpaceLayout';
import { listActivity } from './api';

const DAY = 86_400_000;

export default function SpaceOverviewPage() {
  const { space, members, me } = useSpace();
  const now = Date.now();
  const base = `/spaces/${space.id}`;
  const events = useAsyncData(
    () => listSpaceEvents(space.id, new Date(now).toISOString(), new Date(now + 30 * DAY).toISOString()),
    [space.id],
    'Could not load upcoming events.'
  );
  const polls = useAsyncData(() => listPolls(space.id), [space.id], 'Could not load polls.');
  const voted = useAsyncData(myVotedPollIds, [], 'Could not load your votes.');
  const tasks = useAsyncData(() => listSpaceTasks(space.id), [space.id], 'Could not load tasks.');
  const activity = useAsyncData(() => listActivity([space.id], 12), [space.id], 'Could not load recent activity.');
  const canInvite = canInSpace({ role: me.role, membersCanInvite: space.membersCanInvite }, 'invite');

  const upcoming = occurrencesInRange(events.data ?? [], now, now + 30 * DAY)
    .filter((o) => o.event.status === 'confirmed')
    .slice(0, 3);
  const waiting = (polls.data ?? []).filter((p) => pollIsOpen(p, now) && !(voted.data?.has(p.id) ?? true));
  const allTasks = tasks.data ?? [];
  const open = filterTasks(allTasks, 'all', me.userId, now);
  const overdue = filterTasks(allTasks, 'overdue', me.userId, now);
  const mine = filterTasks(allTasks, 'mine', me.userId, now);
  const assignments = allTasks.filter((t) => t.parentId === null && (t.isAssignment || allTasks.some((c) => c.parentId === t.id)));
  const activeAssignments = assignments.filter((a) => assignmentProgress(a, allTasks).percent < 100).slice(0, 3);

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:items-start">
      <div className="flex flex-col gap-6">
        {space.description && (
          <Card>
            <p className="whitespace-pre-line text-sm text-slate-700">{space.description}</p>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Link to={`${base}/availability`} className={buttonClassName('primary', 'col-span-2')}>
            Plan something: find a time
          </Link>
          <Link to={`${base}/events/new`} className={buttonClassName('secondary', undefined, 'sm')}>
            New event
          </Link>
          <Link to={`${base}/tasks?new=1`} className={buttonClassName('secondary', undefined, 'sm')}>
            New task
          </Link>
          <Link to={`${base}/polls/new`} className={buttonClassName('secondary', undefined, 'sm')}>
            New poll
          </Link>
          <Link to={`${base}/resources`} className={buttonClassName('secondary', undefined, 'sm')}>
            Saved links
          </Link>
        </div>

        {members.length === 1 && (
          <Notice tone="info">
            You are the only member so far.{' '}
            {canInvite ? (
              <Link to={`${base}/members`} className="font-semibold underline">
                Invite your group
              </Link>
            ) : (
              'Ask the owner to invite the rest of your group.'
            )}{' '}
            — finding a time needs at least two people.
          </Notice>
        )}

        <Section title="Coming up" action={<Link to={`${base}/calendar`} className="text-sm font-medium underline underline-offset-4">Calendar</Link>}>
          {events.loading && !events.data ? (
            <Spinner inline />
          ) : upcoming.length === 0 ? (
            <InlineEmpty>Nothing scheduled in the next 30 days.</InlineEmpty>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {upcoming.map(({ event, start, end }) => {
                const response = responseOf(event, me.userId);
                return (
                  <li key={`${event.id}-${start}`}>
                    <Link to={`${base}/events/${event.id}`} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 active:bg-slate-50">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{event.title}</span>
                        <span className="block truncate text-xs text-slate-500">{formatRangeIn(start, end, space.timezone)}</span>
                      </span>
                      {response === 'pending' && <Badge tone="sky">Reply</Badge>}
                      {response === 'going' && <Badge tone="emerald">Going</Badge>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        {waiting.length > 0 && (
          <Section title="Waiting for your vote">
            <ul className="flex flex-col gap-1.5">
              {waiting.map((poll) => (
                <li key={poll.id}>
                  <Link to={`${base}/polls/${poll.id}`} className="flex items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-semibold">
                    <span className="truncate">{poll.question}</span>
                    <span aria-hidden>›</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>

      <div className="flex flex-col gap-6">
        <Section title="Tasks" action={<Link to={`${base}/tasks`} className="text-sm font-medium underline underline-offset-4">All tasks</Link>}>
          <Card className="flex flex-col gap-3">
            <p className="text-sm text-slate-700">
              {open.length} open · {mine.length} yours
              {overdue.length > 0 && <span className="font-semibold text-rose-700"> · {overdue.length} overdue</span>}
            </p>
            {activeAssignments.map((assignment) => {
              const progress = assignmentProgress(assignment, allTasks);
              return (
                <div key={assignment.id}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate font-medium">{assignment.title}</span>
                    <span className="shrink-0 text-xs text-slate-500">{progressLabel(progress)}</span>
                  </div>
                  <div
                    role="progressbar"
                    aria-label={`${assignment.title}: ${progressLabel(progress)}`}
                    aria-valuenow={progress.percent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200"
                  >
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress.percent}%` }} />
                  </div>
                </div>
              );
            })}
          </Card>
        </Section>

        <Section title="Recent activity">
          {activity.loading && !activity.data ? (
            <Spinner inline label="Loading activity" />
          ) : activity.error ? (
            <Notice tone="warning">{activity.error}</Notice>
          ) : (
            <ActivityList items={activity.data ?? []} viewerId={me.userId} />
          )}
        </Section>
      </div>
    </div>
  );
}
