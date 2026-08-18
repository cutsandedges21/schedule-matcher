// src/features/friends/FriendSchedulePage.tsx
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';
import { areFriends } from './useFriends';
import {
  PROFILE_COLUMNS,
  rowToMeeting,
  rowToProfile,
  type ClassRow,
  type ProfileRow,
} from '@/domain/mappers';
import ScheduleGrid from '@/features/schedule/ScheduleGrid';
import Spinner from '@/components/Spinner';
import EmptyState from '@/components/EmptyState';
import SchoolChip from '@/features/theme/SchoolChip';
import { buttonClassName } from '@/components/Button';
import BackButton from '@/components/BackButton';
import type { ClassMeeting, Profile } from '@/domain/types';

type Status = 'loading' | 'not-found' | 'not-friends' | 'error' | 'ready';

export default function FriendSchedulePage() {
  const { username } = useParams<{ username: string }>();
  const { session } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [classes, setClasses] = useState<ClassMeeting[]>([]);
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setStatus('loading');

      const { data: profileRow, error: profileError } = await supabase
        .from('profiles')
        .select(PROFILE_COLUMNS)
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
        .select('id, user_id, name, instructor, room, course_code, section, days, start_minute, end_minute, color, sort_order')
        .eq('user_id', found.id)
        .order('sort_order');

      if (cancelled) return;
      if (classError) { setStatus('error'); return; }

      setProfile(found);
      setClasses(((classRows ?? []) as ClassRow[]).map(rowToMeeting));
      setStatus('ready');
    }

    void run();
    return () => { cancelled = true; };
  }, [username, session]);

  if (status === 'loading') return <Spinner label="Loading schedule" />;
  if (status === 'not-found') {
    return <EmptyState title="Not found" body="No student with that username." />;
  }
  if (status === 'error') {
    return (
      <EmptyState
        title="Something went wrong"
        body="Could not load that schedule. Check your connection and try again."
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

  return (
    <main>
      <div className="px-4 pt-4">
        <BackButton to="/friends" />
      </div>

      <header className="flex items-center justify-between px-4 pt-2">
        <div className="flex flex-col items-start gap-1">
          <h1 className="text-2xl font-bold">@{profile!.username}</h1>
          {profile!.displayName && <p className="text-sm text-slate-500">{profile!.displayName}</p>}
          <SchoolChip school={profile!.school} />
        </div>
        <Link to={`/compare/${profile!.username}`} className={buttonClassName('secondary')}>
          Compare
        </Link>
      </header>

      {classes.length === 0 ? (
        <EmptyState title="No schedule yet" body="They haven't added their schedule yet." />
      ) : (
        <div className="mt-2"><ScheduleGrid classes={classes} /></div>
      )}
    </main>
  );
}
