// src/features/schedule/ViewToggle.tsx
import type { ScheduleView } from './useScheduleView';

const OPTIONS: Array<{ value: ScheduleView; label: string }> = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
];

interface Props {
  value: ScheduleView;
  onChange: (next: ScheduleView) => void;
}

/**
 * The Day/Week switch above the grid.
 *
 * Two visible segments rather than one button that flips, because a lone button
 * reading "Week" is genuinely ambiguous — it says both "you are looking at the
 * week" and "tap here for the week" — and there is no room beside the grid for
 * a label long enough to disambiguate it.
 *
 * `aria-pressed` rather than a radiogroup: these are the same toggle buttons the
 * day chips use, and matching them keeps one interaction pattern in this header
 * instead of two.
 */
export default function ViewToggle({ value, onChange }: Props) {
  return (
    <div
      role="group"
      aria-label="Schedule view"
      className="flex shrink-0 gap-0.5 rounded-full border border-slate-200 bg-white p-0.5"
    >
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`rounded-full px-4 py-1.5 text-xs font-semibold ${
            value === option.value ? 'bg-accent text-accent-fg' : 'text-slate-600'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
