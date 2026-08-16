// src/features/schedule/DaySelector.tsx
import { WEEKDAY_LABELS } from '@/domain/constants';

interface Props {
  days: number[];
  selected: number;
  onSelect: (day: number) => void;
}

export default function DaySelector({ days, selected, onSelect }: Props) {
  return (
    <div className="sticky top-0 z-10 flex gap-2 overflow-x-auto bg-slate-50/95 px-4 py-3 backdrop-blur lg:hidden">
      {days.map((day) => (
        <button
          key={day}
          type="button"
          aria-pressed={day === selected}
          onClick={() => onSelect(day)}
          className={`min-h-touch flex-1 rounded-full px-4 text-sm font-semibold ${
            day === selected ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'
          }`}
        >
          {WEEKDAY_LABELS[day]}
        </button>
      ))}
    </div>
  );
}
