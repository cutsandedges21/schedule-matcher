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

      // Clear any stale press *before* recording this one. `cancel` nulls
      // `origin`, so calling it afterwards would wipe the origin this press
      // depends on — leaving onPointerMove with nothing to measure drift
      // against, and a scroll indistinguishable from a held finger.
      cancel();
      origin.current = { x: event.clientX, y: event.clientY };

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
