# Edit a Saved Schedule — Design

**Date:** 2026-08-22
**Status:** Approved
**Extends:** `2026-08-16-schedule-matcher-design.md`

## 1. Overview

Today a student can only change their schedule by re-uploading a screenshot, or by using
"Enter manually instead" on `/upload` — which starts from a blank form and discards everything
already saved. There is no way to fix one wrong room number without redoing the whole schedule.

This adds an **Edit** action to the schedule page. Clicking it turns the page into a two-column
view in place: the schedule grid moves to the left half, and an editable list of every class
appears on the right. Edits on the right update the grid on the left live. Save writes the whole
schedule atomically; Cancel discards, confirming first if there are unsaved changes.

**Scope: desktop only (`lg:` and up).** The app is mobile-first overall, but a split-screen
editor is a desktop shape. Desktop is also the lower-traffic surface, which makes it the right
place to prove the interaction before designing the mobile equivalent. Mobile gets its own spec
once this works.

## 2. Goals

- An **Edit** button on the schedule page when a schedule exists, at `lg:` and up.
- Edit mode renders in place — no route change, no navigation.
- Left column: the existing schedule grid, re-rendering live from in-progress edit state.
- Right column: every class as an editable card, with add and remove.
- Save persists the full schedule atomically and returns to the normal view.
- Cancel discards, prompting first when there are unsaved changes.
- Closing or reloading the tab with unsaved changes warns the user.

## 3. Non-goals

- **Mobile edit UX.** The Edit button is hidden below `lg:`. Mobile students keep the existing
  upload / manual-entry path until a follow-up spec covers it.
- **Click-a-block-to-edit-that-class.** The right panel is always the full list. Selecting a
  block on the left to focus its card is a possible later refinement, not part of this.
- **Guarding in-app navigation.** Clicking "Friends" in the nav mid-edit discards silently. Only
  Cancel and tab-close/reload are guarded. See §8.
- **Per-class partial saves.** Save is all-or-nothing over the whole schedule, reusing the
  existing `replace_schedule` RPC.
- **Conflict detection between tabs.** Last write wins, exactly as re-uploading behaves today.
- **Undo / edit history.**
- **Analytics.** No usage event is recorded for editing. This is deliberate, not an oversight —
  see §10.3.

## 4. Architecture

No new routes, no schema changes, no new RPCs. Everything reuses machinery that already exists:
`ReviewForm` and `ClassCard` for the form, `ScheduleGrid` for the grid, `saveSchedule()` for
persistence.

### 4.1 State ownership change

`ReviewForm` currently owns its class list internally:

```tsx
export default function ReviewForm({ initial, warnings, saving, onSave }: Props) {
  const [classes, setClasses] = useState<ExtractedClass[]>(initial);
```

Live preview needs the in-progress list on every keystroke, which internal state cannot provide.
So the state moves up and `ReviewForm` becomes controlled:

```tsx
interface Props {
  value: ExtractedClass[];
  onChange: (next: ExtractedClass[]) => void;
  warnings: string[];
  saving: boolean;
  onSave: (classes: ExtractedClass[]) => void;
  /** false in edit mode: a viewport-fixed bar is wrong under a half-width column. */
  fixedBar?: boolean;   // default true
  saveLabel?: string;   // default 'Save schedule'
}
```

`UploadPage` takes ownership of that state itself. Its `Stage` union already carries
`{ name: 'reviewing'; classes; warnings }`, so the edit state lives alongside it as a sibling
`useState<ExtractedClass[]>`, seeded when the stage becomes `reviewing`. Behaviour on `/upload`
is unchanged — this is a mechanical lift, not a redesign.

`fixedBar={false}` renders the Save row as a normal in-flow element at the end of the column,
with Cancel beside it, instead of `fixed inset-x-0 bottom-0`.

### 4.2 New pieces

**`EditPanel`** (`src/features/schedule/EditPanel.tsx`) — a thin wrapper: a heading, an error
slot, `ReviewForm` with `fixedBar={false}` and `saveLabel="Save changes"`, and a Cancel button.
It holds no class state; everything comes through props from `SchedulePage`.

**Two mappers** in `src/domain/mappers.ts`:

```ts
/** Saved meeting → editable form value. Drops id and color: both are derived on save. */
export function meetingToExtracted(meeting: ClassMeeting): ExtractedClass;

/**
 * In-progress edit state → grid-renderable meetings, for the live preview only.
 * `id` is the array index, which is stable enough for a React key within a
 * single render pass and never reaches the database — saving goes through
 * `saveSchedule`, which builds its own rows and lets Postgres assign real ids.
 */
export function extractedToPreviewMeetings(classes: ExtractedClass[]): ClassMeeting[];
```

`extractedToPreviewMeetings` assigns colour with `colorForClass(c.name)` — the same deterministic
hash `saveSchedule` uses — so a block's colour in the preview is the colour it will have once
saved, including when renaming a class changes it.

**A dirty check** in `src/domain/scheduleEdit.ts`:

```ts
export function hasUnsavedChanges(a: ExtractedClass[], b: ExtractedClass[]): boolean;
```

