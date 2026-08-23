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
