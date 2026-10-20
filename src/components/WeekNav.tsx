// src/components/WeekNav.tsx
import { addDays, formatDateKey, parseDateKey, type DateKey } from '@/domain/zonedTime';
import Button from './Button';

const MONTH = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short' });

function rangeLabel(start: DateKey): string {
  const end = addDays(start, 6);
  const a = parseDateKey(start);
  const b = parseDateKey(end);
  const monthA = MONTH.format(new Date(Date.UTC(a.year, a.month - 1, a.day, 12)));
  const monthB = MONTH.format(new Date(Date.UTC(b.year, b.month - 1, b.day, 12)));
  return monthA === monthB ? `${monthA} ${a.day} – ${b.day}` : `${monthA} ${a.day} – ${monthB} ${b.day}`;
}

/** Previous / this / next week, for the calendars. `weekStart` is a Monday. */
export default function WeekNav({
  weekStart,
  currentWeekStart,
  onChange,
}: {
  weekStart: DateKey;
  currentWeekStart: DateKey;
  onChange: (weekStart: DateKey) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Button variant="secondary" size="sm" aria-label="Previous week" onClick={() => onChange(addDays(weekStart, -7))}>
        ←
      </Button>
      <div className="flex flex-col items-center">
        <p className="text-sm font-semibold" aria-live="polite">
          {rangeLabel(weekStart)}
        </p>
        {weekStart !== currentWeekStart ? (
          <button
            type="button"
            onClick={() => onChange(currentWeekStart)}
            className="text-xs font-medium text-slate-500 underline underline-offset-2"
          >
            Back to this week
          </button>
        ) : (
          <span className="text-xs text-slate-500">This week · from {formatDateKey(weekStart, 'weekday')}</span>
        )}
      </div>
      <Button variant="secondary" size="sm" aria-label="Next week" onClick={() => onChange(addDays(weekStart, 7))}>
        →
      </Button>
    </div>
  );
}
