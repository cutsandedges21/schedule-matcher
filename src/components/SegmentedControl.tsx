// src/components/SegmentedControl.tsx

/**
 * A row of mutually exclusive choices — task views, matching mode. Buttons
 * with aria-pressed rather than radios, matching DaySelector, so each option
 * is one tap and one Tab stop. Scrolls sideways if the labels outgrow a
 * narrow phone instead of wrapping into two rows.
 */
export default function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 [scrollbar-width:none]">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={`flex min-h-touch shrink-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-sm font-semibold transition-colors ${
              active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
            }`}
          >
            {option.label}
            {option.count !== undefined && option.count > 0 && (
              <span className={`rounded-full px-1.5 text-xs ${active ? 'bg-slate-100' : 'bg-slate-200'}`}>{option.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
