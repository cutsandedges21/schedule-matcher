# Edit a Saved Schedule — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a student edit their already-saved schedule from a desktop split-screen view — grid on the left updating live, editable class list on the right.

**Architecture:** No new routes, no schema changes, no new RPCs. `SchedulePage` gains an `editing` flag that swaps its body for a two-column layout. The right column reuses `ReviewForm`/`ClassCard` from the upload flow, which becomes a controlled component so the parent can render a live preview from in-progress edit state. Save reuses the existing `saveSchedule()` → `replace_schedule` RPC.

**Tech Stack:** React 19, TypeScript, Tailwind, react-router-dom v7, Supabase JS, Vitest (+ jsdom and @testing-library/react for component tests).

**Spec:** `docs/superpowers/specs/2026-08-22-edit-saved-schedule-design.md`

---

## Context you need before starting

**Run all commands from the repo root:** `c:/Users/sport/OneDrive/Documents/CodingPersonal/schedule-matcher`

**Branch:** `feat/edit-saved-schedule` (already exists, already has the spec committed). Confirm with `git branch --show-current` before starting.

**Commands:**
- Run one test file: `npx vitest run <path>`
- Run all tests: `npm test`
- Typecheck: `npx tsc -b`
- Dev server: `npm run dev`

**Two domain types you will use constantly** (`src/domain/types.ts`, already exist — do not redefine them):

```ts
/** A saved class, as it comes back from the database. */
export interface ClassMeeting {
  id: string;
  name: string;
  instructor: string | null;
  room: string | null;
  courseCode: string | null;
  section: string | null;
  days: number[];        // ISO weekday, 1 = Mon .. 7 = Sun
  startMinute: number;   // minutes from midnight
  endMinute: number;
  color: string;
}

/** A class being edited — no id, no colour, not yet persisted. */
export interface ExtractedClass {
  name: string;
  instructor: string | null;
  room: string | null;
  courseCode: string | null;
  section: string | null;
  days: number[];
  startMinute: number;
  endMinute: number;
}
```

The editor works in `ExtractedClass[]`. The grid renders `ClassMeeting[]`. Tasks 1 and 2 build the two mappers between them.

**Scope reminder:** desktop only. The Edit button is hidden below the `lg:` breakpoint. Do not add analytics for this feature — see spec §10.3, it has database-migration and privacy-document consequences.

---

## File structure

| File | Status | Responsibility |
|---|---|---|
| `src/domain/mappers.ts` | Modify | Add `meetingToExtracted` and `extractedToPreviewMeetings` alongside the existing row mappers. |
| `src/domain/__tests__/mappers.test.ts` | Create | Tests for both new mappers. |
| `src/domain/scheduleEdit.ts` | Create | `hasUnsavedChanges` — the dirty check. Its own file because it is edit-session logic, not row mapping. |
| `src/domain/__tests__/scheduleEdit.test.ts` | Create | Tests for the dirty check. |
| `src/features/upload/ReviewForm.tsx` | Modify | Becomes a controlled component; gains `fixedBar` and `saveLabel`. |
| `src/features/upload/__tests__/ReviewForm.test.tsx` | Create | Locks the controlled-component contract. |
| `src/features/upload/UploadPage.tsx` | Modify | Passes `value`/`onChange` to `ReviewForm`. Behaviour unchanged. |
| `src/features/schedule/EditPanel.tsx` | Create | The right column: heading, error slot, `ReviewForm`, Cancel. Holds no class state. |
| `src/features/schedule/SchedulePage.tsx` | Modify | Owns edit state; renders the Edit button and the split layout. |

---

## Task 1: `meetingToExtracted` mapper

Converts a saved class into an editable form value, dropping `id` and `color` — both are re-derived on save by `saveSchedule`.

**Files:**
- Modify: `src/domain/mappers.ts`
- Create: `src/domain/__tests__/mappers.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/domain/__tests__/mappers.test.ts`:

