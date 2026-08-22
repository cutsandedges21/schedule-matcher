# Mobile Schedule Editor — Design

**Date:** 2026-08-22
**Status:** Approved
**Extends:** `2026-08-22-edit-saved-schedule-design.md` (desktop editor, shipped in `dbe4e55`)

## 1. Overview

The desktop editor puts the grid on the left and every class as a card on the right. That shape
does not survive contact with a phone. Measured at 390×844 against the real components:

| | Height |
|---|---|
| One `ClassCard` | 470px |
| Mobile grid (day selector + one day column) | 740px |
| Full form, 4 classes | 2030px |

Usable height after the bottom nav is roughly 764px. Stacking grid above form the way desktop
composes them is ~2770px — **3.6 screens of scrolling to change one room number.**

So mobile does not reuse the desktop composition. The grid stays full-screen; tapping a class
raises a bottom sheet holding that one class. Fixing one thing costs **zero scrolling**.

**Minimising scrolling is the governing constraint of this document.** Where it trades against
other goals, say so explicitly rather than quietly conceding it.

## 2. Goals

- Edit a saved schedule on a phone, reachable from the same Edit button as desktop.
- Tap a class block → a sheet containing that class, entirely visible without scrolling.
- Long-press an empty grid slot → the same sheet, pre-filled with that day and time.
- Delete a class from within the sheet.
- Save the whole schedule in one round trip; cancel with the existing confirm.
- Every interactive target stays ≥ 44×44 CSS px.

## 3. Non-goals

- **Changing the desktop editor.** It stays exactly as shipped.
- **Drag-to-move or drag-to-resize blocks.** A different, much larger feature.
- **Editing more than one class at a time on mobile.** No multi-select, no list view.
- **Auto-scrolling the grid to keep the edited block visible.** See §10.
- **A router-level navigation blocker.** Still inherited as-is from the desktop spec §8.
- **Analytics.** Same prohibition as the desktop spec §10.3 — it needs a migration and a
  privacy-clause review.

## 4. Choosing the layout in JavaScript

Everywhere else in this codebase the mobile/desktop split is pure CSS (`lg:hidden` /
`hidden lg:flex`). That works when the two branches render the same thing at different sizes.
Here they do not: desktop renders *all* classes in a panel, mobile renders *one* in a sheet.

Rendering both and CSS-hiding one would place a `position: fixed` sheet in the desktop DOM,
where a styling regression could float it over a working page. So this case gets a hook:

```ts
// src/lib/useMediaQuery.ts
export function useMediaQuery(query: string): boolean;
```

`SchedulePage` calls `useMediaQuery('(min-width: 1024px)')` — the `lg` breakpoint — and renders
either `EditPanel` (desktop, unchanged) or the mobile editor. The hook subscribes to
`matchMedia(...).change` so rotating a tablet across the boundary re-renders correctly.

This is a deliberate departure from the established pattern, justified by behavioural difference
rather than visual difference. It is not licence to convert other CSS breakpoints to JS.

## 5. Making the whole card fit

The alternative considered was collapsing the four optional fields (course code, section, room,
instructor) behind a "More details" toggle, saving 144px. **Rejected** — hiding fields to win
space trades one kind of friction for another, and the space can be found without it.

The 44px touch-target floor from the parent spec (§5, "Minimum 44×44 CSS px for every
interactive element") is not negotiable and is not a source of savings. Five rows of controls at
44px are a fixed 220px cost. Everything else is fair game:

| Change | Saves |
|---|---|
| `mt-3` → `mt-2` between the four field rows | 16px |
| `p-4` → `p-3` card padding | 8px |
| Remove button leaves the card for a trash icon in the sheet header | 52px |
| `leading-tight` on the field labels | ~38px |

**470px → ~356px, with nothing hidden.** Sheet chrome adds a 48px header and a 68px Done row, so
the sheet is **~472px** — 56% of a 390×844 screen, leaving 372px of grid visible above it.

### 5.1 `ClassCard` is tightened globally

The tightening lands in `ClassCard` itself, not behind a `compact` prop. The upload review form
renders the same component and has the same disease — 2030px for four classes — so one change
fixes both surfaces. The upload flow will look slightly tighter as a result; that is an intended
side effect, not collateral damage.

`onRemove` becomes optional. When it is omitted the card renders no remove button, which is what
the sheet needs since deletion moves to its header. `ReviewForm` keeps passing it, so the upload
list is unchanged in behaviour.

### 5.2 Short phones

At 360×640 the sheet leaves only 168px of grid. The sheet's body scrolls internally there rather
than growing past the viewport. Design target remains 390×844; this is graceful degradation, and
it is the one case where the zero-scroll goal is knowingly conceded.

## 6. The sheet

Not a native `<dialog>`. `showModal` is unimplemented in this project's jsdom (verified by probe
before writing this), so a native dialog would be untestable in the existing Vitest setup. The
sheet is therefore a plain fixed panel plus backdrop, with the accessibility affordances written
out explicitly:

- `role="dialog"`, `aria-modal="true"`, `aria-label` naming the class being edited.
- Focus moves to the sheet on open and returns to the triggering block on close.
- Escape closes it; so does tapping the backdrop.
- Focus is trapped within the sheet while open.

**Contents:** a header (class name, trash icon, close button), the tightened `ClassCard`, and a
full-width **Done**.

**Done applies the edit to `draft` and closes. It does not touch the network.** Persistence stays
where the desktop editor put it — a fixed bottom bar on the edit screen with **Save changes** and
**Cancel**, going through `saveSchedule` → `replace_schedule` in one round trip however many
classes were touched. The sheet overlays that bar while open.

