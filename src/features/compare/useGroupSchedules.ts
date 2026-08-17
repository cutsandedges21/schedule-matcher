// src/features/compare/useGroupSchedules.ts
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { rowToMeeting, type ClassRow } from '@/domain/mappers';
import type { ClassMeeting } from '@/domain/types';

/**
 * Every selected member's schedule in one round trip, keyed by user id.
 *
 * Callers only ever pass ids drawn from the viewer's accepted-friends list, so
 * `classes_select` returns every row asked for; there is no "is this person
 * hiding from me" case to disambiguate here the way ComparePage has to. An id
 * missing from the result map genuinely has no classes saved.
 */
export function useGroupSchedules(userIds: string[]) {
  const [byUser, setByUser] = useState<Record<string, ClassMeeting[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Depend on a stable string, not the array identity: a caller that rebuilds
  // the id array every render would otherwise re-fetch on every render.
  const key = [...userIds].sort().join(',');

  useEffect(() => {
    let cancelled = false;
    const ids = key ? key.split(',') : [];

    async function run() {
      setLoading(true);
      setError(null);

      if (ids.length === 0) {
        setByUser({});
        setLoading(false);
        return;
      }

      const { data, error: queryError } = await supabase
        .from('classes')
        .select('id, user_id, name, instructor, room, course_code, section, days, start_minute, end_minute, color, sort_order')
        .in('user_id', ids)
        .order('sort_order');

      if (cancelled) return;

      if (queryError) {
        setError('Could not load these schedules. Check your connection and try again.');
        setLoading(false);
        return;
      }

      const grouped: Record<string, ClassMeeting[]> = {};
      for (const id of ids) grouped[id] = [];
      for (const row of (data ?? []) as ClassRow[]) {
        (grouped[row.user_id] ??= []).push(rowToMeeting(row));
      }

      setByUser(grouped);
      setLoading(false);
    }

    void run();
    return () => { cancelled = true; };
  }, [key]);

  return { byUser, loading, error };
}
