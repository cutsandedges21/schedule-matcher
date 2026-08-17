// src/features/upload/ClassCard.tsx
import { ALL_WEEKDAYS, WEEKDAY_INITIALS, WEEKDAY_LABELS } from '@/domain/constants';
import { toTimeInputValue, parseTimeToMinutes } from '@/domain/time';
import type { ExtractedClass } from '@/domain/types';
import Button from '@/components/Button';

interface Props {
  value: ExtractedClass;
  index: number;
  onChange: (next: ExtractedClass) => void;
  onRemove: () => void;
}

export default function ClassCard({ value, index, onChange, onRemove }: Props) {
  const invalidTime = value.endMinute <= value.startMinute;

  function toggleDay(day: number) {
    const days = value.days.includes(day)
      ? value.days.filter((d) => d !== day)
      : [...value.days, day].sort((a, b) => a - b);
    onChange({ ...value, days });
  }

  function setTime(field: 'startMinute' | 'endMinute', raw: string) {
    const minutes = parseTimeToMinutes(raw);
    if (minutes !== null) onChange({ ...value, [field]: minutes });
  }

  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-4">
      <label className="text-xs font-medium text-slate-500" htmlFor={`name-${index}`}>Class</label>
      <input
        id={`name-${index}`}
        value={value.name}
        onChange={(e) => onChange({ ...value, name: e.target.value })}
        placeholder="BIO 101"
        className="min-h-touch w-full rounded-lg border border-slate-300 px-3"
      />

      <p className="mt-3 text-xs font-medium text-slate-500">Days</p>
      <div className="mt-1 flex gap-1.5">
        {ALL_WEEKDAYS.map((day) => (
          <button
            key={day}
            type="button"
            aria-pressed={value.days.includes(day)}
            // Was `Day 1`..`Day 7`, which tells a screen-reader user nothing.
            // The visible initial is ambiguous too — two Ts, two Ss.
            aria-label={WEEKDAY_LABELS[day]}
            onClick={() => toggleDay(day)}
            // No `min-w-touch`: seven 44px chips plus gaps cannot fit a 320px
            // phone, and a flex item's default `min-width: auto` means they
            // overflow rather than shrink. `basis-0 min-w-0` divides the row
            // evenly instead. Height stays a full 44px touch target.
            className={`min-h-touch min-w-0 flex-1 basis-0 rounded-lg border text-sm font-semibold ${
              value.days.includes(day)
                ? 'border-accent bg-accent text-accent-fg'
                : 'border-slate-300 bg-white text-slate-600'
            }`}
          >
            {WEEKDAY_INITIALS[day]}
          </button>
        ))}
      </div>
      {value.days.length === 0 && (
        <p className="mt-1 text-xs text-rose-600">Pick at least one day.</p>
      )}

      <div className="mt-3 flex gap-3">
        <div className="flex-1">
          <label className="text-xs font-medium text-slate-500" htmlFor={`start-${index}`}>Starts</label>
          <input
            id={`start-${index}`}
            type="time"
            value={toTimeInputValue(value.startMinute)}
            onChange={(e) => setTime('startMinute', e.target.value)}
            className="min-h-touch w-full rounded-lg border border-slate-300 px-3"
          />
        </div>
        <div className="flex-1">
          <label className="text-xs font-medium text-slate-500" htmlFor={`end-${index}`}>Ends</label>
          <input
            id={`end-${index}`}
            type="time"
            value={toTimeInputValue(value.endMinute)}
            onChange={(e) => setTime('endMinute', e.target.value)}
            className="min-h-touch w-full rounded-lg border border-slate-300 px-3"
          />
        </div>
      </div>
      {invalidTime && <p className="mt-1 text-xs text-rose-600">End time must be after the start.</p>}

      <div className="mt-3 flex gap-3">
        <div className="flex-1">
          <label className="text-xs font-medium text-slate-500" htmlFor={`code-${index}`}>Course code</label>
          <input
            id={`code-${index}`}
            value={value.courseCode ?? ''}
            onChange={(e) => onChange({ ...value, courseCode: e.target.value || null })}
            placeholder="Optional"
            className={`min-h-touch w-full rounded-lg border px-3 ${
              value.courseCode ? 'border-slate-300' : 'border-amber-300 bg-amber-50'
            }`}
          />
        </div>
        <div className="flex-1">
          <label className="text-xs font-medium text-slate-500" htmlFor={`section-${index}`}>Section</label>
          <input
            id={`section-${index}`}
            value={value.section ?? ''}
            onChange={(e) => onChange({ ...value, section: e.target.value || null })}
            placeholder="Optional"
            className={`min-h-touch w-full rounded-lg border px-3 ${
              value.section ? 'border-slate-300' : 'border-amber-300 bg-amber-50'
            }`}
          />
        </div>
      </div>

      <div className="mt-3 flex gap-3">
        <div className="flex-1">
          <label className="text-xs font-medium text-slate-500" htmlFor={`room-${index}`}>Room</label>
          <input
            id={`room-${index}`}
            value={value.room ?? ''}
            onChange={(e) => onChange({ ...value, room: e.target.value || null })}
            placeholder="Optional"
            className={`min-h-touch w-full rounded-lg border px-3 ${
              value.room ? 'border-slate-300' : 'border-amber-300 bg-amber-50'
            }`}
          />
        </div>
        <div className="flex-1">
          <label className="text-xs font-medium text-slate-500" htmlFor={`instructor-${index}`}>Instructor</label>
          <input
            id={`instructor-${index}`}
            value={value.instructor ?? ''}
            onChange={(e) => onChange({ ...value, instructor: e.target.value || null })}
            placeholder="Optional"
            className={`min-h-touch w-full rounded-lg border px-3 ${
              value.instructor ? 'border-slate-300' : 'border-amber-300 bg-amber-50'
            }`}
          />
        </div>
      </div>

      <Button variant="ghost" onClick={onRemove} className="mt-2 w-full text-rose-600">
        Remove class
      </Button>
    </li>
  );
}
