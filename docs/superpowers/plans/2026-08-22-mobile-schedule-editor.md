# Mobile Schedule Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a student edit a saved schedule on a phone by tapping a class block to raise a bottom sheet holding that one class, with no scrolling.

**Architecture:** `SchedulePage`'s existing edit state (`editing`, `draft`, `baseline`, dirty, save) is reused untouched. A `useMediaQuery` hook picks between the shipped desktop `EditPanel` and a new mobile editor. `ScheduleGrid` gains optional edit-mode callbacks — tap a block, long-press empty space, day changed — and stays the owner of its selected day. `ClassCard` is tightened globally so a whole card fits the sheet.

**Tech Stack:** React 19, TypeScript, Tailwind, Vitest + jsdom + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-08-22-mobile-schedule-editor-design.md`

---

## Context you need before starting

**Run all commands from:** `c:/Users/sport/OneDrive/Documents/CodingPersonal/schedule-matcher`

**Branch:** `feat/mobile-schedule-editor` (exists, has the spec). Confirm with `git branch --show-current`.

**Commands:**
- One test file: `npx vitest run <path>`
- All tests: `npm test`
- Typecheck: `npx tsc -b`
- Dev server: `npm run dev`

**Baseline: 298 tests pass before you start.** The desktop editor shipped to `main` in `dbe4e55`; its tests in `src/features/schedule/__tests__/SchedulePage.test.tsx` must keep passing untouched.

**Constraints that are not negotiable:**
- Every interactive element stays ≥ 44×44 CSS px (`min-h-touch`). Card shrinkage comes from padding, margins, and line-height — never from control height.
- Do not add an analytics event (spec §3, and the parent spec §10.3 — it needs a DB migration and a privacy-clause review).
- Do not modify anything under `src/features/legal/`.

**Types you will use** (already exist in `src/domain/types.ts` — do not redefine): `ClassMeeting`, `ExtractedClass`, `AxisRange`. `AxisRange` is `{ startMinute: number; endMinute: number }`.

**Key existing facts:**
- `HOUR_HEIGHT_PX` is `64` (`src/components/HourGrid.tsx`).
- The mobile grid column is sized to exactly `((axis.endMinute - axis.startMinute) / 60) * HOUR_HEIGHT_PX`.
- `extractedToPreviewMeetings` assigns `id = \`preview-${index}\`` (`src/domain/mappers.ts`).
- `ReviewForm`'s `BLANK` uses a 50-minute default duration.

---

## File structure

| File | Status | Responsibility |
|---|---|---|
| `src/domain/gridTime.ts` | Create | `minuteFromOffset` — y-position → snapped, clamped minute. |
| `src/domain/__tests__/gridTime.test.ts` | Create | Its tests. |
| `src/domain/mappers.ts` | Modify | Add `previewIndexOf`, keeping the preview-id format in the file that creates it. |
| `src/domain/__tests__/mappers.test.ts` | Modify | Tests for `previewIndexOf`. |
| `src/lib/useMediaQuery.ts` | Create | `matchMedia` subscription hook. |
| `src/lib/__tests__/useMediaQuery.test.ts` | Create | Its tests. |
| `src/features/schedule/useLongPress.ts` | Create | Pointer-based long-press gesture. |
| `src/features/schedule/__tests__/useLongPress.test.tsx` | Create | Its tests. |
| `src/features/upload/ClassCard.tsx` | Modify | Tighten spacing; make `onRemove` optional. |
| `src/features/schedule/ClassBlock.tsx` | Modify | Optional `onSelect` renders it as a button. |
| `src/features/schedule/ScheduleGrid.tsx` | Modify | Optional edit callbacks; long-press on the mobile column. |
| `src/features/schedule/ClassSheet.tsx` | Create | The bottom sheet: header, card, Done. |
| `src/features/schedule/MobileEditor.tsx` | Create | Mobile edit mode: header actions, hint, grid, sheet, `SheetTarget` state. |
| `src/features/schedule/__tests__/MobileEditor.test.tsx` | Create | Sheet behaviour tests. |
| `src/features/schedule/SchedulePage.tsx` | Modify | Branch on `useMediaQuery`; drop `hidden lg:inline-flex` from Edit. |

---

## Task 1: `minuteFromOffset`

Maps a press position in the grid column to a start minute: snapped down to 30, clamped so a 50-minute class still fits inside the axis.

**Files:**
- Create: `src/domain/gridTime.ts`
- Create: `src/domain/__tests__/gridTime.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/domain/__tests__/gridTime.test.ts`:

