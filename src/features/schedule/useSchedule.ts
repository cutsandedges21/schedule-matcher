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
      .select('id, user_id, name, instructor, room, days, start_minute, end_minute, color, sort_order')
      .eq('user_id', userId)
      .order('sort_order');

    if (queryError) setError('Could not load this schedule.');
    else setClasses((data as ClassRow[]).map(rowToMeeting));
    setLoading(false);
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  return { classes, loading, error, reload: load };
}

/** Replaces the caller's entire schedule with `next`. */
export async function saveSchedule(userId: string, next: ExtractedClass[]) {
  const { error: deleteError } = await supabase.from('classes').delete().eq('user_id', userId);
  if (deleteError) throw new Error('Could not clear your old schedule.');

  if (next.length === 0) return;

  const rows = next.map((c, index) => ({
    user_id: userId,
    name: c.name,
    instructor: c.instructor,
    room: c.room,
    days: c.days,
    start_minute: c.startMinute,
    end_minute: c.endMinute,
    color: colorForClass(c.name),
    sort_order: index,
  }));

  const { error: insertError } = await supabase.from('classes').insert(rows);
  if (insertError) throw new Error('Could not save your schedule.');
}
