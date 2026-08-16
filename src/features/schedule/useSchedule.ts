// src/features/schedule/useSchedule.ts
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { rowToMeeting, type ClassRow } from '@/domain/mappers';
import { colorForClass } from '@/domain/color';
import type { ClassMeeting, ExtractedClass } from '@/domain/types';

export function useSchedule(userId: string | undefined) {
  const [classes, setClasses] = useState<ClassMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error: queryError } = await supabase
      .from('classes')
      .select('id, user_id, name, instructor, room, course_code, section, days, start_minute, end_minute, color, sort_order')
      .eq('user_id', userId)
      .order('sort_order');

    if (queryError) setError('Could not load this schedule.');
    else setClasses((data as ClassRow[]).map(rowToMeeting));
    setLoading(false);
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  return { classes, loading, error, reload: load };
}

/**
 * Replaces the caller's entire schedule with `next` in one atomic round trip.
 * `replace_schedule` deletes and re-inserts inside a single transaction under
 * RLS as the caller, so a dropped connection can no longer leave a student
 * with an emptied schedule and nothing to replace it.
 */
export async function saveSchedule(next: ExtractedClass[]) {
  const rows = next.map((c, index) => ({
    name: c.name,
    instructor: c.instructor,
    room: c.room,
    course_code: c.courseCode,
    section: c.section,
    days: c.days,
    start_minute: c.startMinute,
    end_minute: c.endMinute,
    color: colorForClass(c.name),
    sort_order: index,
  }));

  const { error } = await supabase.rpc('replace_schedule', { p_classes: rows });
  if (error) throw new Error('Could not save your schedule. Nothing was changed.');
}