```ts
// src/domain/__tests__/mappers.test.ts
import { describe, it, expect } from 'vitest';
import { meetingToExtracted } from '../mappers';
import type { ClassMeeting } from '../types';

function meeting(over: Partial<ClassMeeting> = {}): ClassMeeting {
  return {
    id: 'c1',
    name: 'BIO 101',
    instructor: 'Dr. Chen',
    room: 'H-421',
    courseCode: '101-BIO-AB',
    section: '00002',
    days: [1, 3, 5],
    startMinute: 600,
    endMinute: 650,
    color: 'indigo',
    ...over,
  };
}

describe('meetingToExtracted', () => {
  it('carries every editable field across', () => {
    expect(meetingToExtracted(meeting())).toEqual({
      name: 'BIO 101',
      instructor: 'Dr. Chen',
      room: 'H-421',
      courseCode: '101-BIO-AB',
      section: '00002',
      days: [1, 3, 5],
      startMinute: 600,
      endMinute: 650,
    });
  });

  it('drops id and color', () => {
    const result = meetingToExtracted(meeting());
    expect('id' in result).toBe(false);
    expect('color' in result).toBe(false);
  });

  it('preserves nulls in the optional fields', () => {
    const result = meetingToExtracted(
      meeting({ instructor: null, room: null, courseCode: null, section: null })
    );
    expect(result.instructor).toBeNull();
    expect(result.room).toBeNull();
    expect(result.courseCode).toBeNull();
    expect(result.section).toBeNull();
  });

  it('copies the days array rather than aliasing the source', () => {
    const source = meeting();
    const result = meetingToExtracted(source);
    expect(result.days).not.toBe(source.days);
    expect(result.days).toEqual(source.days);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/domain/__tests__/mappers.test.ts`

Expected: FAIL — `meetingToExtracted` is not exported from `../mappers`.

- [ ] **Step 3: Write the implementation**

Append to `src/domain/mappers.ts` (below the existing `rowToProfile`). The file currently imports only types; leave that import line as is:

```ts
/**
 * A saved class → an editable form value.
 *
 * `id` and `color` are dropped rather than carried: `saveSchedule` assigns
 * colour from the class name and lets Postgres assign ids, so keeping either
 * one here would create a second source of truth that silently goes stale the
 * moment a student renames a class.
 *
 * `days` is copied. Nothing in the edit path mutates arrays in place today,
 * but aliasing the loaded schedule's array into the draft would make the
 * dirty check (domain/scheduleEdit.ts) compare an array against itself and
 * always report "no changes" if that ever stopped being true.
 */
export function meetingToExtracted(meeting: ClassMeeting): ExtractedClass {
  return {
    name: meeting.name,
    instructor: meeting.instructor,
    room: meeting.room,
    courseCode: meeting.courseCode,
    section: meeting.section,
    days: [...meeting.days],
    startMinute: meeting.startMinute,
    endMinute: meeting.endMinute,
  };
}
```

Update the type import at the top of the file from:

```ts
import type { ClassMeeting, Profile } from './types';
```

to:

