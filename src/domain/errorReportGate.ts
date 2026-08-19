// src/domain/errorReportGate.ts

/**
 * A render error inside a re-render loop can fire thousands of times a
 * second. Without a hard cap, one broken student would fill the table.
 */
const MAX_REPORTS_PER_SESSION = 5;

export interface ErrorReportGate {
  seen: Set<string>;
  count: number;
}

/** One of these per page load — both limits reset on reload, on purpose. */
export function createErrorReportGate(): ErrorReportGate {
  return { seen: new Set(), count: 0 };
}

/**
 * Decides whether a client error should actually be sent, and records that
 * decision on the gate. Two independent reasons to say no: this exact crash
 * was already reported this session (the same fact 400 times is one fact),
 * or the session has already spent its report budget (a crash loop must not
 * be able to write an unbounded number of rows).
 */
export function shouldReport(gate: ErrorReportGate, fingerprint: string): boolean {
  if (gate.seen.has(fingerprint)) return false;
  if (gate.count >= MAX_REPORTS_PER_SESSION) return false;

  gate.seen.add(fingerprint);
  gate.count += 1;
  return true;
}
