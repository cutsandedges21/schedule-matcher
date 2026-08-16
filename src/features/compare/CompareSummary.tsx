// src/features/compare/CompareSummary.tsx
import { WEEKDAY_LABELS } from '@/domain/constants';
import { formatMinutes } from '@/domain/time';
import type { SharedClass } from '@/domain/compare';
import type { Interval } from '@/domain/types';

interface Props {
  shared: SharedClass[];
  freeByDay: Record<number, Interval[]>;
  days: number[];
}

export default function CompareSummary({ shared, freeByDay, days }: Props) {
  const sharedNames = [...new Set(shared.map((s) => s.name))];

  return (
    <section className="mx-4 rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-500">Summary</h2>

      <p className="mt-2 text-sm">
        {sharedNames.length === 0
          ? 'No classes in common.'
          : `${sharedNames.length} shared ${sharedNames.length === 1 ? 'class' : 'classes'}: ${sharedNames.join(', ')}`}
      </p>

      <h3 className="mt-3 text-sm font-semibold text-slate-500">Both free</h3>
      <ul className="mt-1 flex flex-col gap-1 text-sm">
        {days.map((day) => {
          const windows = freeByDay[day] ?? [];
          return (
            <li key={day} className="flex gap-2">
              <span className="w-10 shrink-0 font-medium text-slate-500">{WEEKDAY_LABELS[day]}</span>
              <span className="text-slate-700">
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