Field-by-field comparison over the list, with `days` compared element-wise. `ExtractedClass` is
flat and shallow apart from `days`, so this is a short explicit function — no deep-equality
dependency.

### 4.3 `SchedulePage` composition

```tsx
const [editing, setEditing] = useState(false);
const [draft, setDraft] = useState<ExtractedClass[]>([]);
const [baseline, setBaseline] = useState<ExtractedClass[]>([]);

function startEditing() {
  const initial = classes.map(meetingToExtracted);
  setDraft(initial);
  setBaseline(initial);
  setEditing(true);
}
```

`baseline` is the snapshot taken at edit-start; `hasUnsavedChanges(draft, baseline)` is the dirty
flag. Both are discarded on exit.

When `editing` is false the page renders exactly as it does today. When true:

```
lg:grid lg:grid-cols-2 lg:gap-6
  ├── left:  <ScheduleGrid classes={extractedToPreviewMeetings(draft)} />
  └── right: <EditPanel value={draft} onChange={setDraft} … />
```

The grid renders preview meetings, never `classes` from the hook — the whole point is that it
tracks the draft.

## 5. Data flow

```
useSchedule.classes (ClassMeeting[])
        │
        │ startEditing: meetingToExtracted
        ▼
     draft (ExtractedClass[]) ◄──── ClassCard onChange (every keystroke)
        │
        ├── extractedToPreviewMeetings ──► ScheduleGrid            (left column)
        │
        ├── hasUnsavedChanges(draft, baseline) ──► dirty flag      (Cancel + beforeunload)
        │
        └── Save ──► saveSchedule(draft) ──► replace_schedule RPC
                          │
                          └── reload() ──► setEditing(false)
```

`saveSchedule` is used unchanged. It already maps `ExtractedClass[]` to rows, assigns
`colorForClass` and `sort_order`, and calls the `replace_schedule` RPC, which deletes and
re-inserts inside one transaction under RLS as the caller.

## 6. Entry and exit

**Entry.** The schedule page header currently holds one Link — "Replace" (or "Add" when empty).
An **Edit** button joins it, rendered only when `classes.length > 0` and only at `lg:` and up
(`hidden lg:inline-flex`). "Replace" stays as-is: replacing from a fresh screenshot and editing
what is already there are genuinely different actions.

Edit is hidden with no schedule at all — there is nothing to edit, and the empty state already
points at upload.

**Exit — Save.** Disabled until valid. On click: `saving` true, `saveSchedule(draft)`, then
`reload()` from `useSchedule`, then `editing` false. The reload matters: after save the grid must
show database truth with real ids, not preview meetings with index ids.

**Exit — Cancel.** If not dirty, exits immediately. If dirty, a confirm ("Discard changes?");
exits only on confirm. Draft and baseline are dropped either way.

**Exit — tab close or reload.** While `editing && dirty`, a `beforeunload` handler calls
`preventDefault()` to trigger the browser's native warning. The listener is registered in a
`useEffect` keyed on `editing` and the dirty flag, and removed on cleanup — a stale listener
would warn on every future page close for the rest of the session.

## 7. Validation

The rule `ReviewForm` already enforces is unchanged and now applies to edits too:

```
classes.length > 0 && every class has a non-empty name, ≥1 day, and endMinute > startMinute
```

Save is disabled while invalid. Per-field messages already live in `ClassCard` ("Pick at least
one day", "End time must be after the start").

One consequence worth stating: because the rule requires at least one class, **a student cannot
empty their schedule by removing every class in the editor** — Save stays disabled at zero. That
matches the upload flow, where a zero-class save was never possible either. Deleting a schedule
entirely is not a feature this app has, in edit mode or anywhere else, and this spec does not add
one.

## 8. Error handling

| Condition | Behaviour |
|---|---|
| Save fails (network, RLS, RPC error) | Inline error in `EditPanel`, edit mode stays open, draft intact. `replace_schedule` is transactional, so a failed save changed nothing. |
| Reload after save fails | The save succeeded; surface the load error the page already renders and leave edit mode. |
| Draft invalid | Save disabled; per-field messages in `ClassCard`. |
| Cancel while dirty | Confirm before discarding. |
| Tab close / reload while dirty | Native `beforeunload` warning. |
| In-app navigation while dirty | **Not guarded.** Edits are lost silently. Accepted for this pass; see below. |
| Another tab saves concurrently | Last write wins. No detection, same as re-upload today. |
| Class dragged outside 08:00–18:00 in the draft | `computeAxis` extends the axis, exactly as for saved classes — the preview path uses the same layout code. |

**On unguarded in-app navigation:** blocking it properly means a router-level navigation blocker,
which react-router v7 supports but which brings its own state machine and interacts with the
bottom/desktop nav. The two ways a student actually loses work — clicking Cancel by mistake, and
closing the tab — are both covered. Adding the router blocker later is a contained change.

## 9. Layout

Edit mode is `lg:grid lg:grid-cols-2 lg:gap-6` inside the existing `AppShell` container
(`lg:max-w-5xl`), giving each column roughly 450px.

**Known risk: the grid at half width.** `ScheduleGrid`'s desktop branch renders Mon–Fri (plus any
weekend day in use) alongside the hour-label gutter. At ~450px that is roughly 85px per column.
`WEEKDAY_LABELS` is already three-letter ("Mon", "Tue"), so the headers themselves fit; the
pressure is on `ClassBlock`'s contents — class name, room, time — which already truncate on a
phone-width column, so the failure mode is aggressive truncation rather than overflow. Settle
this against the real rendered page; no layout change is planned up front. The mobile
single-day branch is not reused here — a day selector inside a desktop editor would hide the
classes being edited.

