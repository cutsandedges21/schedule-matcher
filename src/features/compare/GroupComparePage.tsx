// src/features/compare/GroupComparePage.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { logCompareGroup } from '@/lib/analytics';
import { useAuth } from '@/features/auth/AuthProvider';
import { useFriends } from '@/features/friends/useFriends';
import { useGroupSchedules } from './useGroupSchedules';
import { computeGroupFree, findGroupSharedClasses, type GroupMember } from '@/domain/compare';
import { MAX_GROUP_FRIENDS, WEEKDAYS } from '@/domain/constants';
import { todayWeekday } from '@/features/schedule/ScheduleGrid';
import Button, { buttonClassName } from '@/components/Button';
import Spinner from '@/components/Spinner';
import EmptyState from '@/components/EmptyState';
import BackButton from '@/components/BackButton';
import GroupPicker from './GroupPicker';
import GroupSummary, { type GroupPerson } from './GroupSummary';
import GroupGrid from './GroupGrid';
import type { Interval } from '@/domain/types';

/**
 * How long a selection has to hold still before it counts as the group the
 * student meant. Long enough to cover the gap between two deliberate taps in
 * the picker, short enough that nobody navigates away before it fires.
 */
const GROUP_LOG_SETTLE_MS = 2500;

/**
 * The selection lives in `?with=alice,bob` rather than in component state so
 * the browser back button steps through it and a group can be shared as a
 * link. Anything in the parameter that is not currently an accepted friend is
 * dropped: their classes would come back empty under RLS and quietly make the
 * group look freer than it is.
 */