```ts
import type { ClassMeeting, ExtractedClass, Profile } from './types';
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/domain/__tests__/mappers.test.ts`

Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/domain/mappers.ts src/domain/__tests__/mappers.test.ts
git commit -m "feat(schedule): map a saved class to an editable form value"
```

---

## Task 2: `extractedToPreviewMeetings` mapper

Converts in-progress edit state into grid-renderable meetings, so the left column can re-render live.

**Files:**
- Modify: `src/domain/mappers.ts`
- Modify: `src/domain/__tests__/mappers.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/domain/__tests__/mappers.test.ts`. Also extend the import line at the top of that file to `import { extractedToPreviewMeetings, meetingToExtracted } from '../mappers';` and add `import { colorForClass } from '../color';`:

```ts
describe('extractedToPreviewMeetings', () => {
  it('returns an empty list for an empty draft', () => {
    expect(extractedToPreviewMeetings([])).toEqual([]);
  });

  it('assigns the same colour the class will have once saved', () => {
    const [preview] = extractedToPreviewMeetings([meetingToExtracted(meeting())]);
    expect(preview.color).toBe(colorForClass('BIO 101'));
  });

  it('recolours when the name changes, matching post-save colour', () => {
    const draft = { ...meetingToExtracted(meeting()), name: 'MATH 220' };
    const [preview] = extractedToPreviewMeetings([draft]);
    expect(preview.color).toBe(colorForClass('MATH 220'));
  });

  it('gives every entry a distinct id so React keys do not collide', () => {
    const draft = meetingToExtracted(meeting());
    const previews = extractedToPreviewMeetings([draft, draft, draft]);
    expect(new Set(previews.map((p) => p.id)).size).toBe(3);
  });

  it('round-trips a saved class back to the same displayed values', () => {
    const source = meeting();
    const [preview] = extractedToPreviewMeetings([meetingToExtracted(source)]);
    expect(preview.name).toBe(source.name);
    expect(preview.instructor).toBe(source.instructor);
    expect(preview.room).toBe(source.room);
    expect(preview.courseCode).toBe(source.courseCode);
    expect(preview.section).toBe(source.section);
    expect(preview.days).toEqual(source.days);
    expect(preview.startMinute).toBe(source.startMinute);
    expect(preview.endMinute).toBe(source.endMinute);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/domain/__tests__/mappers.test.ts`

Expected: FAIL — `extractedToPreviewMeetings` is not exported from `../mappers`.

- [ ] **Step 3: Write the implementation**

Add the import at the top of `src/domain/mappers.ts`:

```ts
import { colorForClass } from './color';
```

(No cycle: `color.ts` imports only `text.ts`.)

Then append the function:

```ts
/**
 * In-progress edit state → meetings the grid can render, for the live preview.
 *
 * Colour comes from `colorForClass`, the same deterministic name hash
 * `saveSchedule` uses, so the colour a student sees while editing is the
 * colour the block will actually have once saved — including when renaming a
 * class moves it to a different palette entry.
 *
 * `id` is positional and exists only to key the React list. It never reaches
 * the database: saving goes through `saveSchedule`, which builds its own rows
 * and lets Postgres assign real ids.
 */
export function extractedToPreviewMeetings(classes: ExtractedClass[]): ClassMeeting[] {
  return classes.map((c, index) => ({
    id: `preview-${index}`,
    name: c.name,
    instructor: c.instructor,
    room: c.room,
    courseCode: c.courseCode,
    section: c.section,
    days: c.days,
    startMinute: c.startMinute,
    endMinute: c.endMinute,
    color: colorForClass(c.name),
  }));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/domain/__tests__/mappers.test.ts`

Expected: PASS — 9 tests total in the file.

- [ ] **Step 5: Commit**

```bash
git add src/domain/mappers.ts src/domain/__tests__/mappers.test.ts
git commit -m "feat(schedule): map edit state to preview meetings for the live grid"
```

---

## Task 3: `hasUnsavedChanges` dirty check

Drives both the Cancel confirm and the `beforeunload` warning.

**Files:**
- Create: `src/domain/scheduleEdit.ts`
- Create: `src/domain/__tests__/scheduleEdit.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/domain/__tests__/scheduleEdit.test.ts`:

```ts
// src/domain/__tests__/scheduleEdit.test.ts
import { describe, it, expect } from 'vitest';
import { hasUnsavedChanges } from '../scheduleEdit';
import type { ExtractedClass } from '../types';

function draft(over: Partial<ExtractedClass> = {}): ExtractedClass {
  return {
    name: 'BIO 101',
    instructor: 'Dr. Chen',
    room: 'H-421',
    courseCode: '101-BIO-AB',
    section: '00002',
    days: [1, 3, 5],
    startMinute: 600,
    endMinute: 650,
    ...over,
  };
}

describe('hasUnsavedChanges', () => {
  it('is false for two empty lists', () => {
    expect(hasUnsavedChanges([], [])).toBe(false);
  });

  it('is false for identical lists', () => {
    expect(hasUnsavedChanges([draft()], [draft()])).toBe(false);
  });

  it('detects a renamed class', () => {
    expect(hasUnsavedChanges([draft({ name: 'BIO 102' })], [draft()])).toBe(true);
  });

  it('detects a changed start time', () => {
    expect(hasUnsavedChanges([draft({ startMinute: 610 })], [draft()])).toBe(true);
  });

  it('detects a changed end time', () => {
    expect(hasUnsavedChanges([draft({ endMinute: 700 })], [draft()])).toBe(true);
  });

  it('detects an added day', () => {
    expect(hasUnsavedChanges([draft({ days: [1, 3, 5, 6] })], [draft()])).toBe(true);
  });

  it('detects a removed day', () => {
    expect(hasUnsavedChanges([draft({ days: [1, 3] })], [draft()])).toBe(true);
  });

  it('detects a swapped day at the same count', () => {
    expect(hasUnsavedChanges([draft({ days: [1, 3, 4] })], [draft()])).toBe(true);
  });

  it('detects a changed optional field', () => {
    expect(hasUnsavedChanges([draft({ room: 'H-999' })], [draft()])).toBe(true);
  });

  it('detects an optional field cleared to null', () => {
    expect(hasUnsavedChanges([draft({ instructor: null })], [draft()])).toBe(true);
  });

  it('detects an added class', () => {
    expect(hasUnsavedChanges([draft(), draft({ name: 'MATH 220' })], [draft()])).toBe(true);
  });

  it('detects a removed class', () => {
    expect(hasUnsavedChanges([], [draft()])).toBe(true);
  });

  it('detects a reordered list at the same length', () => {
    const a = draft();
    const b = draft({ name: 'MATH 220' });
    expect(hasUnsavedChanges([b, a], [a, b])).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/domain/__tests__/scheduleEdit.test.ts`

Expected: FAIL — cannot resolve `../scheduleEdit`.

- [ ] **Step 3: Write the implementation**

Create `src/domain/scheduleEdit.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/domain/__tests__/scheduleEdit.test.ts`

Expected: PASS — 13 tests.

- [ ] **Step 5: Commit**

```bash
git add src/domain/scheduleEdit.ts src/domain/__tests__/scheduleEdit.test.ts
git commit -m "feat(schedule): add the unsaved-changes check for the editor"
```

---

## Task 4: Make `ReviewForm` a controlled component

The riskiest task, because it touches the working upload flow. `ReviewForm` currently owns its class list in internal state, which cannot drive a live preview. State moves up to the parent.

**Read `src/features/upload/ReviewForm.tsx` and `src/features/upload/UploadPage.tsx` in full before editing.**

**Files:**
- Modify: `src/features/upload/ReviewForm.tsx`
- Modify: `src/features/upload/UploadPage.tsx`
- Create: `src/features/upload/__tests__/ReviewForm.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/features/upload/__tests__/ReviewForm.test.tsx`. The `// @vitest-environment jsdom` docblock on line 1 is required — the project's default test environment is `node` (see `vite.config.ts`) and this test renders DOM:

```tsx
// @vitest-environment jsdom
// src/features/upload/__tests__/ReviewForm.test.tsx
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import ReviewForm from '../ReviewForm';
import type { ExtractedClass } from '@/domain/types';

afterEach(cleanup);

function draft(over: Partial<ExtractedClass> = {}): ExtractedClass {
  return {
    name: 'BIO 101',
    instructor: null,
    room: null,
    courseCode: null,
    section: null,
    days: [1, 3],
    startMinute: 600,
    endMinute: 650,
    ...over,
  };
}

describe('ReviewForm', () => {
  it('renders one card per class in `value`', () => {
    render(
      <ReviewForm
        value={[draft(), draft({ name: 'MATH 220' })]}
        onChange={vi.fn()}
        warnings={[]}
        saving={false}
        onSave={vi.fn()}
      />
    );
    expect((screen.getByDisplayValue('BIO 101') as HTMLInputElement).value).toBe('BIO 101');
    expect((screen.getByDisplayValue('MATH 220') as HTMLInputElement).value).toBe('MATH 220');
  });

  it('reports an edited name through onChange instead of holding it internally', () => {
    const onChange = vi.fn();
    render(
      <ReviewForm value={[draft()]} onChange={onChange} warnings={[]} saving={false} onSave={vi.fn()} />
    );

    fireEvent.change(screen.getByDisplayValue('BIO 101'), { target: { value: 'BIO 102' } });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0][0].name).toBe('BIO 102');
  });

  it('reports an added class through onChange', () => {
    const onChange = vi.fn();
    render(
      <ReviewForm value={[draft()]} onChange={onChange} warnings={[]} saving={false} onSave={vi.fn()} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add a class' }));

    expect(onChange.mock.calls[0][0]).toHaveLength(2);
  });

  it('reports a removed class through onChange', () => {
    const onChange = vi.fn();
    render(
      <ReviewForm value={[draft()]} onChange={onChange} warnings={[]} saving={false} onSave={vi.fn()} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Remove class' }));

    expect(onChange.mock.calls[0][0]).toHaveLength(0);
  });

  it('passes the current value to onSave', () => {
    const onSave = vi.fn();
    const value = [draft()];
    render(
      <ReviewForm value={value} onChange={vi.fn()} warnings={[]} saving={false} onSave={onSave} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save schedule' }));

    expect(onSave).toHaveBeenCalledWith(value);
  });

  it('disables save when a class has no day selected', () => {
    render(
      <ReviewForm value={[draft({ days: [] })]} onChange={vi.fn()} warnings={[]} saving={false} onSave={vi.fn()} />
    );
    expect((screen.getByRole('button', { name: 'Save schedule' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('disables save when the list is empty', () => {
    render(<ReviewForm value={[]} onChange={vi.fn()} warnings={[]} saving={false} onSave={vi.fn()} />);
    expect((screen.getByRole('button', { name: 'Save schedule' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('uses a custom save label when given one', () => {
    render(
      <ReviewForm
        value={[draft()]}
        onChange={vi.fn()}
        warnings={[]}
        saving={false}
        onSave={vi.fn()}
        saveLabel="Save changes"
      />
    );
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/upload/__tests__/ReviewForm.test.tsx`

Expected: FAIL — `ReviewForm` still takes `initial`, so `value` is not a recognised prop and the render throws or the assertions miss.

- [ ] **Step 3: Rewrite `ReviewForm`**

Replace the whole of `src/features/upload/ReviewForm.tsx` with:

```tsx
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
```

- [ ] **Step 4: Update `UploadPage` to pass the new props**

The `reviewing` stage already carries `classes`, so it is the state — no new `useState` is needed. In `src/features/upload/UploadPage.tsx`, replace this block:

```tsx
        <div className="mt-4">
          <ReviewForm
            initial={stage.classes}
            warnings={stage.warnings}
            saving={saving}
            onSave={handleSave}
          />
        </div>
```

with:

```tsx
        <div className="mt-4">
          <ReviewForm
            value={stage.classes}
            onChange={(next) => setStage({ ...stage, classes: next })}
            warnings={stage.warnings}
            saving={saving}
            onSave={handleSave}
          />
        </div>
```

`{ ...stage, classes: next }` preserves `name: 'reviewing'` and `warnings`. TypeScript narrows `stage` to the `reviewing` variant here because the `extracting` and `cropping` branches already returned above.

- [ ] **Step 5: Run the tests and the typechecker**

Run: `npx vitest run src/features/upload/__tests__/ReviewForm.test.tsx`
Expected: PASS — 8 tests.

Run: `npx tsc -b`
Expected: no output (success). Any error mentioning `initial` means a `ReviewForm` call site was missed.

Run: `npm test`
Expected: PASS — the whole suite, no regressions.

- [ ] **Step 6: Commit**

```bash
git add src/features/upload/ReviewForm.tsx src/features/upload/UploadPage.tsx src/features/upload/__tests__/ReviewForm.test.tsx
git commit -m "refactor(upload): make ReviewForm controlled so callers can observe edits"
```

---

## Task 5: `EditPanel` component

The right column. Pure presentation — it holds no class state, everything arrives as props.

**Files:**
- Create: `src/features/schedule/EditPanel.tsx`

- [ ] **Step 1: Write the component**

Create `src/features/schedule/EditPanel.tsx`:

```tsx
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
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: no output. `EditPanel` is not yet imported anywhere, which is fine — Task 6 wires it in.

- [ ] **Step 3: Commit**

```bash
git add src/features/schedule/EditPanel.tsx
git commit -m "feat(schedule): add the EditPanel column for the desktop editor"
```

---

## Task 6: Wire edit mode into `SchedulePage`

**Read `src/features/schedule/SchedulePage.tsx` in full before editing.**

⚠️ **Hooks must be declared above the existing `if (loading) return <Spinner … />` early return.** Placing a `useState` or `useEffect` below it changes hook order between renders and React will throw. The `beforeunload` effect in Task 7 has the same constraint.

**Files:**
- Modify: `src/features/schedule/SchedulePage.tsx`

- [ ] **Step 1: Replace the file**

Replace the whole of `src/features/schedule/SchedulePage.tsx` with:

```tsx
// src/features/schedule/SchedulePage.tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { useSchedule, saveSchedule } from './useSchedule';
import ScheduleGrid from './ScheduleGrid';
import EditPanel from './EditPanel';
import EmptyState from '@/components/EmptyState';
import Spinner from '@/components/Spinner';
import Button, { buttonClassName } from '@/components/Button';
import { meetingToExtracted, extractedToPreviewMeetings } from '@/domain/mappers';
import { hasUnsavedChanges } from '@/domain/scheduleEdit';
import type { ExtractedClass } from '@/domain/types';

export default function SchedulePage() {
  const { session, profile } = useAuth();
  const { classes, loading, error, reload } = useSchedule(session?.user.id);

  // Every hook stays above the `loading` early return below — a hook declared
  // after it would only run on some renders, which React treats as an error.
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ExtractedClass[]>([]);
  const [baseline, setBaseline] = useState<ExtractedClass[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const dirty = editing && hasUnsavedChanges(draft, baseline);

  function startEditing() {
    // `draft` and `baseline` start as the same array. Safe because every edit
    // path builds new objects (ClassCard spreads, ReviewForm maps) rather than
    // mutating in place — so the baseline cannot drift with the draft.
    const initial = classes.map(meetingToExtracted);
    setDraft(initial);
    setBaseline(initial);
    setSaveError(null);
    setEditing(true);
  }

  function cancelEditing() {
    if (dirty && !window.confirm('Discard your changes?')) return;
    setEditing(false);
    setSaveError(null);
  }

  async function handleSave(next: ExtractedClass[]) {
    setSaving(true);
    setSaveError(null);
    try {
      await saveSchedule(next);
      // Reload before leaving edit mode: the grid must go back to showing
      // database rows with real ids, not preview meetings keyed by position.
      await reload();
      setEditing(false);
    } catch (caught) {
      // `replace_schedule` is transactional, so a failed save changed nothing.
      // Keep the draft and let them retry.
      setSaveError(caught instanceof Error ? caught.message : 'Could not save your schedule.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Spinner label="Loading your schedule" />;

  if (editing) {
    return (
      <main>
        <header className="px-4 pt-4">
          <h1 className="text-2xl font-bold">Edit schedule</h1>
        </header>

        <div className="mt-2 grid gap-6 lg:grid-cols-2">
          {/* ScheduleGrid returns a fragment (DaySelector + the grid), so it
              must be wrapped — dropped in bare, its two children would each
              become a separate grid item and the two-column layout would take
              three cells. It happens to look right today only because
              DaySelector is `lg:hidden` and a display:none element forms no
              grid item; this div means that stays true if it ever isn't. */}
          <div>
            <ScheduleGrid classes={extractedToPreviewMeetings(draft)} />
          </div>
          <div className="px-4">
            <EditPanel
              value={draft}
              onChange={setDraft}
              saving={saving}
              error={saveError}
              onSave={handleSave}
              onCancel={cancelEditing}
            />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main>
      <header className="flex items-center justify-between px-4 pt-4">
        <div>
          <h1 className="text-2xl font-bold">My schedule</h1>
          <p className="text-sm text-slate-500">@{profile?.username}</p>
        </div>
        <div className="flex items-center gap-2">
          {classes.length > 0 && (
            /* Desktop only for now — the split-screen editor has no mobile
               layout yet. `hidden lg:inline-flex` overrides the `inline-flex`
               that buttonClassName sets at the base breakpoint. */
            <Button variant="secondary" onClick={startEditing} className="hidden lg:inline-flex">
              Edit
            </Button>
          )}
          <Link to="/upload" className={buttonClassName('secondary')}>
            {classes.length > 0 ? 'Replace' : 'Add'}
          </Link>
        </div>
      </header>

      {error && <p className="px-4 pt-3 text-sm text-rose-600">{error}</p>}

      {classes.length === 0 ? (
        <EmptyState
          title="No schedule yet"
          body="Upload a screenshot of your classes and we'll turn it into a real schedule."
          action={<Link to="/upload" className={buttonClassName('primary')}>Upload a screenshot</Link>}
        />
      ) : (
        <div className="mt-2">
          <ScheduleGrid classes={classes} />
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Typecheck and run the suite**

Run: `npx tsc -b`
Expected: no output.

Run: `npm test`
Expected: PASS, no regressions.

- [ ] **Step 3: Verify in the browser**

Run: `npm run dev`, open the printed URL, sign in, and widen the window past 1024px.

Check:
1. An **Edit** button sits next to Replace when a schedule exists.
2. Narrowing the window below 1024px hides Edit; Replace stays.
3. Clicking Edit splits the view — grid left, form right — with no URL change.
4. Changing a class's start time moves its block on the left immediately.
5. Renaming a class to `MATH 220` recolours its block.
6. Add a class → once it has a name, a day, and times, a block appears.
7. Remove a class → its block disappears.
8. Save changes → returns to the normal view; reloading the page shows the edit persisted.
9. Cancel with no changes → exits with no prompt.
10. Cancel after a change → prompts; dismissing it keeps the draft intact.

- [ ] **Step 4: Commit**

```bash
git add src/features/schedule/SchedulePage.tsx
git commit -m "feat(schedule): split-screen editing for a saved schedule on desktop"
```

---

## Task 7: Warn on tab close with unsaved changes

**Files:**
- Modify: `src/features/schedule/SchedulePage.tsx`

- [ ] **Step 1: Add the effect**

In `src/features/schedule/SchedulePage.tsx`, change the React import:

```tsx
import { useState } from 'react';
```

to:

```tsx
import { useEffect, useState } from 'react';
```

Then add this directly below the `const dirty = …` line — above `startEditing`, and well above the `if (loading)` early return:

```tsx
  /**
   * Native "leave site?" prompt while there are unsaved edits.
   *
   * Keyed on `dirty` and cleaned up on every change, because a listener left
   * registered after a successful save would warn on every page close for the
   * rest of the session.
   *
   * This covers closing and reloading the tab. It does not cover in-app
   * navigation — clicking Friends mid-edit still discards silently. That gap
   * is accepted in the spec (§8); closing it needs a router-level blocker.
   */
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: no output.

- [ ] **Step 3: Verify in the browser**

With `npm run dev` running, at a desktop width:

1. Enter edit mode, change a class name, press F5 → the browser shows its "Leave site?" / "Reload site?" confirmation. Stay on the page.
2. Press Save changes, wait for the normal view, then press F5 → **no** warning.
3. Enter edit mode, change nothing, press F5 → **no** warning.

- [ ] **Step 4: Commit**

```bash
git add src/features/schedule/SchedulePage.tsx
git commit -m "feat(schedule): warn before closing the tab with unsaved edits"
```

---

## Task 8: Full verification

**Files:** none — verification only.

- [ ] **Step 1: Run the whole suite**

Run: `npm test`
Expected: PASS. Record the counts; every test in the repo should pass, including the pre-existing domain tests.

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: completes with no TypeScript errors and writes `dist/`.

- [ ] **Step 3: Re-verify the upload flow was not broken by Task 4**

`ReviewForm` changed shape, and the upload flow is the other consumer. With `npm run dev`:

1. Go to `/upload` → **Enter manually instead** → the blank review form appears.
2. Add a class, fill in name / days / times → **Save schedule** works and lands on the schedule page.
3. On `/upload`, confirm the Save bar is still pinned to the bottom of the viewport (`fixedBar` defaults to `true`) and does not scroll with the cards.
4. Upload a real schedule screenshot → extraction runs → the review form is pre-filled → editing a field works → save persists.

- [ ] **Step 4: Confirm the legal documents were not touched**

Run: `git diff main --stat -- src/features/legal/`
Expected: **no output.** Spec §10 concluded no privacy or terms change is required, and §10.2 specifically forbids moving `LAST_UPDATED_EN` / `LAST_UPDATED_FR` for a release that amends no clause. Output here means something was changed that needs review.

- [ ] **Step 5: Confirm no analytics event was added**

Run: `git diff main -- src/lib/analytics.ts supabase/migrations/`
Expected: **no output.** See spec §10.3.

- [ ] **Step 6: Review the full diff**

Run: `git diff main --stat`

Expected files changed, and nothing else:

```
src/domain/__tests__/mappers.test.ts
src/domain/__tests__/scheduleEdit.test.ts
src/domain/mappers.ts
src/domain/scheduleEdit.ts
src/features/schedule/EditPanel.tsx
src/features/schedule/SchedulePage.tsx
src/features/upload/ReviewForm.tsx
src/features/upload/UploadPage.tsx
src/features/upload/__tests__/ReviewForm.test.tsx
docs/superpowers/plans/2026-08-22-edit-saved-schedule.md
docs/superpowers/specs/2026-08-22-edit-saved-schedule-design.md
```

---

## Notes for whoever picks this up

**On the grid at half width.** Spec §9 flags that at ~450px each weekday column is roughly 85px. Day headers are already three-letter (`WEEKDAY_LABELS` is `'Mon'`, `'Tue'`, …) so they fit; `ClassBlock` truncates its text and already does so on a phone. If it reads badly in step 3 of Task 6, that is a CSS follow-up, not a reason to change the architecture — say so rather than redesigning.

**What is deliberately not here**, all from spec §3 — do not add them opportunistically:
- Mobile layout for the editor.
- Click a block on the left to focus its card on the right.
- A router-level navigation blocker.
- Undo, edit history, or per-class saves.
- Any analytics event (§10.3 — it needs a migration and a privacy-clause review).
