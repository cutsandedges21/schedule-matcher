// src/features/schedule/MobileEditor.tsx
import { useState } from 'react';
import ScheduleGrid from './ScheduleGrid';
import ClassSheet from './ClassSheet';
import Button from '@/components/Button';
import { extractedToPreviewMeetings, previewIndexOf } from '@/domain/mappers';
import { NEW_CLASS_DURATION_MINUTES } from '@/domain/gridTime';
import type { ExtractedClass } from '@/domain/types';

interface Props {
  value: ExtractedClass[];
  onChange: (next: ExtractedClass[]) => void;
  saving: boolean;
  error: string | null;
  onSave: (classes: ExtractedClass[]) => void;
  onCancel: () => void;
}

/**
 * Which class the sheet is editing.
 *
 * A `new` class is held here rather than appended to the draft on open, so
 * dismissing a sheet for a class you decided against leaves no trace and does
 * not trip the unsaved-changes prompt.
 */
type SheetTarget =
  | { kind: 'closed' }
  | { kind: 'existing'; index: number }
  | { kind: 'new'; seed: ExtractedClass };

export default function MobileEditor({
  value, onChange, saving, error, onSave, onCancel,
}: Props) {
  const [target, setTarget] = useState<SheetTarget>({ kind: 'closed' });

  const valid =
    value.length > 0 &&
    value.every((c) => c.name.trim() && c.days.length > 0 && c.endMinute > c.startMinute);

  const editing: ExtractedClass | null =
    target.kind === 'existing' ? value[target.index] ?? null
    : target.kind === 'new' ? target.seed
    : null;

  function updateEditing(next: ExtractedClass) {
    if (target.kind === 'existing') {
      // Write through on every keystroke — this is what the live preview reads.
      onChange(value.map((old, i) => (i === target.index ? next : old)));
    } else if (target.kind === 'new') {
      setTarget({ kind: 'new', seed: next });
    }
  }

  function done() {
    if (target.kind === 'new') onChange([...value, target.seed]);
    setTarget({ kind: 'closed' });
  }

  function remove() {
    if (target.kind === 'existing') {
      onChange(value.filter((_, i) => i !== target.index));
    }
    setTarget({ kind: 'closed' });
  }

  return (
    <main>
      <header className="flex items-center justify-between gap-2 px-3 pt-3">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <h1 className="truncate text-base font-bold">Edit schedule</h1>
        <Button size="sm" disabled={!valid || saving} onClick={() => onSave(value)}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </header>

      {error && (
        <div className="mx-3 mt-2 rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900">
          {error}
        </div>
      )}

      {/* Load-bearing, not decoration: nobody discovers long-press unprompted. */}
      <p className="px-4 pt-2 text-center text-xs text-slate-500">
        Tap a class to edit it. Press and hold an empty slot to add one.
      </p>

      <ScheduleGrid
        classes={extractedToPreviewMeetings(value)}
        onSelectClass={(meeting) => {
          const index = previewIndexOf(meeting);
          if (index !== null) setTarget({ kind: 'existing', index });
        }}
        onCreateAt={(day, startMinute) =>
          setTarget({
            kind: 'new',
            seed: {
              name: '', instructor: null, room: null, courseCode: null, section: null,
              days: [day],
              startMinute,
              endMinute: startMinute + NEW_CLASS_DURATION_MINUTES,
            },
          })
        }
        // The sheet's class may not exist on the newly selected day, and
        // editing something you cannot see is worse than closing.
        onDayChange={() => setTarget({ kind: 'closed' })}
      />

      {editing && (
        <ClassSheet
          value={editing}
          onChange={updateEditing}
          onDone={done}
          onDelete={remove}
          onClose={() => setTarget({ kind: 'closed' })}
        />
      )}
    </main>
  );
}
