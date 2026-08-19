// src/features/compare/CompareSummary.tsx
import { WEEKDAY_LABELS } from '@/domain/constants';
import { formatMinutes } from '@/domain/time';
import type { SharedClass } from '@/domain/compare';
import type { Interval } from '@/domain/types';

interface Props {
  shared: SharedClass[];
  freeByDay: Record<number, Interval[]>;
  days: number[];
  theirUsername: string;
}

export default function CompareSummary({ shared, freeByDay, days, theirUsername }: Props) {
  const sharedNames = [...new Set(shared.map((s) => s.name))];

  /**
   * Classes you both have but stored at different times.
   *
   * The grid cannot show this: a shared class is drawn once from your copy, so
   * a bad extraction on their side is invisible there by construction. One of
   * the two schedules is wrong and only the students know which, so this says
   * what it knows and stops short of guessing.
   */
  const mismatched = [...new Set(shared.filter((s) => !s.timesMatch).map((s) => s.name))];

  return (
    <section className="mx-4 rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-500">Summary</h2>

      <p className="mt-2 text-sm">
        {sharedNames.length === 0
          ? 'No classes in common.'
          : `${sharedNames.length} shared ${sharedNames.length === 1 ? 'class' : 'classes'}: ${sharedNames.join(', ')}`}
      </p>

      {mismatched.length > 0 && (
        <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          You and @{theirUsername} have different times saved for{' '}
          <span className="font-semibold">{mismatched.join(', ')}</span>. One of the two schedules
          was read wrong — check yours against your official timetable, and ask them to check
          theirs.
        </p>
      )}

      <h3 className="mt-3 text-sm font-semibold text-slate-500">Both free</h3>
      <ul className="mt-1 flex flex-col gap-1 text-sm">
        {days.map((day) => {
          const windows = freeByDay[day] ?? [];
          return (
            <li key={day} className="flex gap-2">
              <span className="w-10 shrink-0 font-medium text-slate-500">{WEEKDAY_LABELS[day]}</span>
              <span className={windows.length === 0 ? 'text-slate-400' : 'font-medium text-emerald-700'}>
                {windows.length === 0
                  ? 'Nothing'
                  : windows.map((w) => `${formatMinutes(w.start)}–${formatMinutes(w.end)}`).join(', ')}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