```ts
// src/domain/__tests__/gridTime.test.ts
import { describe, it, expect } from 'vitest';
import { minuteFromOffset, NEW_CLASS_DURATION_MINUTES } from '../gridTime';

// The default axis: 08:00 (480) to 18:00 (1080), 600 minutes over 640px.
const axis = { startMinute: 480, endMinute: 1080 };

describe('minuteFromOffset', () => {
  it('maps the very top of the grid to the axis start', () => {
    expect(minuteFromOffset(0, axis)).toBe(480);
  });

  it('maps one hour down to one hour later', () => {
    expect(minuteFromOffset(64, axis)).toBe(540);
  });

  it('snaps down to the nearest half hour', () => {
    // 40px = 37.5 minutes past 08:00 -> 08:30, not 08:37.
    expect(minuteFromOffset(40, axis)).toBe(510);
  });

  it('snaps a position just short of the half hour down to the hour', () => {
    // 31px = 29 minutes past 08:00 -> 08:00.
    expect(minuteFromOffset(31, axis)).toBe(480);
  });

  it('clamps a negative offset to the axis start', () => {
    expect(minuteFromOffset(-50, axis)).toBe(480);
  });

  it('leaves room for the default duration at the bottom of the axis', () => {
    // The last usable start is 1080 - 50 = 1030, snapped down to 1020 (17:00).
    expect(minuteFromOffset(640, axis)).toBe(1020);
  });

  it('clamps an offset past the bottom of the grid the same way', () => {
    expect(minuteFromOffset(5000, axis)).toBe(1020);
  });

  it('respects an axis extended by an early class', () => {
    const early = { startMinute: 420, endMinute: 1080 };
    expect(minuteFromOffset(0, early)).toBe(420);
    expect(minuteFromOffset(64, early)).toBe(480);
  });

  it('never returns a start that would push the class past the axis end', () => {
    for (const offset of [600, 620, 640, 700]) {
      expect(minuteFromOffset(offset, axis) + NEW_CLASS_DURATION_MINUTES).toBeLessThanOrEqual(1080);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/domain/__tests__/gridTime.test.ts`
Expected: FAIL — cannot resolve `../gridTime`.

- [ ] **Step 3: Write the implementation**

Create `src/domain/gridTime.ts`:

```ts
// src/domain/gridTime.ts
import { HOUR_HEIGHT_PX } from '@/components/HourGrid';
import type { AxisRange } from './types';

/** Matches ReviewForm's BLANK, so a long-pressed class and an added one agree. */
export const NEW_CLASS_DURATION_MINUTES = 50;

/**
 * Snapping granularity for a long-press. Thirty minutes, not five: at 64px an
 * hour, five minutes is 5.3px — finer than a fingertip can aim, so a smaller
 * step would only produce times the student did not choose.
 */
const SNAP_MINUTES = 30;

/**
 * Where in the day a press at `offsetY` landed.
 *
 * The grid column is sized to exactly (axis span / 60) * HOUR_HEIGHT_PX, so
 * pixels convert to minutes at a flat 60/HOUR_HEIGHT_PX and the axis span
 * cancels out.
 *
 * The result is clamped so a new class of NEW_CLASS_DURATION_MINUTES still
 * ends inside the axis. Without that, pressing near the bottom would create a
 * class running past the last hour mark — which `computeAxis` would then
 * extend the axis to contain, making the grid grow under the student's finger.
 */
export function minuteFromOffset(offsetY: number, axis: AxisRange): number {
  const rawMinute = axis.startMinute + (offsetY / HOUR_HEIGHT_PX) * 60;
  const latestStart = axis.endMinute - NEW_CLASS_DURATION_MINUTES;

  const bounded = Math.min(Math.max(rawMinute, axis.startMinute), latestStart);
  const snapped = Math.floor(bounded / SNAP_MINUTES) * SNAP_MINUTES;

  // Snapping down can fall below an axis that does not start on a half hour.
  return Math.max(snapped, axis.startMinute);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/domain/__tests__/gridTime.test.ts`
