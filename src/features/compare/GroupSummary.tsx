// src/features/compare/GroupSummary.tsx
import { WEEKDAY_LABELS } from '@/domain/constants';
import { formatMinutes } from '@/domain/time';
import type { GroupSharedClass } from '@/domain/compare';
import type { Interval } from '@/domain/types';

export interface GroupPerson {
  id: string;
  /** "You" for the viewer, "@alice" for everyone else. */
  label: string;
}

interface Props {
  people: GroupPerson[];
  shared: GroupSharedClass[];
  freeByDay: Record<number, Interval[]>;
  days: number[];
}

function labelsFor(people: GroupPerson[], ids: string[]): string {
  const byId = new Map(people.map((p) => [p.id, p.label]));
  return ids.map((id) => byId.get(id) ?? id).join(', ');
}

export default function GroupSummary({ people, shared, freeByDay, days }: Props) {
  const everyone = shared.filter((s) => s.memberIds.length === people.length);
  const some = shared.filter((s) => s.memberIds.length < people.length);

  // Collapse "MATH 220 on Mon, Wed, Fri" into one line rather than three.
  const everyoneNames = [...new Set(everyone.map((s) => s.name))];

  const anyFree = days.some((day) => (freeByDay[day] ?? []).length > 0);

  return (
    <section className="mx-4 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-500">
          {people.length === 2 ? 'Both free' : 'Everyone free'}
        </h2>
        {!anyFree && (
          <p className="mt-1 text-sm text-slate-600">
            No window this week where all {people.length} of you are free at once.
          </p>
        )}
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
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-500">Classes together</h2>
        {everyoneNames.length === 0 && some.length === 0 ? (
          <p className="mt-1 text-sm text-slate-600">No classes in common.</p>
        ) : (
          <>
            {everyoneNames.length > 0 && (
              <p className="mt-1 text-sm">
                <span className="font-medium">All {people.length}:</span> {everyoneNames.join(', ')}
              </p>
            )}
            {some.length > 0 && (
              <ul className="mt-1 flex flex-col gap-1 text-sm text-slate-600">
                {/* classStartMinute, not startMinute: the latter is the window
                    these members overlap, and printing it here announced a 2:00
                    class as a 2:30 one whenever somebody's stored copy ran
                    late. See GroupSharedClass. */}
                {some.map((entry) => (
                  <li key={`${entry.name}-${entry.day}-${entry.classStartMinute}`}>
                    <span className="font-medium text-slate-900">{entry.name}</span>
                    {' · '}
                    {WEEKDAY_LABELS[entry.day]} {formatMinutes(entry.classStartMinute)}
                    {' · '}
                    {labelsFor(people, entry.memberIds)}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </section>
  );
}
