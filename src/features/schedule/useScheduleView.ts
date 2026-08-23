// src/features/schedule/useScheduleView.ts
import { useCallback, useState } from 'react';

export type ScheduleView = 'day' | 'week';

const STORAGE_KEY = 'sm:scheduleView';

/**
 * `localStorage` throws rather than returning null in Safari private browsing
 * and is absent entirely in some embedded webviews — the same hazard
 * lib/analytics.ts documents. A forgotten preference costs one tap, so every
 * failure falls back to the default in silence.
 */
function readStoredView(): ScheduleView {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'week' ? 'week' : 'day';
  } catch {
    return 'day';
  }
}

/**
 * Day-versus-week choice for the grid on a phone, remembered across visits.
 *
 * Remembered rather than reset per visit because it is a preference about
 * eyesight and habit, not about this particular screen: a student who wants the
 * whole week wants it every time, and re-picking it on every navigation would
 * make the option feel broken.
 *
 * The default is 'day'. The week does fit on a phone, but it is tight, so
 * somebody who has never expressed a preference should land on the view built
 * for the screen they are holding. Desktop ignores this entirely — the week
 * always fits there, so there is nothing to choose.
 */
export function useScheduleView(): [ScheduleView, (next: ScheduleView) => void] {
  // Lazy initialiser, so storage is read once on mount rather than on every
  // render — and never while the module is first evaluated.
  const [view, setView] = useState<ScheduleView>(readStoredView);

  const choose = useCallback((next: ScheduleView) => {
    setView(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore — see readStoredView */
    }
  }, []);

  return [view, choose];
}
