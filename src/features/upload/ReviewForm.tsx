// src/features/upload/ReviewForm.tsx
import ClassCard from './ClassCard';
import Button from '@/components/Button';
import { DAY_START_MINUTE } from '@/domain/constants';
import type { ExtractedClass } from '@/domain/types';

interface Props {
  value: ExtractedClass[];
  onChange: (next: ExtractedClass[]) => void;
  warnings: string[];
  saving: boolean;
  onSave: (classes: ExtractedClass[]) => void;
  /**
   * Pins the save bar to the bottom of the viewport. Right for the full-page
   * upload flow; wrong in the split-screen editor, where a viewport-fixed bar
   * would float over the schedule grid in the other column.
   */
  fixedBar?: boolean;
  saveLabel?: string;
}

const BLANK: ExtractedClass = {
  name: '', instructor: null, room: null, courseCode: null, section: null,
  days: [], startMinute: DAY_START_MINUTE, endMinute: DAY_START_MINUTE + 50,
};

/**
 * Controlled on purpose. The split-screen editor renders a live preview of the
 * schedule beside this form, which needs the in-progress list on every
 * keystroke — internal state could only surface it on save.
 */
export default function ReviewForm({
  value,
  onChange,
  warnings,
  saving,
  onSave,
  fixedBar = true,
  saveLabel = 'Save schedule',
}: Props) {
  const valid =
    value.length > 0 &&
    value.every((c) => c.name.trim() && c.days.length > 0 && c.endMinute > c.startMinute);

  const saveButton = (
    <Button disabled={!valid || saving} onClick={() => onSave(value)} className="w-full">
      {saving ? 'Saving…' : saveLabel}
    </Button>
  );

  return (
    <div className={fixedBar ? 'pb-28' : undefined}>
      {warnings.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3">
          <p className="text-sm font-semibold text-amber-900">Check these</p>
          <ul className="mt-1 list-disc pl-4 text-sm text-amber-900">
            {warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {value.map((c, i) => (
          <ClassCard
            key={i}
            index={i}
            value={c}
            onChange={(next) => onChange(value.map((old, j) => (j === i ? next : old)))}
            onRemove={() => onChange(value.filter((_, j) => j !== i))}
          />
        ))}
      </ul>

      <Button
        variant="secondary"
        onClick={() => onChange([...value, { ...BLANK }])}
        className="mt-3 w-full"
      >
        Add a class
      </Button>

      {fixedBar ? (
        <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur">
          {saveButton}
        </div>
      ) : (
        <div className="mt-4">{saveButton}</div>
      )}
    </div>
  );
}
