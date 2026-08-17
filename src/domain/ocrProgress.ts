// src/domain/ocrProgress.ts
//
// Tesseract reports progress per *phase* — each one runs 0 → 1 and then the
// next starts over. Shown raw, the bar would fill, snap back to zero and fill
// again. These helpers flatten the phases onto one 0 → 1 scale.

/**
 * Fetching the core, the worker and the language data happens before a single
 * character is read, and on a phone over campus wifi it is often the longest
 * part of the wait — so it gets a third of the bar rather than being hidden.
 */
const SETUP_START = 0.04;
const SETUP_END = 0.35;

/** Recognition stops at 0.9; the last tenth covers parsing the words out. */
const READING_END = 0.9;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Tesseract's status string for the phase that actually reads characters. */
function isReading(status: string): boolean {
  return status.toLowerCase().includes('recogniz');
}

/**
 * Maps a phase and its progress onto the single bar. Phases are ordered, so
 * the result only moves forward as long as the caller keeps the maximum —
 * which it must, since Tesseract can re-emit an earlier phase.
 */
export function ocrProgressFraction(status: string, progress: number): number {
  const within = clamp01(progress);
  return isReading(status)
    ? SETUP_END + (READING_END - SETUP_END) * within
    : SETUP_START + (SETUP_END - SETUP_START) * within;
}

/**
 * What to tell the student. Deliberately two messages rather than Tesseract's
 * own status strings ("initializing api", "loading language traineddata"),
 * which describe our machinery rather than their schedule.
 */
export function ocrProgressLabel(status: string): string {
  return isReading(status) ? 'Reading your schedule…' : 'Getting the reader ready…';
}
