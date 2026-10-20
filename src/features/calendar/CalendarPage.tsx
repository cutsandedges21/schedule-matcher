// src/features/calendar/CalendarPage.tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { useSchedule } from '@/features/schedule/useSchedule';
import { useAsyncData } from '@/lib/useAsyncData';
import { responseOf } from '@/domain/events';
import {
  addDays,
  browserTimeZone,
  eachDateKey,
  isoWeekday,
  startOfWeek,
  todayIn,
  zonedToEpoch,
} from '@/domain/zonedTime';
import { buttonClassName } from '@/components/Button';
import { CheckboxField } from '@/components/Field';
import { Notice, PageHeader } from '@/components/Layout';
import Spinner from '@/components/Spinner';
import WeekNav from '@/components/WeekNav';
import { listMyEvents } from '@/features/events/api';
import AgendaList, { type AgendaItem } from './AgendaList';
import { eventItems } from './agenda';

/**
 * Every event in every space the student is in, on their own clock, with
 * their classes alongside if they want them — the one place to see whether
 * Thursday is actually free.
 */
export default function CalendarPage() {
  const { session } = useAuth();
  const userId = session?.user.id ?? '';
  const zone = browserTimeZone();
  const now = Date.now();
  const today = todayIn(zone, now);
  const thisWeek = startOfWeek(today);
  const [weekStart, setWeekStart] = useState(thisWeek);
  const [onlyMine, setOnlyMine] = useState(false);
  const [showClasses, setShowClasses] = useState(true);

  const from = zonedToEpoch(weekStart, 0, zone);
  const to = zonedToEpoch(addDays(weekStart, 7), 0, zone);
  const events = useAsyncData(
    () => listMyEvents(new Date(from).toISOString(), new Date(to).toISOString()),
    [weekStart],
    'Could not load your calendar.'
  );
  const schedule = useSchedule(userId);

  const visibleEvents = (events.data ?? []).filter((event) => {
    if (!onlyMine) return true;
    const response = responseOf(event, userId);
    return response !== null && response !== 'declined';
  });

  const classItems: AgendaItem[] = showClasses
    ? eachDateKey(weekStart, addDays(weekStart, 6)).flatMap((date) =>
        schedule.classes
          .filter((c) => c.days.includes(isoWeekday(date)))
          .map((c) => ({
            key: `class-${c.id}-${date}`,
            start: zonedToEpoch(date, c.startMinute, zone),
            end: zonedToEpoch(date, c.endMinute, zone),
            title: c.name,
            detail: c.room ? `Class · ${c.room}` : 'Class',
            tone: 'class' as const,
          }))
      )
    : [];

  const items = [...eventItems(visibleEvents, from, to, userId, { showSpace: true }), ...classItems];

  return (
    <main className="flex flex-col gap-4 px-4 pb-6 pt-4">
      <PageHeader
        title="Calendar"
        subtitle="Events from all your spaces"
        actions={
          <Link to="/spaces" className={buttonClassName('secondary', undefined, 'sm')}>
            Spaces
          </Link>
        }
      />

      <WeekNav weekStart={weekStart} currentWeekStart={thisWeek} onChange={setWeekStart} />

      <div className="flex flex-wrap gap-x-4">
        <CheckboxField label="Only events I'm going to" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />
        <CheckboxField label="Show my classes" checked={showClasses} onChange={(e) => setShowClasses(e.target.checked)} />
      </div>

      {events.error && <Notice tone="warning">{events.error}</Notice>}
      {events.loading && !events.data ? (
        <Spinner inline label="Loading your calendar" />
      ) : (
        <AgendaList
          items={items}
          timeZone={zone}
          today={today}
          emptyText="Nothing this week. Plan something from one of your spaces."
        />
      )}
    </main>
  );
}
