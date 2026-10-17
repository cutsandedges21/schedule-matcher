// src/features/spaces/SpaceKindPicker.tsx
import { SPACE_KINDS, type SpaceKind } from '@/domain/spaces';

/** Real radio inputs behind the cards, so arrow keys and screen readers treat it as one choice. */
export default function SpaceKindPicker({
  value,
  onChange,
  disabled,
}: {
  value: SpaceKind;
  onChange: (kind: SpaceKind) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="flex flex-col gap-1" disabled={disabled}>
      <legend className="text-sm font-medium text-slate-700">What is it for?</legend>
      <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {SPACE_KINDS.map((kind) => {
          const checked = kind.id === value;
          return (
            <label
              key={kind.id}
              className={`flex min-h-touch cursor-pointer flex-col rounded-xl border bg-white px-3 py-2 ${
                checked ? 'border-accent ring-1 ring-accent' : 'border-slate-200'
              }`}
            >
              <input
                type="radio"
                name="space-kind"
                value={kind.id}
                checked={checked}
                onChange={() => onChange(kind.id)}
                className="sr-only"
              />
              <span className="text-sm font-semibold">{kind.label}</span>
              <span className="text-xs leading-snug text-slate-500">{kind.hint}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
