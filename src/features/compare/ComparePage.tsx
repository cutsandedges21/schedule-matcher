// src/features/compare/ComparePage.tsx
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';
import { useSchedule } from '@/features/schedule/useSchedule';
import { rowToMeeting, rowToProfile, type ClassRow, type ProfileRow } from '@/domain/mappers';
import { findSharedClasses, computeMutualFree } from '@/domain/compare';
import { WEEKDAYS } from '@/domain/constants';
import CompareGrid from './CompareGrid';
import CompareSummary from './CompareSummary';
import Spinner from '@/components/Spinner';
import EmptyState from '@/components/EmptyState';
import type { ClassMeeting, Interval, Profile } from '@/domain/types';

export default function ComparePage() {
  const { username } = useParams<{ username: string }>();
  const { session } = useAuth();
  const { classes: mine, loading: mineLoading } = useSchedule(session?.user.id);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [theirs, setTheirs] = useState<ClassMeeting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function run() {
      const { data: profileRow } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, invite_code')
        .eq('username', username!)
        .maybeSingle();

      if (!profileRow) { setLoading(false); return; }
      const found = rowToProfile(profileRow as ProfileRow);
      setProfile(found);

      const { data: classRows } = await supabase
        .from('classes')
        .select('id, user_id, name, instructor, room, days, start_minute, end_minute, color, sort_order')
        .eq('user_id', found.id)
        .order('sort_order');

      setTheirs(((classRows ?? []) as ClassRow[]).map(rowToMeeting));
      setLoading(false);
    }
    void run();
  }, [username]);

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

  if (loading || mineLoading) return <Spinner label="Comparing schedules" />;
  if (!profile) return <EmptyState title="Not found" body="No student with that username." />;

  if (theirs.length === 0) {
    return <EmptyState title={`@${profile.username}`} body="They haven't added their schedule yet." />;
  }

  return (
    <main>
      <header className="px-4 pt-4">
        <h1 className="text-2xl font-bold">You and @{profile.username}</h1>
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
          theirUsername={profile.username}
        />
      </div>
    </main>
  );
}
