// src/features/calendar/SpaceCalendarPage.tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAsyncData } from '@/lib/useAsyncData';
import { addDays, startOfWeek, todayIn, zonedToEpoch, timeZoneCity } from '@/domain/zonedTime';
import { buttonClassName } from '@/components/Button';
import { Notice } from '@/components/Layout';
import Spinner from '@/components/Spinner';
import WeekNav from '@/components/WeekNav';
import { useSpace } from '@/features/spaces/SpaceLayout';
import { listSpaceEvents } from '@/features/events/api';
import { listPolls } from '@/features/polls/api';
import AgendaList from './AgendaList';
import { eventItems, proposedItems } from './agenda';

export default function SpaceCalendarPage() {
  const { space, me } = useSpace();
  const zone = space.timezone;
  const now = Date.now();
  const today = todayIn(zone, now);
  const thisWeek = startOfWeek(today);
  const [weekStart, setWeekStart] = useState(thisWeek);

  const from = zonedToEpoch(weekStart, 0, zone);
  const to = zonedToEpoch(addDays(weekStart, 7), 0, zone);
  const events = useAsyncData(
    () => listSpaceEvents(space.id, new Date(from).toISOString(), new Date(to).toISOString()),
    [space.id, weekStart],
    'Could not load the calendar.'
  );
  const polls = useAsyncData(() => listPolls(space.id), [space.id], 'Could not load proposed times.');

  const items = [
    ...eventItems(events.data ?? [], from, to, me.userId),
    ...proposedItems(polls.data ?? [], from, to, now),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2">
        <Link to={`/spaces/${space.id}/events/new`} className={buttonClassName('primary')}>
          New event
        </Link>
        <Link to={`/spaces/${space.id}/availability`} className={buttonClassName('secondary')}>
          Find a time
        </Link>
      </div>

      <WeekNav weekStart={weekStart} currentWeekStart={thisWeek} onChange={setWeekStart} />

      {events.error && <Notice tone="warning">{events.error}</Notice>}
      {events.loading && !events.data ? (
        <Spinner inline label="Loading the calendar" />
      ) : (
        <AgendaList items={items} timeZone={zone} today={today} emptyText="Nothing scheduled this week." />
      )}

      <p className="text-xs text-slate-500">Times are in {timeZoneCity(zone)} time, this space&rsquo;s time zone.</p>
    </div>
  );
}
