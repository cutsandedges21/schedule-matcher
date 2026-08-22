// src/features/schedule/EditPanel.tsx
import ReviewForm from '@/features/upload/ReviewForm';
import Button from '@/components/Button';
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
 * The right half of the desktop editor. Deliberately stateless: SchedulePage
 * owns the draft, because the grid in the left column has to render from the
 * same value this form is editing.
 *
 * `warnings` is empty — warnings describe what an extractor could not read
 * from an image, and there is no image in this flow.
 */
export default function EditPanel({ value, onChange, saving, error, onSave, onCancel }: Props) {
  return (
    <section aria-label="Edit your classes">
      <h2 className="text-lg font-bold">Edit classes</h2>
      <p className="mt-1 text-sm text-slate-500">
        Your changes show on the schedule as you type. Nothing is saved until you press Save changes.
      </p>

      {error && (
        <div className="mt-3 rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900">
          {error}
        </div>
      )}

      <div className="mt-4">
        <ReviewForm
          value={value}
          onChange={onChange}
          warnings={[]}
          saving={saving}
          onSave={onSave}
          fixedBar={false}
          saveLabel="Save changes"
        />
      </div>

      <Button variant="secondary" onClick={onCancel} disabled={saving} className="mt-3 w-full">
        Cancel
      </Button>
    </section>
  );
}