The right column scrolls with the page. With a dozen classes it is long; that is acceptable and
matches the upload review flow. The Save/Cancel row sits at the end of the column in normal flow,
not fixed to the viewport.

## 10. Legal and privacy

**Conclusion: no change to `PrivacyPage.tsx` or `TermsPage.tsx` is required.** The reasoning is
recorded here so it does not have to be re-derived at review time.

### 10.1 Why nothing changes

The privacy policy is drafted to Quebec's Law 25 and PIPEDA, and its header states that every
factual assertion describes the system as built. This feature does not alter any of those facts:

| Question | Answer |
|---|---|
| New categories of personal information? | No. The editor writes the same `classes` columns already disclosed in clause 3. |
| New processing? | No. Editing is manual. No OCR, no language model, no automated decision. Clause 4.4 concerns image extraction only and is untouched. |
| New communication to a third party? | No. Save is a Postgres write through the existing `replace_schedule` RPC. No Gemini call, no processor. |
| Change to retention? | No. `replace_schedule` deletes and re-inserts as it does today. |
| Change to who can see the data? | No. Friend visibility is governed by the unchanged `classes` RLS policies. |
| New usage events recorded? | No — deliberately. See §10.3. |

The purpose is also already disclosed. Clause 6.1 states that personal information is used to
"enable you to record, **correct** and display your course schedule". Correction is an
already-declared purpose; this feature is the first proper implementation of it, not a new one.

### 10.2 The feature strengthens an existing commitment

Clause 10.1 grants the right to **rectify** personal information that is "inaccurate, incomplete
or equivocal", and clause 10.2 states those rights "may be exercised **directly within the
Service**".

Today the only in-Service way to correct a saved schedule is to replace it wholesale from a new
screenshot. That is a thin reading of a commitment already made in writing: a student who needs
to fix one wrong room number has no proportionate way to do it. A real editor makes clause 10.2
straightforwardly true rather than technically arguable.

This is worth stating plainly: the compliance value here runs the other way from usual. The
feature is not a new legal exposure to be papered over — it closes a gap between what the policy
promises and what the software offers.

**Do not bump `LAST_UPDATED_EN` / `LAST_UPDATED_FR`.** No clause wording changes, and under
clause 14.2 a moved amendment date signals an amendment to students. Bumping it for a release
that amends nothing is itself misleading. Those two constants move only when clause text moves,
and always together.

### 10.3 Guardrail: do not add an analytics event

Instrumenting the editor would be a natural reflex and is out of scope. It is not free:

- `app_events.kind` carries a database CHECK constraint,
  `check (kind in ('open', 'compare_pair', 'compare_group'))` (migration `0009_app_events.sql`),
  and `EventKind` in `src/lib/analytics.ts` mirrors it. A new kind needs a migration, not just a
  string literal.
- `PrivacyPage.tsx`'s header binds clause 5 to what `analytics.ts` and `0009` actually record. A
  new event type is a privacy-document question, not only a code question — which means clause 5
  review, French translation, and the `LAST_UPDATED` bump §10.2 otherwise forbids.

None of that is warranted to count edits. If instrumentation is wanted later, it is its own
change with its own legal review.

## 11. Testing

**Unit (Vitest), on the pure logic:**

- `meetingToExtracted` — every field carried across; `id` and `color` dropped.
- `extractedToPreviewMeetings` — colour matches `colorForClass(name)` for the same name, so
  preview colour equals post-save colour; ids unique across the list; empty list returns empty.
- Round trip: `meetingToExtracted` then `extractedToPreviewMeetings` preserves name, days, times,
  and optional fields.
- `hasUnsavedChanges` — identical lists false; changed name / time / day-set / optional field
  true; added or removed class true; reordered `days` within a class compared element-wise;
  empty-vs-empty false.

**Manual verification at a desktop viewport (≥1024px):**

1. Edit appears with a schedule, is absent with none, is absent below `lg:`.
2. Clicking Edit splits the view without navigating.
3. Changing a class's time moves its block on the left immediately.
4. Renaming a class to something that hashes to a different colour recolours the block.
5. Add-a-class shows a new block once it has a name, days, and times.
6. Remove-a-class removes its block.
7. Save persists; reopening the page shows the change.
8. Cancel with no changes exits with no prompt; Cancel with changes prompts, and "keep editing"
   preserves the draft.
9. Reloading the tab mid-edit triggers the browser warning.
10. Save with the network offline shows the inline error and keeps the draft.

The existing `/upload` flow is re-verified after the `ReviewForm` controlled-component change:
extract → review → edit → save still works, and the Save bar is still fixed to the bottom there.