export default function GroupComparePage() {
  const { session } = useAuth();
  const { friends, loading: friendsLoading, error: friendsError } = useFriends(session?.user.id);
  const [params, setParams] = useSearchParams();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState(todayWeekday);

  const requested = useMemo(() => {
    const raw = params.get('with') ?? '';
    return [...new Set(raw.split(',').map((s) => s.trim()).filter(Boolean))];
  }, [params]);

  const selectedFriends = useMemo(() => {
    const known = new Map(friends.map((f) => [f.username, f]));
    return requested
      .map((username) => known.get(username))
      .filter((f): f is NonNullable<typeof f> => f !== undefined)
      .slice(0, MAX_GROUP_FRIENDS);
  }, [requested, friends]);

  const selectedUsernames = selectedFriends.map((f) => f.username);

  const memberIds = useMemo(
    () => (session ? [session.user.id, ...selectedFriends.map((f) => f.id)] : []),
    [session, selectedFriends]
  );

  const { byUser, loading: schedulesLoading, error: schedulesError } = useGroupSchedules(memberIds);

  const people: GroupPerson[] = useMemo(
    () => [
      { id: session?.user.id ?? 'me', label: 'You' },
      ...selectedFriends.map((f) => ({ id: f.id, label: `@${f.username}` })),
    ],
    [session, selectedFriends]
  );

  const members: GroupMember[] = useMemo(
    () => people.map((p) => ({ id: p.id, classes: byUser[p.id] ?? [] })),
    [people, byUser]
  );

  const days = useMemo(() => {
    const all = members.flatMap((m) => m.classes);
    const weekend = [6, 7].filter((d) => all.some((c) => c.days.includes(d)));
    return [...WEEKDAYS, ...weekend];
  }, [members]);

  const shared = useMemo(() => findGroupSharedClasses(members), [members]);

  const freeByDay = useMemo(() => {
    const map: Record<number, Interval[]> = {};
    const schedules = members.map((m) => m.classes);
    for (const day of days) map[day] = computeGroupFree(schedules, day);
    return map;
  }, [members, days]);

  // Somebody with no saved schedule reads as free all week, which would
  // silently inflate every window below. Say so instead of letting the summary
  // lie by omission.
  const missingSchedules = people.filter((p) => (byUser[p.id] ?? []).length === 0);

  // Phase 0: the group size a student settled on, which is the number §6 of
  // the monetization spec turns on — what share of students would have hit a
  // two-friend cap.
  //
  // Debounced, and only once the grid has actually rendered. The selection
  // lives in the URL and changes on every tap, so logging eagerly would record
  // 1, then 2, then 3 as somebody assembles a group of three, and inflate
  // precisely the small sizes the cap question is about.
  //
  // Each distinct size is recorded once per visit. That keeps the per-user
  // maximum — the figure the cap question actually needs — intact, while
  // toggling the same friend in and out does not multiply into the totals.
  const loggedSizes = useRef<Set<number>>(new Set());
  const groupSize = selectedFriends.length;
  const groupRendered = groupSize > 0 && !schedulesLoading && !schedulesError;
  const viewerId = session?.user.id;

  useEffect(() => {
    if (!groupRendered || !viewerId) return;
    const sizes = loggedSizes.current;
    if (sizes.has(groupSize)) return;

    const timer = setTimeout(() => {
      sizes.add(groupSize);
      logCompareGroup(viewerId, groupSize);
    }, GROUP_LOG_SETTLE_MS);

    return () => clearTimeout(timer);
  }, [groupRendered, groupSize, viewerId]);

  function toggle(username: string) {
    const next = selectedUsernames.includes(username)
      ? selectedUsernames.filter((u) => u !== username)
      : [...selectedUsernames, username].slice(0, MAX_GROUP_FRIENDS);

    setParams(next.length > 0 ? { with: next.join(',') } : {}, { replace: false });
    // Picking your first friend must not slam the picker shut on you — you are
    // usually about to pick a second. It closes on "Done", not on selection.
    setPickerOpen(true);
  }

  if (friendsLoading) return <Spinner label="Loading friends" />;

  if (friendsError) {
    return <EmptyState title="Something went wrong" body={friendsError} />;
  }

  if (friends.length === 0) {
    return (
      <EmptyState
        title="Nobody to compare with yet"
        body="Add a friend first, then come back to line your weeks up side by side."
        action={<Link to="/friends" className={buttonClassName()}>Find friends</Link>}
      />
    );
  }

  const showPicker = pickerOpen || selectedFriends.length === 0;

  return (
    <main className="flex flex-col gap-4 pb-6">
      <div className="px-4 pt-4">
        <BackButton to="/friends" />
      </div>

      <header className="flex items-start justify-between gap-3 px-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Compare</h1>
          <p className="truncate text-sm text-slate-500">
            {selectedFriends.length === 0
              ? `Pick up to ${MAX_GROUP_FRIENDS} friends`
              : `You and ${selectedUsernames.map((u) => `@${u}`).join(', ')}`}
          </p>
        </div>
        {selectedFriends.length > 0 && (
          <Button size="sm" variant="secondary" onClick={() => setPickerOpen((open) => !open)}>
            {pickerOpen ? 'Done' : 'Edit'}
          </Button>
        )}
      </header>

      {showPicker && (
        <GroupPicker friends={friends} selected={selectedUsernames} onToggle={toggle} />
      )}

      {selectedFriends.length === 0 ? null : schedulesLoading ? (
        <Spinner label="Comparing schedules" />
      ) : schedulesError ? (
        <EmptyState title="Something went wrong" body={schedulesError} />
      ) : (
        <>
          {missingSchedules.length > 0 && (
            <p className="mx-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              No saved schedule: {missingSchedules.map((p) => p.label).join(', ')} — counted as
              free all week here.
            </p>
          )}

          <GroupSummary people={people} shared={shared} freeByDay={freeByDay} days={days} />

          <GroupGrid
            people={people}
            classesByPerson={byUser}
            shared={shared}
            days={days}
            freeByDay={freeByDay}
            selectedDay={days.includes(selectedDay) ? selectedDay : days[0]}
            onSelectDay={setSelectedDay}
          />
        </>
      )}

      {selectedFriends.length === 1 && (
        <p className="px-4 text-xs text-slate-500">
          Comparing with one person?{' '}
          <Link to={`/compare/${selectedUsernames[0]}`} className="font-medium underline">
            Open the detailed side-by-side view
          </Link>
          .
        </p>
      )}
    </main>
  );
}
