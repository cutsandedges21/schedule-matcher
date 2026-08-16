// src/features/compare/ComparePage.tsx
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';
import { useSchedule } from '@/features/schedule/useSchedule';
import { areFriends } from '@/features/friends/useFriends';
import { rowToMeeting, rowToProfile, type ClassRow, type ProfileRow } from '@/domain/mappers';
import { findSharedClasses, computeMutualFree } from '@/domain/compare';
import { WEEKDAYS } from '@/domain/constants';
import CompareGrid from './CompareGrid';
import CompareSummary from './CompareSummary';
import Spinner from '@/components/Spinner';
import EmptyState from '@/components/EmptyState';
import type { ClassMeeting, Interval, Profile } from '@/domain/types';

type Status = 'loading' | 'not-found' | 'not-friends' | 'error' | 'ready';

export default function ComparePage() {
  const { username } = useParams<{ username: string }>();
  const { session } = useAuth();
  const { classes: mine, loading: mineLoading, error: mineError } = useSchedule(session?.user.id);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [theirs, setTheirs] = useState<ClassMeeting[]>([]);
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    let cancelled = false;

    async function run() {
      // Reset immediately: without this, navigating /compare/alice ->
      // /compare/bob keeps rendering Alice's classes under Bob's name until
      // the new fetch lands.
      setStatus('loading');
      setProfile(null);
      setTheirs([]);

      const { data: profileRow, error: profileError } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, invite_code')
        .eq('username', username!)
        .maybeSingle();

      if (cancelled) return;
      if (profileError) { setStatus('error'); return; }
      if (!profileRow) { setStatus('not-found'); return; }

      const found = rowToProfile(profileRow as ProfileRow);

      // `profiles` is world-readable but `classes` is friends-only under RLS —
      // a stranger's profile loads fine while their classes query silently
      // returns []. Check friendship explicitly so we can tell "not friends"
      // apart from "friend genuinely has no schedule yet".
      if (found.id !== session!.user.id) {
        try {
          const friends = await areFriends(session!.user.id, found.id);
          if (cancelled) return;
          if (!friends) { setProfile(found); setStatus('not-friends'); return; }
        } catch {
          if (!cancelled) setStatus('error');
          return;
        }
      }

      const { data: classRows, error: classError } = await supabase
        .from('classes')
        .select('id, user_id, name, instructor, room, days, start_minute, end_minute, color, sort_order')
        .eq('user_id', found.id)
        .order('sort_order');

      if (cancelled) return;
      if (classError) { setStatus('error'); return; }

      setProfile(found);
      setTheirs(((classRows ?? []) as ClassRow[]).map(rowToMeeting));
      setStatus('ready');
    }

    void run();
    return () => { cancelled = true; };
  }, [username, session]);

  const days = useMemo(() => {
    const weekend = [6, 7].filter((d) =>
      [...mine, ...theirs].some((c) => c.days.includes(d))
    );
    return [...WEEKDAYS, ...weekend];
  }, [mine, theirs]);

  const shared = useMemo(() => findSharedClasses(mine, theirs), [mine, theirs]);

  const freeByDay = useMemo(() => {
    const map: Record<number, Interval[]> = {};
    for (const day of days) map[day] = computeMutualFree(mine, theirs, day);
    return map;
  }, [mine, theirs, days]);

  if (status === 'loading' || mineLoading) return <Spinner label="Comparing schedules" />;

  if (mineError) {
    return <EmptyState title="Something went wrong" body={mineError} />;
  }
  if (status === 'not-found') {
    return <EmptyState title="Not found" body="No student with that username." />;
  }
  if (status === 'error') {
    return (
      <EmptyState
        title="Something went wrong"
        body="Could not load that comparison. Check your connection and try again."
      />
    );
  }
  if (status === 'not-friends') {
    return (
      <EmptyState
        title={profile ? `@${profile.username}` : 'Not friends'}
        body="You need to be friends to see this schedule."
      />
    );
  }

  if (theirs.length === 0) {
    return <EmptyState title={`@${profile!.username}`} body="They haven't added their schedule yet." />;
  }

  return (
    <main>
      <header className="px-4 pt-4">
        <h1 className="text-2xl font-bold">You and @{profile!.username}</h1>
      </header>

      <div className="mt-4">
        <CompareSummary shared={shared} freeByDay={freeByDay} days={days} />
      </div>

      <div className="mt-4">
        <CompareGrid
          mine={mine}
          theirs={theirs}
          days={days}
          freeByDay={freeByDay}
          theirUsername={profile!.username}
        />
      </div>
    </main>
  );
}
