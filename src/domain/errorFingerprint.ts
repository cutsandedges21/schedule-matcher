// src/domain/errorFingerprint.ts

/**
 * A short, stable key for "is this the same crash as one already seen this
 * session" — the message plus the first stack frame, since that is the line
 * that actually threw. Frames below it vary with call depth and would
 * fragment one bug into many fingerprints for no reason. Not cryptographic:
 * collisions are acceptable for an in-memory dedupe set that lives and dies
 * with the page (see src/domain/errorReportGate.ts).
 *
 * Index 1, not 0: a stack string's first line is conventionally the error
 * name/message repeated, not a frame.
 */
export function errorFingerprint(message: string, stack?: string | null): string {
  const firstFrame = stack?.split('\n')[1]?.trim() ?? '';
  const input = `${message}|${firstFrame}`;

  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}
