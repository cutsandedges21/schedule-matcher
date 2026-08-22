// src/features/schedule/SchedulePage.tsx
import { useEffect, useState } from 'react';
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
