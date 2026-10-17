// src/lib/supabaseErrors.ts

/** The shape supabase-js resolves with — a PostgrestError, or a network failure. */
export interface BackendError {
  code?: string;
  message?: string;
}

/**
 * PostgREST's "that table / function does not exist" family. Seen when the app
 * is deployed ahead of its migrations (0016+), which is the normal order of
 * operations on this project — the frontend ships from Vercel, the SQL is
 * applied by hand — so it gets a message of its own instead of reading as a
 * generic outage.
 */
const MISSING_BACKEND_CODES = new Set(['PGRST202', 'PGRST205', '42P01', '42883']);

export function isMissingBackend(error: BackendError | null | undefined): boolean {
  return Boolean(error?.code && MISSING_BACKEND_CODES.has(error.code));
}

export const MISSING_BACKEND_MESSAGE =
  'This part of the app is not switched on yet: the server is missing its latest database update. ' +
  'Everything else keeps working.';

/**
 * Codes whose message was written for a student, by us, in SQL:
 *   P0001  raise exception '…' in an RPC (the default errcode)
 *   42501  raise … using errcode = '42501' — a permission refusal
 *   28000  raise … using errcode = '28000' — not signed in
 * Anything else (constraint names, internal detail) is replaced by `fallback`.
 */
const OWN_MESSAGE_CODES = new Set(['P0001', '42501', '28000']);

export function userMessage(error: BackendError | null | undefined, fallback: string): string {
  if (!error) return fallback;
  if (isMissingBackend(error)) return MISSING_BACKEND_MESSAGE;
  if (error.code && OWN_MESSAGE_CODES.has(error.code) && error.message) return error.message;
  if (!error.code && /fetch|network|load failed/i.test(error.message ?? '')) {
    return 'Could not reach the server. Check your connection and try again.';
  }
  return fallback;
}

/** Throws a student-readable Error when supabase-js resolved with one. */
export function throwIfError(error: BackendError | null | undefined, fallback: string): void {
  if (error) throw new Error(userMessage(error, fallback));
}

/** Pulls a message out of anything a catch block can receive. */
export function messageOf(caught: unknown, fallback: string): string {
  return caught instanceof Error && caught.message ? caught.message : fallback;
}
