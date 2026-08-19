// src/lib/errorLog.ts
import { supabase } from './supabase';
import { errorFingerprint } from '@/domain/errorFingerprint';
import { routePattern } from '@/domain/routePattern';
import { createErrorReportGate, shouldReport } from '@/domain/errorReportGate';

/**
 * Client error monitoring — see supabase/migrations/0010_client_errors.sql.
 *
 * Same two rules as src/lib/analytics.ts, for the same reason: this must be
 * invisible to a student no matter how it fails.
 *
 * **Never chain `.select()`.** client_errors has an insert policy and no
 * select policy on purpose — see the migration header.
 *
 * **Reporting never breaks the app.** Every call swallows its own errors and
 * warns only in dev. An error reporter that throws inside a global error
 * handler is an infinite loop.
 *
 * Two things this file owns that analytics.ts does not need:
 *
 * **Rate limiting + dedup**, via src/domain/errorReportGate.ts. A render
 * error inside a re-render loop can fire thousands of times a second — the
 * gate caps reports per session and drops repeats of a fingerprint (message +
 * first stack frame, src/domain/errorFingerprint.ts) already seen.
 *
 * **Route scrubbing.** message/stack are logged verbatim (truncated only) —
 * they come straight from the browser. The one thing scrubbed on purpose is
 * the URL: routePattern() reduces it to "/compare", never
 * "/compare?with=alice,bob" — a friend graph has no business in a table built
 * specifically not to hold one (see 0009_app_events.sql).
 */

const MESSAGE_MAX = 500;
const STACK_MAX = 4000;
const ROUTE_MAX = 100;

const gate = createErrorReportGate();

export type ClientErrorSource = 'render' | 'window' | 'unhandledrejection';

export function reportClientError({
  message,
  stack,
  source,
}: {
  message: string;
  stack?: string | null;
  source: ClientErrorSource;
}): void {
  const fingerprint = errorFingerprint(message, stack);
  if (!shouldReport(gate, fingerprint)) return;

  void insert({
    message: message.slice(0, MESSAGE_MAX),
    stack: stack ? stack.slice(0, STACK_MAX) : null,
    route: routePattern(window.location.pathname).slice(0, ROUTE_MAX),
    source,
  });
}

async function insert(row: {
  message: string;
  stack: string | null;
  route: string;
  source: ClientErrorSource;
}): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession();

    // No .select(). See the header.
    const { error } = await supabase.from('client_errors').insert({
      user_id: data.session?.user.id ?? null,
      message: row.message,
      stack: row.stack,
      route: row.route,
      source: row.source,
    });

    // supabase-js resolves with { error } rather than throwing — see
    // analytics.ts's identical comment for why DEV must not stay silent here.
    if (error && import.meta.env.DEV) {
      console.warn('[errorLog] client error was not recorded:', error.message);
    }
  } catch (caught) {
    if (import.meta.env.DEV) {
      console.warn('[errorLog] client error failed to send:', caught);
    }
  }
}

function reasonToErrorish(reason: unknown): { message: string; stack?: string } {
  if (reason instanceof Error) return { message: reason.message, stack: reason.stack };
  return { message: String(reason) };
}

// Side effect on import — see the comment at the src/main.tsx call site.
// Guarded the same way src/lib/installPrompt.ts is, so importing this module
// from a non-browser test environment cannot throw.
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    reportClientError({ message: event.message, stack: event.error?.stack, source: 'window' });
  });

  // The one that matters most in practice: every failed `await` with no
  // local catch in this codebase surfaces here.
  window.addEventListener('unhandledrejection', (event) => {
    const { message, stack } = reasonToErrorish(event.reason);
    reportClientError({ message, stack, source: 'unhandledrejection' });
  });
}
