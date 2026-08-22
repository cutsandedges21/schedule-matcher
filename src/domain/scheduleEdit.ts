// src/domain/scheduleEdit.ts
import type { ExtractedClass } from './types';

/**
 * Element-wise, not set-wise. `ClassCard.toggleDay` re-sorts on every change,
 * so [3,1] cannot arise from the UI — and if it somehow did, reporting it as
 * a change is the safe direction to be wrong in: it prompts before discarding
 * rather than silently dropping edits.
 */
function sameDays(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((day, i) => day === b[i]);
}

function sameClass(a: ExtractedClass, b: ExtractedClass): boolean {
  return (
    a.name === b.name &&
    a.instructor === b.instructor &&
    a.room === b.room &&
    a.courseCode === b.courseCode &&
    a.section === b.section &&
    a.startMinute === b.startMinute &&
    a.endMinute === b.endMinute &&
    sameDays(a.days, b.days)
  );
}

/**
 * Whether the draft differs from the snapshot taken when editing began.
 *
 * Order-sensitive: `sort_order` is persisted, so a reordered list is a real
 * change. `ExtractedClass` is flat apart from `days`, which is why this is an
 * explicit comparison rather than a deep-equality dependency — the fields are
 * enumerated here so adding one to the type and forgetting it here shows up
 * as a compile error in `sameClass` rather than a silently missed edit.
 */
export function hasUnsavedChanges(draft: ExtractedClass[], baseline: ExtractedClass[]): boolean {
  if (draft.length !== baseline.length) return true;
  return !draft.every((c, i) => sameClass(c, baseline[i]));
}
