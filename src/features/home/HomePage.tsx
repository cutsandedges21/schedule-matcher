// src/features/home/HomePage.tsx
import { Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { useSchedule } from '@/features/schedule/useSchedule';
import { useAsyncData } from '@/lib/useAsyncData';
import { browserTimeZone, epochToZoned, formatDateKey, formatRangeIn } from '@/domain/zonedTime';
import { spaceKindLabel } from '@/domain/spaces';
import { occurrencesInRange, responseOf } from '@/domain/events';
import { isOverdue } from '@/domain/tasks';
import { relativeDue } from '@/domain/relativeTime';
import { buttonClassName } from '@/components/Button';
import Icon from '@/components/Icon';
import { Badge, Card, InlineEmpty, Notice, Section } from '@/components/Layout';
import Spinner from '@/components/Spinner';
import { listActivity, listMyInvitations, listMySpaces } from '@/features/spaces/api';
import ActivityList from '@/features/spaces/ActivityList';
import { listMyEvents } from '@/features/events/api';
import { listMyTasks } from '@/features/tasks/api';
import { listOpenPolls, myVotedPollIds } from '@/features/polls/api';
import TodayClasses from './TodayClasses';

const DAY = 86_400_000;
/** "Due soon" on Home: today and the next two days. */
const SOON_MS = 3 * DAY;

/**
 * Answers three questions in order: what do I need to do, what is happening
 * soon, and what does my group need from me. Each section loads on its own,
 * so one slow or failing piece never blanks the rest — today's classes come
 * from the original schedule tables and always work.
 */
export default function HomePage() {
  const { session, profile } = useAuth();
  const userId = session?.user.id ?? '';
  const now = Date.now();
  const zone = browserTimeZone();
  const today = epochToZoned(now, zone);

  const schedule = useSchedule(userId);
  const spaces = useAsyncData(listMySpaces, [], 'Could not load your spaces.');
  const invitations = useAsyncData(listMyInvitations, [], 'Could not load your invitations.');
  const events = useAsyncData(
    () => listMyEvents(new Date(now).toISOString(), new Date(now + 14 * DAY).toISOString()),
    [],
    'Could not load upcoming events.'
  );
  const tasks = useAsyncData(() => listMyTasks(userId), [userId], 'Could not load your tasks.');
  const polls = useAsyncData(listOpenPolls, [], 'Could not load polls.');
  const voted = useAsyncData(myVotedPollIds, [], 'Could not load your votes.');
  const spaceIds = (spaces.data ?? []).map((s) => s.id);
  const activity = useAsyncData(() => listActivity(spaceIds, 8), [spaceIds.join(',')], 'Could not load activity.');

  const spaceNames = new Map((spaces.data ?? []).map((s) => [s.id, s.name]));
  const pinnedFirst = [...(spaces.data ?? [])].sort(
    (a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt)
  );
  const pending = invitations.data ?? [];

  // What I need to do.
  const dueTasks = (tasks.data ?? [])
    .filter((t) => t.status !== 'done' && t.dueAt !== null && (isOverdue(t, now) || t.dueAt <= now + SOON_MS))
    .sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0))
    .slice(0, 5);
  const pollsToAnswer = voted.data ? (polls.data ?? []).filter((p) => !voted.data!.has(p.id)).slice(0, 5) : [];

  // What is happening soon: events I have not declined, next 7 days.
  const occurrences = occurrencesInRange(events.data ?? [], now, now + 7 * DAY).filter(
    (o) => o.event.status === 'confirmed' && responseOf(o.event, userId) !== 'declined' && responseOf(o.event, userId) !== null
  );
  const toReply = occurrences.filter((o) => responseOf(o.event, userId) === 'pending');

  const needsYou = dueTasks.length + pollsToAnswer.length + toReply.length;

  return (
    <main className="flex flex-col gap-6 px-4 pb-6 pt-4">
      <header>
        <p className="text-sm font-medium text-slate-500">{formatDateKey(today.date, 'long')}</p>
        <h1 className="text-2xl font-bold">Hi{profile ? `, @${profile.username}` : ''}</h1>
      </header>

      {pending.length > 0 && (
        <Link to="/spaces" className="block">
          <Notice tone="warning" className="flex items-center justify-between gap-3">
            <span>
              <strong>
                {pending.length} space {pending.length === 1 ? 'invitation' : 'invitations'}
              </strong>{' '}
              waiting for your answer.
            </span>
            <Icon name="chevron-right" className="h-5 w-5 shrink-0" />
          </Notice>
        </Link>
      )}

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-6">
          <Section title={needsYou > 0 ? `Needs you (${needsYou})` : 'Needs you'}>
            {tasks.loading && polls.loading ? (
              <Spinner inline />
            ) : needsYou === 0 ? (
              <InlineEmpty>Nothing due in the next few days, no votes or replies waiting.</InlineEmpty>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {dueTasks.map((task) => {
                  const late = isOverdue(task, now);
                  return (
                    <li key={`t-${task.id}`}>
                      <Link
                        to={`/spaces/${task.spaceId}/tasks?task=${task.id}`}
                        className={`flex items-center gap-3 rounded-xl border bg-white p-3 ${late ? 'border-rose-300' : 'border-slate-200'}`}
                      >
                        <Icon name="tasks" className="h-5 w-5 shrink-0 text-slate-400" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{task.title}</span>
                          <span className="block truncate text-xs text-slate-500">{task.spaceName}</span>
                        </span>
                        <Badge tone={late ? 'rose' : 'amber'}>
                          {late ? 'Overdue' : `Due ${relativeDue(task.dueAt as number, now)}`}
                        </Badge>
                      </Link>
                    </li>
                  );
                })}
                {pollsToAnswer.map((poll) => (
                  <li key={`p-${poll.id}`}>
                    <Link to={`/spaces/${poll.spaceId}/polls/${poll.id}`} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
                      <Icon name="poll" className="h-5 w-5 shrink-0 text-slate-400" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{poll.question}</span>
                        <span className="block truncate text-xs text-slate-500">{poll.spaceName}</span>
                      </span>
                      <Badge tone="sky">Vote</Badge>
                    </Link>
                  </li>
                ))}
                {toReply.map(({ event, start, end }) => (
                  <li key={`e-${event.id}-${start}`}>
                    <Link to={`/spaces/${event.spaceId}/events/${event.id}`} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
                      <Icon name="calendar" className="h-5 w-5 shrink-0 text-slate-400" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{event.title}</span>
                        <span className="block truncate text-xs text-slate-500">{formatRangeIn(start, end, zone)}</span>
                      </span>
                      <Badge tone="sky">Reply</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section
            title="Today"
            action={
              <Link to="/schedule" className="text-sm font-medium underline underline-offset-4">
                Full week
              </Link>
            }
          >
            {schedule.loading ? (
              <Spinner inline label="Loading your classes" />
            ) : schedule.error ? (
              <Notice tone="warning">{schedule.error}</Notice>
            ) : (
              <TodayClasses classes={schedule.classes} weekday={today.weekday} hasSchedule={schedule.classes.length > 0} />
            )}
          </Section>

          <Section
            title="Coming up this week"
            action={
              <Link to="/calendar" className="text-sm font-medium underline underline-offset-4">
                Calendar
              </Link>
            }
          >
            {events.loading && !events.data ? (
              <Spinner inline />
            ) : occurrences.length === 0 ? (
              <InlineEmpty>No group events in the next 7 days.</InlineEmpty>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {occurrences.slice(0, 5).map(({ event, start, end }) => (
                  <li key={`${event.id}-${start}`}>
                    <Link to={`/spaces/${event.spaceId}/events/${event.id}`} className="block rounded-xl border border-slate-200 bg-white p-3 active:bg-slate-50">
                      <span className="block truncate text-sm font-semibold">{event.title}</span>
                      <span className="block truncate text-xs text-slate-500">
                        {formatRangeIn(start, end, zone)}
                        {event.spaceName ? ` · ${event.spaceName}` : ''}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <div className="flex flex-col gap-6">
          <Section
            title="Your spaces"
            action={
              <Link to="/spaces" className="text-sm font-medium underline underline-offset-4">
                All spaces
              </Link>
            }
          >
            {spaces.loading && !spaces.data ? (
              <Spinner inline label="Loading spaces" />
            ) : spaces.error ? (
              <Notice tone="warning">{spaces.error}</Notice>
            ) : pinnedFirst.length === 0 ? (
              <Card className="flex flex-col items-start gap-2">
                <p className="text-sm text-slate-700">
                  A space keeps one group&rsquo;s plans together: when everyone is free, what is due, and who is
                  doing what.
                </p>
                <Link to="/spaces/new" className={buttonClassName('primary', undefined, 'sm')}>
                  Create a space
                </Link>
              </Card>
            ) : (
              <ul className="flex flex-col gap-2">
                {pinnedFirst.slice(0, 5).map((space) => (
                  // Two sibling links, never one inside the other: an <a> may
                  // not contain another <a>, and browsers split the markup.
                  <li key={space.id} className="flex items-stretch rounded-xl border border-slate-200 bg-white">
                    <Link to={`/spaces/${space.id}`} className="flex min-w-0 flex-1 items-center gap-3 p-3 active:bg-slate-50">
                      {space.pinned && <Icon name="star" filled className="h-4 w-4 shrink-0 text-amber-500" />}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{space.name}</span>
                        <span className="block text-xs text-slate-500">
                          {spaceKindLabel(space.kind)} · {space.memberCount} {space.memberCount === 1 ? 'member' : 'members'}
                        </span>
                      </span>
                    </Link>
                    <Link
                      to={`/spaces/${space.id}/availability`}
                      className="flex shrink-0 items-center px-3 text-xs font-semibold text-slate-700 underline underline-offset-2 active:bg-slate-50"
                    >
                      Find a time
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {spaceIds.length > 0 && (
            <Section title="Recent activity">
              {activity.loading && !activity.data ? (
                <Spinner inline label="Loading activity" />
              ) : activity.error ? (
                <Notice tone="warning">{activity.error}</Notice>
              ) : (
                <ActivityList items={activity.data ?? []} viewerId={userId} spaceNames={spaceNames} nowMs={now} />
              )}
            </Section>
          )}
        </div>
      </div>
    </main>
  );
}
