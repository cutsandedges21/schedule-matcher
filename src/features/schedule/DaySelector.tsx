// src/features/schedule/DaySelector.tsx
import { WEEKDAY_INITIALS, WEEKDAY_LABELS } from '@/domain/constants';

interface Props {
  days: number[];
  selected: number;
  onSelect: (day: number) => void;
}

/**
 * The day chips above the grid.
 *
 * Initials rather than "Mon"/"Tue": once a weekend column appears this row
 * carries seven chips, and at roughly 60px of min-content each ("Mon" plus
 * `px-4`) they could not fit any phone narrower than ~500px. The row scrolled
 * sideways and the last days ran off the edge of the screen.
 *
 * `min-w-0` is what actually makes them fit. A flex item defaults to
 * `min-width: auto`, which refuses to shrink below its own text no matter what
 * basis it is given — so `flex-1` alone still overflowed. With `basis-0` and
 * `min-w-0` the chips divide the row evenly and always fit, which is why this
 * no longer needs `overflow-x-auto` to rescue it.
 */
export default function DaySelector({ days, selected, onSelect }: Props) {
  return (
    <div className="sticky top-0 z-10 flex gap-1.5 bg-slate-50/95 px-4 py-3 backdrop-blur lg:hidden">
      {days.map((day) => (
        <button
          key={day}
          type="button"
          aria-pressed={day === selected}
          // "M T W T F S S" has two Ts and two Ss, so the visible initial is
          // ambiguous read aloud. Give assistive tech the full day name.
          aria-label={WEEKDAY_LABELS[day]}
          onClick={() => onSelect(day)}
          className={`min-h-touch min-w-0 flex-1 basis-0 rounded-full text-sm font-semibold ${
            day === selected
              ? 'bg-accent text-accent-fg'
              : 'border border-slate-200 bg-white text-slate-600'
          }`}
        >
          {WEEKDAY_INITIALS[day]}
        </button>
      ))}
    </div>
  );
}