Two commit steps (Done, then Save changes) is a real cost. It buys consistency with desktop, one
network round trip, and reuse of the dirty-tracking and `beforeunload` logic already shipped.

**Live preview survives.** The grid above the sheet renders from `draft`, so retiming a class
visibly moves its block — for any class not sitting behind the sheet (§10).

## 7. Adding a class: long-press

Long-pressing empty grid space opens the sheet pre-filled with the selected day and the pressed
time, snapped to 30 minutes, with a 50-minute default duration matching `ReviewForm`'s `BLANK`.

**Why the gesture differs from editing.** Tapping opens the edit sheet; long-pressing creates.
The asymmetry is deliberate and is about the cost of a misfire: an accidental sheet-open is a
dismissal, while an accidental *creation* puts junk in a student's schedule.

Worth recording, because it was raised during design: a scroll gesture registering as a tap is
not the risk it intuitively seems. Browsers already discriminate the two — a touch that moves
past the slop threshold fires no `click`. Tap-to-edit is safe on that count. Long-press for
creation is justified by the misfire-cost asymmetry above, not by tap being unreliable.

**Gesture detail.** `pointerdown` starts a 500ms timer, cancelled by `pointermove` past 10px or
by `pointerup`. The context menu is suppressed on the grid surface so long-press does not raise
the OS menu.

**Discoverability.** Nobody finds long-press unprompted, so edit mode shows a hint line under the
day selector: *"Press and hold an empty slot to add a class."* Without it this entry point is
effectively invisible; it is load-bearing, not decoration.

### 7.1 Position → time

A pure function, because this is where off-by-one errors live:

```ts
// src/domain/gridTime.ts
export function minuteFromOffset(offsetY: number, axis: AxisRange): number;
```

The grid container is sized to exactly `(axis span / 60) * HOUR_HEIGHT_PX`, and
`HOUR_HEIGHT_PX` is 64, so the mapping is `axis.startMinute + (offsetY / 64) * 60`, snapped down
to the nearest 30 and clamped to the axis. Snapping to 30 rather than 5 matters: at 64px/hour a
5-minute snap is 5.3px, finer than a fingertip can aim.

A press landing in the final 30 minutes of the axis would produce a class ending past the axis.
The start is clamped so the default 50-minute duration still fits inside the axis.

## 8. State

`SchedulePage`'s `editing`, `draft`, `baseline`, `saving`, `saveError` and the derived `dirty`
flag are **reused unchanged**. Mobile adds exactly one piece of state — which class the sheet is
editing:

```ts
type SheetTarget =
  | { kind: 'closed' }
  | { kind: 'existing'; index: number }
  | { kind: 'new'; seed: ExtractedClass };
```

Editing an existing class writes through to `draft[index]` on every keystroke, which is what
keeps the live preview honest. A `new` class is only appended to `draft` when Done is pressed —
so dismissing the sheet for a class you decided against leaves no trace, and the dirty flag does
not trip.

The Edit button loses `hidden lg:inline-flex` and shows at every width.

## 9. Error handling

Everything below the sheet is inherited and unchanged: save failure keeps the draft and shows the
reason, `replace_schedule` is transactional, Cancel-while-dirty confirms, `beforeunload` warns,
and an emptied schedule cannot be saved.

New to this document:

| Condition | Behaviour |
|---|---|
| Long-press lands on an existing block | Treated as a tap on that block — edit it, do not create. |
| Long-press in the last 30 min of the axis | Start clamped so the default duration fits (§7.1). |
| Sheet open when the day selector changes | Sheet closes. Its class may not exist on the new day, and leaving it open would be editing something invisible. |
| Sheet open for a class then deleted from it | Sheet closes; block disappears from the grid; draft is dirty. |
| New-class sheet dismissed without Done | Nothing appended; dirty flag untouched. |
| Sheet open on a viewport crossing 1024px | Sheet closes and the desktop panel takes over; `draft` is preserved, so no edit is lost. |

## 10. Known risk

**The sheet hides the bottom 56% of the grid.** Editing a 4 PM class means its own block sits
behind the sheet, so the live preview — the feature the desktop editor was built around — is
invisible for exactly the class being edited.

Mitigating it means auto-scrolling the grid to lift the edited block above the sheet, which
brings its own scroll-position management. Deliberately deferred: the preview still helps for
morning classes, and this may prove not to matter. If it does, it is a contained follow-up.

## 11. Testing

**Unit, on the pure logic:**

- `minuteFromOffset` — top and bottom of the axis, snapping down to the nearest 30, clamping
  above and below, an extended axis from an out-of-hours class, and the last-30-minutes case.
- `useMediaQuery` — initial match, response to a `change` event, listener cleanup.

**Component:**

- Long-press fires after the delay; is cancelled by movement past the threshold; is cancelled by
  early release.
- Tapping a block opens the sheet for that class; the sheet shows that class's values.
- Editing in the sheet updates the grid behind it (live preview through `draft`).
- Done on a new class appends it; dismissing without Done does not.
- The trash icon removes the class and closes the sheet.
- Changing the day while the sheet is open closes it.
- Escape and backdrop tap both close the sheet; focus returns to the block.
- The existing desktop `SchedulePage` tests keep passing untouched — mobile must not regress them.

**Manual, at 390×844:**

1. Edit is present on a phone-width viewport.
2. Tapping a block raises the sheet with no internal scrolling.
3. The whole card is visible — name, days, times, course code, section, room, instructor.
4. Long-press on empty space opens a pre-filled new-class sheet at the pressed time.
5. The hint line is visible under the day selector.
6. Save persists; reopening shows the change.
7. The upload review form still works and looks right after the `ClassCard` tightening.
