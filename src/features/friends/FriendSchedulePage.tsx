// src/features/friends/FriendSchedulePage.tsx
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { rowToMeeting, rowToProfile, type ClassRow, type ProfileRow } from '@/domain/mappers';
import ScheduleGrid from '@/features/schedule/ScheduleGrid';
import Spinner from '@/components/Spinner';
import EmptyState from '@/components/EmptyState';
import Button from '@/components/Button';
import type { ClassMeeting, Profile } from '@/domain/types';

export default function FriendSchedulePage() {
  const { username } = useParams<{ username: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [classes, setClasses] = useState<ClassMeeting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function run() {
      setLoading(true);
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

      setClasses(((classRows ?? []) as ClassRow[]).map(rowToMeeting));
      setLoading(false);
    }
    void run();
  }, [username]);

  if (loading) return <Spinner label="Loading schedule" />;
  if (!profile) return <EmptyState title="Not found" body="No student with that username." />;

  return (
    <main>
      <header className="flex items-center justify-between px-4 pt-4">
        <div>
          <h1 className="text-2xl font-bold">@{profile.username}</h1>
          {profile.displayName && <p className="text-sm text-slate-500">{profile.displayName}</p>}
        </div>
        <Link to={`/compare/${profile.username}`}>
          <Button variant="secondary">Compare</Button>
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