Expected: PASS — 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/domain/gridTime.ts src/domain/__tests__/gridTime.test.ts
git commit -m "feat(schedule): map a grid press position to a snapped start time"
```

---

## Task 2: `previewIndexOf`

The sheet needs the `draft` index for a tapped block. Preview meetings carry `id = "preview-N"`, so the lookup belongs next to the function that assigns it.

**Files:**
- Modify: `src/domain/mappers.ts`
- Modify: `src/domain/__tests__/mappers.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/domain/__tests__/mappers.test.ts`, and extend its first import to
`import { extractedToPreviewMeetings, meetingToExtracted, previewIndexOf } from '../mappers';`:

```ts
describe('previewIndexOf', () => {
  it('recovers the draft index a preview meeting came from', () => {
    const previews = extractedToPreviewMeetings([
      meetingToExtracted(meeting({ name: 'A' })),
      meetingToExtracted(meeting({ name: 'B' })),
      meetingToExtracted(meeting({ name: 'C' })),
    ]);
    expect(previews.map(previewIndexOf)).toEqual([0, 1, 2]);
  });

  it('returns null for a saved meeting with a real database id', () => {
    expect(previewIndexOf(meeting({ id: '7c9f1e2a-0000-4000-8000-000000000000' }))).toBeNull();
  });

  it('returns null for an id that only looks like a preview id', () => {
    expect(previewIndexOf(meeting({ id: 'preview-x' }))).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/domain/__tests__/mappers.test.ts`
Expected: FAIL — `previewIndexOf` is not exported.

- [ ] **Step 3: Write the implementation**

Append to `src/domain/mappers.ts`:

```ts
/**
 * The inverse of the id `extractedToPreviewMeetings` assigns.
 *
 * Lives here rather than at the call site so the preview-id format is written
 * down exactly once. Returns null for anything else — a saved class carries a
 * real uuid, and the mobile editor uses that to tell "tapped a live draft
 * block" from "tapped a block rendered off the database".
 */
export function previewIndexOf(meeting: ClassMeeting): number | null {
  const match = /^preview-(\d+)$/.exec(meeting.id);
  return match ? Number(match[1]) : null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/domain/__tests__/mappers.test.ts`
Expected: PASS — 12 tests in the file.

- [ ] **Step 5: Commit**

```bash
git add src/domain/mappers.ts src/domain/__tests__/mappers.test.ts
git commit -m "feat(schedule): recover a draft index from a preview meeting id"
```

---

## Task 3: `useMediaQuery`

**Files:**
- Create: `src/lib/useMediaQuery.ts`
- Create: `src/lib/__tests__/useMediaQuery.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/useMediaQuery.test.ts`. It stubs `matchMedia` because jsdom does not implement it:

```ts
// @vitest-environment jsdom
// src/lib/__tests__/useMediaQuery.test.ts
import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useMediaQuery } from '../useMediaQuery';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Minimal MediaQueryList stub with a handle to fire changes from a test. */
function stubMatchMedia(initial: boolean) {
  const listeners = new Set<(e: MediaQueryListEvent) => void>();
  const list = {
    matches: initial,
    addEventListener: (_: string, fn: (e: MediaQueryListEvent) => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: (e: MediaQueryListEvent) => void) => listeners.delete(fn),
  };
  vi.stubGlobal('matchMedia', () => list);
  return {
    listenerCount: () => listeners.size,
    fire(matches: boolean) {
      list.matches = matches;
      listeners.forEach((fn) => fn({ matches } as MediaQueryListEvent));
    },
  };
}

describe('useMediaQuery', () => {
  it('reports the initial match', () => {
    stubMatchMedia(true);
    const { result } = renderHook(() => useMediaQuery('(min-width: 1024px)'));
    expect(result.current).toBe(true);
  });

  it('reports an initial non-match', () => {
    stubMatchMedia(false);
    const { result } = renderHook(() => useMediaQuery('(min-width: 1024px)'));
    expect(result.current).toBe(false);
  });

  it('updates when the query starts matching', () => {
    const media = stubMatchMedia(false);
    const { result } = renderHook(() => useMediaQuery('(min-width: 1024px)'));

    act(() => media.fire(true));

    expect(result.current).toBe(true);
  });

  it('removes its listener on unmount', () => {
    const media = stubMatchMedia(false);
    const { unmount } = renderHook(() => useMediaQuery('(min-width: 1024px)'));
    expect(media.listenerCount()).toBe(1);

    unmount();

    expect(media.listenerCount()).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/__tests__/useMediaQuery.test.ts`
Expected: FAIL — cannot resolve `../useMediaQuery`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/useMediaQuery.ts`:

```ts
// src/lib/useMediaQuery.ts
import { useEffect, useState } from 'react';

/**
 * Subscribe to a CSS media query from JavaScript.
 *
 * Used only where the two breakpoints render structurally different things —
 * the mobile editor shows one class in a sheet, the desktop one shows all of
 * them in a panel. Everywhere the difference is purely visual, this codebase
 * uses Tailwind's `lg:` variants instead, and should keep doing so.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false
  );

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const list = window.matchMedia(query);
    setMatches(list.matches);

    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/__tests__/useMediaQuery.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/useMediaQuery.ts src/lib/__tests__/useMediaQuery.test.ts
git commit -m "feat(schedule): add a matchMedia subscription hook"
```

---

## Task 4: `useLongPress`

**Files:**
- Create: `src/features/schedule/useLongPress.ts`
- Create: `src/features/schedule/__tests__/useLongPress.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/features/schedule/__tests__/useLongPress.test.tsx`:

```tsx
// @vitest-environment jsdom
// src/features/schedule/__tests__/useLongPress.test.tsx
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { useLongPress, LONG_PRESS_MS, LONG_PRESS_SLOP_PX } from '../useLongPress';

// jsdom ships no PointerEvent constructor, so fireEvent.pointerDown would
// dispatch an event with no `button` or coordinates and every assertion here
// would fail for the wrong reason. MouseEvent carries everything the hook
// reads (button, clientX, clientY), so it is a faithful enough stand-in.
if (typeof window.PointerEvent === 'undefined') {
  // @ts-expect-error assigning a minimal stand-in onto the jsdom window
  window.PointerEvent = class PointerEventStub extends MouseEvent {};
}

afterEach(cleanup);
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function Target({ onLongPress }: { onLongPress: (y: number) => void }) {
  const handlers = useLongPress(onLongPress);
  return <div data-testid="surface" {...handlers} style={{ height: 640 }} />;
}

function down(el: Element, clientY = 100) {
  fireEvent.pointerDown(el, { clientX: 10, clientY, pointerId: 1 });
}

describe('useLongPress', () => {
  it('fires after the press delay', () => {
    const onLongPress = vi.fn();
    render(<Target onLongPress={onLongPress} />);

    down(screen.getByTestId('surface'));
    vi.advanceTimersByTime(LONG_PRESS_MS);

    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire before the delay has elapsed', () => {
    const onLongPress = vi.fn();
    render(<Target onLongPress={onLongPress} />);

    down(screen.getByTestId('surface'));
    vi.advanceTimersByTime(LONG_PRESS_MS - 50);

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('is cancelled by a release before the delay', () => {
    const onLongPress = vi.fn();
    render(<Target onLongPress={onLongPress} />);
    const surface = screen.getByTestId('surface');

    down(surface);
    fireEvent.pointerUp(surface);
    vi.advanceTimersByTime(LONG_PRESS_MS);

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('is cancelled by movement past the slop threshold — a scroll, not a press', () => {
    const onLongPress = vi.fn();
    render(<Target onLongPress={onLongPress} />);
    const surface = screen.getByTestId('surface');

    down(surface, 100);
    fireEvent.pointerMove(surface, { clientX: 10, clientY: 100 + LONG_PRESS_SLOP_PX + 5 });
    vi.advanceTimersByTime(LONG_PRESS_MS);

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('survives a small tremor within the slop threshold', () => {
    const onLongPress = vi.fn();
    render(<Target onLongPress={onLongPress} />);
    const surface = screen.getByTestId('surface');

    down(surface, 100);
    fireEvent.pointerMove(surface, { clientX: 10, clientY: 103 });
    vi.advanceTimersByTime(LONG_PRESS_MS);

    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it('reports the press position relative to the surface', () => {
    const onLongPress = vi.fn();
    render(<Target onLongPress={onLongPress} />);
    const surface = screen.getByTestId('surface');
    // jsdom gives every element a zero-sized rect, so top is 0 and the
    // offset equals clientY. Enough to prove the value is threaded through.
    down(surface, 250);
    vi.advanceTimersByTime(LONG_PRESS_MS);

    expect(onLongPress).toHaveBeenCalledWith(250);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/schedule/__tests__/useLongPress.test.tsx`
Expected: FAIL — cannot resolve `../useLongPress`.

- [ ] **Step 3: Write the implementation**

Create `src/features/schedule/useLongPress.ts`:

```ts
// src/features/schedule/useLongPress.ts
import { useCallback, useEffect, useRef } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';

export const LONG_PRESS_MS = 500;

/**
 * How far a finger may drift and still count as a press rather than a scroll.
 * Matches the order of magnitude browsers use for their own tap slop.
 */
export const LONG_PRESS_SLOP_PX = 10;

/**
 * Long-press on a surface, reporting where it landed as a y-offset within that
 * surface.
 *
 * Long-press rather than tap for *creating* a class: an accidental sheet-open
 * is a dismissal, an accidental creation is junk in someone's schedule.
 *
 * The timer is cancelled by release and by movement past the slop threshold,
 * so scrolling the grid never creates anything.
 */
export function useLongPress(onLongPress: (offsetY: number) => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);

  const cancel = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    origin.current = null;
  }, []);

  // A press held while the component unmounts would otherwise fire into a
  // dead tree.
  useEffect(() => cancel, [cancel]);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      // Ignore secondary buttons; a mouse right-click is not a press.
      if (event.button !== 0) return;

      const rect = event.currentTarget.getBoundingClientRect();
      const offsetY = event.clientY - rect.top;
      origin.current = { x: event.clientX, y: event.clientY };

      cancel();
      timer.current = setTimeout(() => {
        timer.current = null;
        origin.current = null;
        onLongPress(offsetY);
      }, LONG_PRESS_MS);
    },
    [cancel, onLongPress]
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!origin.current) return;
      const dx = Math.abs(event.clientX - origin.current.x);
      const dy = Math.abs(event.clientY - origin.current.y);
      if (dx > LONG_PRESS_SLOP_PX || dy > LONG_PRESS_SLOP_PX) cancel();
    },
    [cancel]
  );

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    // Without this, a long press raises the OS text-selection menu on top of
    // the sheet we just opened. contextmenu is a MouseEvent, not a PointerEvent.
    onContextMenu: (event: ReactMouseEvent<HTMLElement>) => event.preventDefault(),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/features/schedule/__tests__/useLongPress.test.tsx`
Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/schedule/useLongPress.ts src/features/schedule/__tests__/useLongPress.test.tsx
git commit -m "feat(schedule): add a long-press gesture hook"
```

---

## Task 5: Tighten `ClassCard`

Takes the card from 470px to ~356px at 390px width, with nothing hidden. **Control heights stay at `min-h-touch`** — the savings come from padding, margins, and label line-height only.

**Read `src/features/upload/ClassCard.tsx` in full before editing.**

**Files:**
- Modify: `src/features/upload/ClassCard.tsx`

- [ ] **Step 1: Make `onRemove` optional**

In `src/features/upload/ClassCard.tsx`, change the props interface from:

```tsx
interface Props {
  value: ExtractedClass;
  index: number;
  onChange: (next: ExtractedClass) => void;
  onRemove: () => void;
}
```

to:

```tsx
interface Props {
  value: ExtractedClass;
  index: number;
  onChange: (next: ExtractedClass) => void;
  /**
   * Omitted by the mobile sheet, which puts deletion in its own header so the
   * card can be short enough to fit on screen without scrolling.
   */
  onRemove?: () => void;
}
```

- [ ] **Step 2: Apply the spacing changes**

Make exactly these edits in the same file. Do not change any `min-h-touch`.

1. The wrapping `<li>`: `className="rounded-2xl border border-slate-200 bg-white p-4"` → `className="rounded-2xl border border-slate-200 bg-white p-3"`

2. Every field-group label — there are seven, reading `className="text-xs font-medium text-slate-500"` — becomes `className="text-xs font-medium leading-tight text-slate-500"`.

3. The "Days" paragraph: `className="mt-3 text-xs font-medium text-slate-500"` → `className="mt-2 text-xs font-medium leading-tight text-slate-500"`

4. The three row wrappers reading `className="mt-3 flex gap-3"` → `className="mt-2 flex gap-3"` (times row, code/section row, room/instructor row).

5. Replace the remove button block:

```tsx
      <Button variant="ghost" onClick={onRemove} className="mt-2 w-full text-rose-600">
        Remove class
      </Button>
```

with:

```tsx
      {onRemove && (
        <Button variant="ghost" onClick={onRemove} className="mt-2 w-full text-rose-600">
          Remove class
        </Button>
      )}
```

- [ ] **Step 3: Verify nothing regressed**

Run: `npx tsc -b`
Expected: no output.

Run: `npm test`
Expected: PASS — 298 tests. `ReviewForm` still passes `onRemove`, so the upload list keeps its button and its tests keep passing.

- [ ] **Step 4: Commit**

```bash
git add src/features/upload/ClassCard.tsx
git commit -m "refactor(upload): tighten ClassCard and make removal optional"
```

---

## Task 6: Make blocks tappable

**Files:**
- Modify: `src/features/schedule/ClassBlock.tsx`

- [ ] **Step 1: Add the optional `onSelect` prop**

In `src/features/schedule/ClassBlock.tsx`, change the signature from:

```tsx
export default function ClassBlock({ block }: { block: PositionedBlock }) {
```

to:

```tsx
interface Props {
  block: PositionedBlock;
  /** Edit mode only. When given, the block becomes a real button. */
  onSelect?: () => void;
}

export default function ClassBlock({ block, onSelect }: Props) {
```

- [ ] **Step 2: Render a button when selectable**

Replace the returned `<div … >…</div>` wrapper with an element chosen by `onSelect`, keeping the children exactly as they are. The existing `className` and `style` move onto a shared constant so the two branches cannot drift:

```tsx
  const positioning = {
    top: `${block.topPct}%`,
    height: `${block.heightPct}%`,
    left: `${block.lane * widthPct}%`,
    width: `${widthPct}%`,
  };

  const className = `absolute overflow-hidden rounded-lg border px-2 py-1 text-left ${styles.block} ${styles.text}`;

  const content = (
    <>
      <p className="truncate text-xs font-semibold leading-tight">{block.meeting.name}</p>
      <p className="truncate text-[10px] leading-tight opacity-80">
        {formatMinutes(block.meeting.startMinute)}
      </p>
      {showRoom && (
        <p className="truncate text-[10px] leading-tight opacity-80">{block.meeting.room}</p>
      )}
      {showInstructor && (
        <p className="truncate text-[10px] leading-tight opacity-80">{block.meeting.instructor}</p>
      )}
    </>
  );

  if (!onSelect) {
    return <div className={className} style={positioning}>{content}</div>;
  }

  return (
    <button
      type="button"
      // Read by ScheduleGrid's long-press handler to tell "pressed a class"
      // from "pressed empty space".
      data-class-block=""
      onClick={onSelect}
      aria-label={`Edit ${block.meeting.name}`}
      className={className}
      style={positioning}
    >
      {content}
    </button>
  );
```

- [ ] **Step 3: Verify**

Run: `npx tsc -b`
Expected: no output.

Run: `npm test`
Expected: PASS — 298 tests. Every existing caller omits `onSelect`, so blocks still render as divs.

- [ ] **Step 4: Commit**

```bash
git add src/features/schedule/ClassBlock.tsx
git commit -m "feat(schedule): let a class block act as a button in edit mode"
```

---

## Task 7: Edit callbacks on `ScheduleGrid`

`ScheduleGrid` keeps owning `selectedDay`. It gains three optional callbacks and wires long-press onto the mobile column.

**Read `src/features/schedule/ScheduleGrid.tsx` in full before editing.**

**Files:**
- Modify: `src/features/schedule/ScheduleGrid.tsx`

- [ ] **Step 1: Widen the props**

Replace the import line and signature. The file currently starts:

```tsx
import { useState } from 'react';
import { computeAxis, computeLayout, axisHours } from '@/domain/layout';
```

Add after the existing imports:

```tsx
import { minuteFromOffset } from '@/domain/gridTime';
import { useLongPress } from './useLongPress';
```

Then replace:

```tsx
export default function ScheduleGrid({ classes }: { classes: ClassMeeting[] }) {
```

with:

```tsx
interface Props {
  classes: ClassMeeting[];
  /** Edit mode: a block was tapped. */
  onSelectClass?: (meeting: ClassMeeting) => void;
  /** Edit mode: empty space was long-pressed, on this day at this minute. */
  onCreateAt?: (day: number, startMinute: number) => void;
  /** Edit mode: the visible day changed, so an open sheet can close itself. */
  onDayChange?: (day: number) => void;
}

export default function ScheduleGrid({ classes, onSelectClass, onCreateAt, onDayChange }: Props) {
```

- [ ] **Step 2: Handle the day change and the long press**

Directly below the existing `const [selectedDay, setSelectedDay] = useState(initial);`, add:

```tsx
  function selectDay(day: number) {
    setSelectedDay(day);
    onDayChange?.(day);
  }
```

Below the existing `const mobileBlocks = …` line, add:

```tsx
  const longPress = useLongPress((offsetY) => {
    onCreateAt?.(selectedDay, minuteFromOffset(offsetY, axis));
  });

  /**
   * Blocks sit inside this column, so a press on one bubbles up here. Without
   * this guard, long-pressing an existing class would create a second class on
   * top of it. A press landing on a class is that class's business —
   * ClassBlock's own onClick edits it. Only empty space creates.
   */
  const createHandlers = onCreateAt
    ? {
        ...longPress,
        onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
          if ((event.target as HTMLElement).closest('[data-class-block]')) return;
          longPress.onPointerDown(event);
        },
      }
    : {};
```

- [ ] **Step 3: Wire them into the markup**

Change the `DaySelector` line from:

```tsx
      <DaySelector days={days} selected={selectedDay} onSelect={setSelectedDay} />
```

to:

```tsx
      <DaySelector days={days} selected={selectedDay} onSelect={selectDay} />
```

Replace the mobile column block:

```tsx
        <div className="relative flex-1 lg:hidden" style={{ height: gridHeight }}>
          <HourRules hours={hours} />
          <div className="absolute inset-0">
            {mobileBlocks.map((block) => (
              <ClassBlock key={`${block.meeting.id}-${block.day}`} block={block} />
            ))}
          </div>
        </div>
```

with:

```tsx
        <div
          className="relative flex-1 touch-pan-y lg:hidden"
          style={{ height: gridHeight }}
          {...createHandlers}
        >
          <HourRules hours={hours} />
          <div className="absolute inset-0">
            {mobileBlocks.map((block) => (
              <ClassBlock
                key={`${block.meeting.id}-${block.day}`}
                block={block}
                onSelect={onSelectClass ? () => onSelectClass(block.meeting) : undefined}
              />
            ))}
          </div>
        </div>
```

`touch-pan-y` keeps vertical scrolling native while the press is being timed.

- [ ] **Step 4: Verify**

Run: `npx tsc -b`
Expected: no output.

Run: `npm test`
Expected: PASS — 298 tests. All three callbacks are optional, so the read-only schedule and friend views are unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/features/schedule/ScheduleGrid.tsx
git commit -m "feat(schedule): add optional edit callbacks to ScheduleGrid"
```

---

## Task 8: `ClassSheet`

**Files:**
- Create: `src/features/schedule/ClassSheet.tsx`

- [ ] **Step 1: Write the component**

Create `src/features/schedule/ClassSheet.tsx`:

```tsx
// src/features/schedule/ClassSheet.tsx
import { useEffect, useRef } from 'react';
import ClassCard from '@/features/upload/ClassCard';
import Button from '@/components/Button';
import type { ExtractedClass } from '@/domain/types';

interface Props {
  value: ExtractedClass;
  onChange: (next: ExtractedClass) => void;
  onDone: () => void;
  onDelete: () => void;
  onClose: () => void;
}

/**
 * The mobile editor's bottom sheet: one class, whole, no scrolling.
 *
 * Not a native <dialog>. `showModal` is unimplemented in this project's jsdom,
 * so a native dialog could not be tested in the existing Vitest setup — hence
 * the modal affordances (focus move, focus trap, Escape, backdrop) are written
 * out by hand here.
 *
 * Deletion lives in this header rather than inside ClassCard: it is the 52px
 * that lets the card fit the sheet on a 390x844 screen.
 */
export default function ClassSheet({ value, onChange, onDone, onDelete, onClose }: Props) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Remember what opened the sheet so focus can go back on close, rather
    // than falling to the top of the document.
    const opener = document.activeElement as HTMLElement | null;
    panel.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panel.current) return;

      const focusable = panel.current.querySelectorAll<HTMLElement>(
        'button, input, [href], select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      opener?.focus?.();
    };
  }, [onClose]);

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-slate-900/40"
        onClick={onClose}
        aria-hidden="true"
        data-testid="sheet-backdrop"
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={value.name ? `Edit ${value.name}` : 'Add a class'}
        tabIndex={-1}
        className="fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
          <Button variant="ghost" size="sm" onClick={onDelete} className="text-rose-600">
            Delete
          </Button>
          <p className="truncate px-2 text-sm font-semibold">{value.name || 'New class'}</p>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            Close
          </Button>
        </div>

        <div className="p-3">
          {/* No onRemove: deletion is in the header above. */}
          <ClassCard index={0} value={value} onChange={onChange} />
          <Button onClick={onDone} className="mt-3 w-full">
            Done
          </Button>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc -b`
Expected: no output. `ClassSheet` is unused until Task 9.

- [ ] **Step 3: Commit**

```bash
git add src/features/schedule/ClassSheet.tsx
git commit -m "feat(schedule): add the mobile class-editing bottom sheet"
```

---

## Task 9: `MobileEditor`

**Files:**
- Create: `src/features/schedule/MobileEditor.tsx`

- [ ] **Step 1: Write the component**

Create `src/features/schedule/MobileEditor.tsx`:

```tsx
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
        <Button
          size="sm"
          disabled={!valid || saving}
          onClick={() => onSave(value)}
        >
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
```

- [ ] **Step 2: Verify**

Run: `npx tsc -b`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/features/schedule/MobileEditor.tsx
git commit -m "feat(schedule): add the mobile editor shell and sheet state"
```

---

## Task 10: Branch `SchedulePage` on viewport

**Files:**
- Modify: `src/features/schedule/SchedulePage.tsx`

- [ ] **Step 1: Import the hook and the editor**

In `src/features/schedule/SchedulePage.tsx`, add to the imports:

```tsx
import MobileEditor from './MobileEditor';
import { useMediaQuery } from '@/lib/useMediaQuery';
```

- [ ] **Step 2: Read the breakpoint**

Directly below `const [saveError, setSaveError] = useState<string | null>(null);` add:

```tsx
  // Desktop and mobile render structurally different editors — a panel of every
  // class versus a sheet holding one — so this branch cannot be pure CSS.
  const isDesktop = useMediaQuery('(min-width: 1024px)');
```

- [ ] **Step 3: Render the mobile editor**

Replace the whole `if (editing) { … }` block with:

```tsx
  if (editing && !isDesktop) {
    return (
      <MobileEditor
        value={draft}
        onChange={setDraft}
        saving={saving}
        error={saveError}
        onSave={handleSave}
        onCancel={cancelEditing}
      />
    );
  }

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
```

- [ ] **Step 4: Show Edit at every width**

In the same file, change:

```tsx
            <Button variant="secondary" onClick={startEditing} className="hidden lg:inline-flex">
              Edit
            </Button>
```

to:

```tsx
            <Button variant="secondary" onClick={startEditing}>
              Edit
            </Button>
```

and delete the three-line `/* Desktop only for now … */` comment directly above it, which no longer describes the code.

- [ ] **Step 5: Verify the desktop editor did not regress**

Run: `npx tsc -b`
Expected: no output.

Run: `npx vitest run src/features/schedule/__tests__/SchedulePage.test.tsx`
Expected: FAIL. The existing tests do not stub `matchMedia`, which jsdom does not implement, so `isDesktop` is false and they now render the mobile editor.

This is the expected consequence of the change, and Step 6 fixes it.

- [ ] **Step 6: Stub `matchMedia` as desktop in the existing tests**

At the top of `src/features/schedule/__tests__/SchedulePage.test.tsx`, inside the existing `beforeEach`, add a desktop stub as the first line:

```tsx
beforeEach(() => {
  // jsdom has no matchMedia. These tests cover the desktop editor, so report
  // a match for the `lg` breakpoint; MobileEditor has its own test file.
  vi.stubGlobal('matchMedia', () => ({
    matches: true,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));

  currentClasses = [meeting()];
  saveSchedule.mockReset().mockResolvedValue(undefined);
  reload.mockReset().mockResolvedValue(undefined);
});
```

- [ ] **Step 7: Verify**

Run: `npx vitest run src/features/schedule/__tests__/SchedulePage.test.tsx`
Expected: PASS — 16 tests.

Run: `npm test`
Expected: PASS — 298 tests.

- [ ] **Step 8: Commit**

```bash
git add src/features/schedule/SchedulePage.tsx src/features/schedule/__tests__/SchedulePage.test.tsx
git commit -m "feat(schedule): route mobile widths to the sheet-based editor"
```

---

## Task 11: `MobileEditor` behaviour tests

**Files:**
- Create: `src/features/schedule/__tests__/MobileEditor.test.tsx`

- [ ] **Step 1: Write the tests**

Create `src/features/schedule/__tests__/MobileEditor.test.tsx`:

```tsx
// @vitest-environment jsdom
// src/features/schedule/__tests__/MobileEditor.test.tsx
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import MobileEditor from '../MobileEditor';
import { LONG_PRESS_MS } from '../useLongPress';
import type { ExtractedClass } from '@/domain/types';

// See the same note in useLongPress.test.tsx — jsdom has no PointerEvent.
if (typeof window.PointerEvent === 'undefined') {
  // @ts-expect-error assigning a minimal stand-in onto the jsdom window
  window.PointerEvent = class PointerEventStub extends MouseEvent {};
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

function draft(over: Partial<ExtractedClass> = {}): ExtractedClass {
  return {
    name: 'BIO 101', instructor: null, room: null, courseCode: null, section: null,
    days: [1], startMinute: 600, endMinute: 650,
    ...over,
  };
}

/** Renders with day 1 (Monday) selected, so the seeded class is visible. */
function renderEditor(value: ExtractedClass[], onChange = vi.fn()) {
  const utils = render(
    <MobileEditor
      value={value}
      onChange={onChange}
      saving={false}
      error={null}
      onSave={vi.fn()}
      onCancel={vi.fn()}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Mon' }));
  return { ...utils, onChange };
}

function openFirstClass() {
  fireEvent.click(screen.getByRole('button', { name: 'Edit BIO 101' }));
}

describe('MobileEditor', () => {
  it('shows the long-press hint, which is the only cue for adding', () => {
    renderEditor([draft()]);
    expect(screen.getByText(/press and hold an empty slot/i)).toBeDefined();
  });

  it('opens the sheet for a tapped class', () => {
    renderEditor([draft()]);
    openFirstClass();

    expect(screen.getByRole('dialog', { name: 'Edit BIO 101' })).toBeDefined();
    expect((screen.getByDisplayValue('BIO 101') as HTMLInputElement).value).toBe('BIO 101');
  });

  it('writes edits straight through to the draft, so the grid can preview them', () => {
    const { onChange } = renderEditor([draft()]);
    openFirstClass();

    fireEvent.change(screen.getByDisplayValue('BIO 101'), { target: { value: 'BIO 102' } });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0][0].name).toBe('BIO 102');
  });

  it('closes the sheet on Done', () => {
    renderEditor([draft()]);
    openFirstClass();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('deletes the class from the sheet header', () => {
    const { onChange } = renderEditor([draft()]);
    openFirstClass();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(onChange.mock.calls[0][0]).toHaveLength(0);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes the sheet on Escape', () => {
    renderEditor([draft()]);
    openFirstClass();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes the sheet when the backdrop is tapped', () => {
    renderEditor([draft()]);
    openFirstClass();

    fireEvent.click(screen.getByTestId('sheet-backdrop'));

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes the sheet when the visible day changes', () => {
    renderEditor([draft()]);
    openFirstClass();

    fireEvent.click(screen.getByRole('button', { name: 'Wed' }));

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('appends a long-pressed class only once Done is pressed', () => {
    const { onChange } = renderEditor([draft()]);

    const column = document.querySelector('.touch-pan-y') as HTMLElement;
    fireEvent.pointerDown(column, { button: 0, clientX: 10, clientY: 0, pointerId: 1 });
    vi.advanceTimersByTime(LONG_PRESS_MS);

    expect(screen.getByRole('dialog', { name: 'Add a class' })).toBeDefined();
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toHaveLength(2);
  });

  it('edits rather than creates when an existing block is long-pressed', () => {
    const { onChange } = renderEditor([draft()]);

    const block = screen.getByRole('button', { name: 'Edit BIO 101' });
    fireEvent.pointerDown(block, { button: 0, clientX: 10, clientY: 100, pointerId: 1 });
    vi.advanceTimersByTime(LONG_PRESS_MS);

    // The guard in ScheduleGrid stops the press reaching the create handler.
    expect(screen.queryByRole('dialog', { name: 'Add a class' })).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('leaves no trace when a new-class sheet is dismissed without Done', () => {
    const { onChange } = renderEditor([draft()]);

    const column = document.querySelector('.touch-pan-y') as HTMLElement;
    fireEvent.pointerDown(column, { button: 0, clientX: 10, clientY: 0, pointerId: 1 });
    vi.advanceTimersByTime(LONG_PRESS_MS);
    fireEvent.click(screen.getByTestId('sheet-backdrop'));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('disables Save when every class has been deleted', () => {
    renderEditor([]);
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `npx vitest run src/features/schedule/__tests__/MobileEditor.test.tsx`
Expected: PASS — 12 tests.

If the long-press tests fail to find `.touch-pan-y`, confirm Task 7 Step 3 applied that class to the mobile column.

- [ ] **Step 3: Full suite**

Run: `npm test`
Expected: PASS — 332 tests (298 before this plan, plus 9 + 3 + 4 + 6 + 12).

- [ ] **Step 4: Commit**

```bash
git add src/features/schedule/__tests__/MobileEditor.test.tsx
git commit -m "test(schedule): cover the mobile sheet editor"
```

---

## Task 12: Verify on a real phone viewport

The spec's central claim is a pixel claim, so it needs measuring, not asserting.

**Files:** none — verification only.

- [ ] **Step 1: Full suite, typecheck, build**

Run: `npx tsc -b` — expected: no output.
Run: `npm test` — expected: 332 passed.
Run: `npm run build` — expected: builds. The pre-existing >500 kB chunk warning is not caused by this work.

- [ ] **Step 2: Measure the tightened card**

Start the dev server (`npm run dev`) and, at a 390×844 viewport, open the app and enter edit mode. In the browser console:

```js
Math.round(document.querySelector('li.rounded-2xl').getBoundingClientRect().height)
```

Expected: **≈356px** (was 470px). Anything above ~400px means a spacing edit from Task 5 was missed.

Then, with the sheet open:

```js
const p = document.querySelector('[role="dialog"]');
({ sheet: Math.round(p.getBoundingClientRect().height), scrolls: p.scrollHeight > p.clientHeight })
```

Expected: sheet ≈ 472px and `scrolls: false`. **`scrolls: true` at 390×844 means the zero-scroll goal was missed** — report it rather than accepting it.

- [ ] **Step 3: Walk the manual checklist (spec §11)**

At 390×844:

1. Edit is present at phone width.
2. Tapping a block raises the sheet showing that class.
3. All eight fields are visible without scrolling the sheet — name, days, starts, ends, course code, section, room, instructor.
4. Long-pressing empty space opens an "Add a class" sheet with that day pre-selected and a start time matching where you pressed.
5. A *scroll* gesture over the grid does **not** open the sheet.
6. The hint line is visible under the day selector.
7. Save persists; reopening the page shows the change.
8. Cancel with changes prompts before discarding.

- [ ] **Step 4: Re-check the two surfaces this touched indirectly**

`ClassCard` changed globally and `ScheduleGrid` gained props, so:

1. `/upload` → Enter manually → the review form still works, cards look right, Save bar still pinned to the bottom.
2. A friend's schedule at `/u/:username` still renders and its blocks are **not** clickable.
3. The desktop editor at ≥1024px still shows the two-column panel, unchanged.

- [ ] **Step 5: Guard checks**

Run: `git diff main --stat -- src/features/legal/`
Expected: **no output** (spec §3).

Run: `git diff main -- src/lib/analytics.ts supabase/migrations/`
Expected: **no output** (spec §3).

- [ ] **Step 6: Review the full diff**

Run: `git diff main --stat`

Expected, and nothing else:

```
docs/superpowers/plans/2026-08-22-mobile-schedule-editor.md
docs/superpowers/specs/2026-08-22-mobile-schedule-editor-design.md
src/domain/__tests__/gridTime.test.ts
src/domain/__tests__/mappers.test.ts
src/domain/gridTime.ts
src/domain/mappers.ts
src/features/schedule/ClassBlock.tsx
src/features/schedule/ClassSheet.tsx
src/features/schedule/MobileEditor.tsx
src/features/schedule/ScheduleGrid.tsx
src/features/schedule/SchedulePage.tsx
src/features/schedule/__tests__/MobileEditor.test.tsx
src/features/schedule/__tests__/SchedulePage.test.tsx
src/features/schedule/__tests__/useLongPress.test.tsx
src/features/schedule/useLongPress.ts
src/features/upload/ClassCard.tsx
src/lib/__tests__/useMediaQuery.test.ts
src/lib/useMediaQuery.ts
```

---

## Notes for whoever picks this up

**Report these rather than quietly fixing them:**

- The sheet scrolling internally at 390×844 (Task 12 Step 2). That is the goal failing, not a detail.
- The card measuring much above 356px — it means a spacing edit was missed and the sheet will not fit.

**Accepted, already decided — do not "fix" opportunistically:**

- The sheet hides the bottom ~56% of the grid, so a late-afternoon class being edited sits behind it and its live preview is invisible (spec §10). Auto-scrolling to lift it is deferred.
- `BottomNav` stays visible in mobile edit mode, so tapping it discards edits silently (spec §10). The real fix is the router-level blocker the parent spec deferred; it covers desktop too and belongs in its own change.
- At 360×640 the sheet scrolls internally. That is documented degradation (spec §5.2), unlike the 390×844 case above.

**Do not add:** drag-to-move blocks, a list view on mobile, multi-class editing, or any analytics event.
