// src/features/home/TodayClasses.tsx
import { Link } from 'react-router-dom';
import { CLASS_COLORS } from '@/domain/color';
import { formatMinutes } from '@/domain/time';
import type { ClassMeeting } from '@/domain/types';
import { buttonClassName } from '@/components/Button';
import { InlineEmpty } from '@/components/Layout';

/**
 * The student's own classes for one weekday, in start order, from the weekly
 * schedule they already saved — the existing core of the app, surfaced first
 * thing on Home rather than a tab away.
 */
export default function TodayClasses({
  classes,
  weekday,
  hasSchedule,
}: {
  classes: ClassMeeting[];
  weekday: number;
  hasSchedule: boolean;
}) {
  if (!hasSchedule) {
    return (
      <div className="flex flex-col items-start gap-2 rounded-2xl border border-dashed border-slate-300 bg-white p-4">
        <p className="text-sm text-slate-700">
          Add your class schedule once. Friends and your spaces use it to find when you are free.
        </p>
        <Link to="/upload" className={buttonClassName('primary', undefined, 'sm')}>
          Add your schedule
        </Link>
      </div>
    );
  }

  const today = classes
    .filter((c) => c.days.includes(weekday))
    .sort((a, b) => a.startMinute - b.startMinute);

  if (today.length === 0) return <InlineEmpty>No classes today.</InlineEmpty>;

  return (
    <ul className="flex flex-col gap-1.5">
      {today.map((meeting) => {
        const styles = CLASS_COLORS[meeting.color] ?? CLASS_COLORS.indigo;
        return (
          <li
            key={meeting.id}
            className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 ${styles.block} ${styles.text}`}
          >
            <span className="min-w-0 truncate text-sm font-semibold">{meeting.name}</span>
            <span className="shrink-0 text-xs font-medium">
              {formatMinutes(meeting.startMinute)} – {formatMinutes(meeting.endMinute)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
