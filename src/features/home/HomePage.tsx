// src/features/home/HomePage.tsx
import { Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { useSchedule } from '@/features/schedule/useSchedule';
import { useAsyncData } from '@/lib/useAsyncData';
import { browserTimeZone, epochToZoned, formatDateKey } from '@/domain/zonedTime';
import { spaceKindLabel } from '@/domain/spaces';
import { buttonClassName } from '@/components/Button';
import Icon from '@/components/Icon';
import { Card, Notice, Section } from '@/components/Layout';
import Spinner from '@/components/Spinner';
import { listActivity, listMyInvitations, listMySpaces } from '@/features/spaces/api';
import ActivityList from '@/features/spaces/ActivityList';
import TodayClasses from './TodayClasses';

/**
 * Answers three questions in this order: what is on today, what does my group
 * need from me, and where do I go next. Each section loads on its own, so a
 * slow or missing piece (Spaces before migration 0016, say) never blanks the
 * parts that work — today's classes come from the original schedule tables.
 */
export default function HomePage() {
  const { session, profile } = useAuth();
  const userId = session?.user.id;
  const schedule = useSchedule(userId);
  const spaces = useAsyncData(listMySpaces, [], 'Could not load your spaces.');
  const invitations = useAsyncData(listMyInvitations, [], 'Could not load your invitations.');
  const spaceIds = (spaces.data ?? []).map((s) => s.id);
  const activity = useAsyncData(() => listActivity(spaceIds, 8), [spaceIds.join(',')], 'Could not load activity.');

  const now = Date.now();
  const today = epochToZoned(now, browserTimeZone());
  const spaceNames = new Map((spaces.data ?? []).map((s) => [s.id, s.name]));
  const pinnedFirst = [...(spaces.data ?? [])].sort(
    (a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt)
  );
  const pending = invitations.data ?? [];

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
                A space keeps one group&rsquo;s plans together: when everyone is free, what is due, and
                who is doing what.
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
                  <Link
                    to={`/spaces/${space.id}`}
                    className="flex min-w-0 flex-1 items-center gap-3 p-3 active:bg-slate-50"
                  >
                    {space.pinned && <Icon name="star" filled className="h-4 w-4 shrink-0 text-amber-500" />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{space.name}</span>
                      <span className="block text-xs text-slate-500">
                        {spaceKindLabel(space.kind)} · {space.memberCount}{' '}
                        {space.memberCount === 1 ? 'member' : 'members'}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {spaceIds.length > 0 && (
        <Section title="Recent activity">
          {activity.loading && !activity.data ? (
            <Spinner inline label="Loading activity" />
          ) : activity.error ? (
            <Notice tone="warning">{activity.error}</Notice>
          ) : (
            <ActivityList items={activity.data ?? []} viewerId={userId ?? ''} spaceNames={spaceNames} nowMs={now} />
          )}
        </Section>
      )}
    </main>
  );
}
