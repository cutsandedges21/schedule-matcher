// src/features/spaces/SpaceOverviewPage.tsx
import { Link } from 'react-router-dom';
import { useAsyncData } from '@/lib/useAsyncData';
import { canInSpace } from '@/domain/spaces';
import { Card, Notice, Section } from '@/components/Layout';
import Spinner from '@/components/Spinner';
import ActivityList from './ActivityList';
import { useSpace } from './SpaceLayout';
import { listActivity } from './api';

export default function SpaceOverviewPage() {
  const { space, members, me } = useSpace();
  const activity = useAsyncData(() => listActivity([space.id], 15), [space.id], 'Could not load recent activity.');
  const canInvite = canInSpace({ role: me.role, membersCanInvite: space.membersCanInvite }, 'invite');

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:items-start">
      <div className="flex flex-col gap-6">
        {space.description && (
          <Card>
            <p className="whitespace-pre-line text-sm text-slate-700">{space.description}</p>
          </Card>
        )}

        {members.length === 1 && (
          <Notice tone="info">
            You are the only member so far.{' '}
            {canInvite ? (
              <Link to="members" className="font-semibold underline">
                Invite your group
              </Link>
            ) : (
              'Ask the owner to invite the rest of your group.'
            )}{' '}
            — finding a time needs at least two people.
          </Notice>
        )}
      </div>

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
  );
}
