// src/features/upload/ReviewForm.tsx
import { useState } from 'react';
import ClassCard from './ClassCard';
import Button from '@/components/Button';
import { DAY_START_MINUTE } from '@/domain/constants';
import type { ExtractedClass } from '@/domain/types';

interface Props {
  initial: ExtractedClass[];
  warnings: string[];
  saving: boolean;
  onSave: (classes: ExtractedClass[]) => void;
}

const BLANK: ExtractedClass = {
  name: '', instructor: null, room: null, courseCode: null, section: null,
  days: [], startMinute: DAY_START_MINUTE, endMinute: DAY_START_MINUTE + 50,
};

export default function ReviewForm({ initial, warnings, saving, onSave }: Props) {
  const [classes, setClasses] = useState<ExtractedClass[]>(initial);

  const valid =
    classes.length > 0 &&
    classes.every((c) => c.name.trim() && c.days.length > 0 && c.endMinute > c.startMinute);

  return (
    <div className="pb-28">
      {warnings.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3">
          <p className="text-sm font-semibold text-amber-900">Check these</p>
          <ul className="mt-1 list-disc pl-4 text-sm text-amber-900">
            {warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {classes.map((c, i) => (
          <ClassCard
            key={i}
            index={i}
            value={c}
            onChange={(next) => setClasses(classes.map((old, j) => (j === i ? next : old)))}
            onRemove={() => setClasses(classes.filter((_, j) => j !== i))}
          />
        ))}
      </ul>

      <Button
        variant="secondary"
        onClick={() => setClasses([...classes, { ...BLANK }])}
        className="mt-3 w-full"
      >
        Add a class
      </Button>

      <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur">
        <Button disabled={!valid || saving} onClick={() => onSave(classes)} className="w-full">
          {saving ? 'Saving…' : 'Save schedule'}
        </Button>
      </div>
    </div>
  );
}
