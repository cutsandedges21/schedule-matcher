// src/lib/analytics.ts
import { supabase } from './supabase';

/**
 * Phase 0 instrumentation — see supabase/migrations/0009_app_events.sql and
 * §6 of docs/superpowers/specs/2026-08-17-monetization-design.md.
 *
 * Two rules govern everything in this file.
 *
 * **Analytics never breaks the app.** Every call is fire-and-forget and
 * swallows its own errors. A student whose schedule will not load because a
 * counting table is missing, or because an ad blocker ate the request, is a
 * catastrophically bad trade for a metric. This also means the client can ship
 * before migration 0009 is applied: the inserts just fail quietly until the
 * table exists.
 *
 * **Never chain `.select()`.** `app_events` has an insert policy and no select
 * policy on purpose. supabase-js sends `Prefer: return=minimal` only when you
 * do not ask for the row back; asking turns every write into a 401 and loses
 * the entire dataset silently. There is no test that would catch this, which is
 * why it is written on both sides.
 */

type EventKind = 'open' | 'compare_pair' | 'compare_group';

async function record(userId: string, kind: EventKind, friendCount?: number): Promise<void> {
  try {
    // No .select(). See the header.
    const { error } = await supabase.from('app_events').insert({
      user_id: userId,
      kind,
      friend_count: friendCount ?? null,
    });

    // supabase-js *resolves* with `{ error }` rather than throwing, so a
    // rejected insert — a missing table, a failed RLS check — never reaches the
    // catch below and would otherwise vanish without trace. Production stays
    // silent on purpose. Development must not: "app_events is empty" and
    // "analytics has been broken for a week" look identical from the SQL
    // editor, and the empty table is the expected state early on, which is
    // exactly when a real fault is easiest to miss.
    if (error && import.meta.env.DEV) {
      console.warn(`[analytics] ${kind} was not recorded:`, error.message);
    }
  } catch (caught) {
    // Network-level failure: offline, blocked by an extension, DNS. Same rule.
    if (import.meta.env.DEV) {
      console.warn(`[analytics] ${kind} failed to send:`, caught);
    }
  }
}

/**
 * `localStorage` throws rather than returning null in Safari private browsing
 * and when a profile blocks site data, and it is absent entirely in some
 * embedded webviews. Treat any failure as "no memory of a previous open",
 * which costs at worst one duplicate row a day.
 */
function readStore(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStore(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore — see readStore */
  }
}

const OPEN_KEY_PREFIX = 'sm:lastOpenLogged:';

/**
 * One 'open' row per user per local calendar day.
 *
 * Retention is measured in days active, so a second row on the same day adds
 * nothing and a student who leaves the PWA open on their home screen would
 * otherwise write one on every resume. Keyed by user id, so two test accounts
 * sharing a browser each get counted.
 *
 * The date is the *local* day for the same reason terms.ts reads local time:
 * a Montreal student opening the app at 9pm should count for that evening, not
 * for tomorrow.
 */
export function logAppOpen(userId: string): void {
  const now = new Date();
  const today = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  const key = `${OPEN_KEY_PREFIX}${userId}`;

  if (readStore(key) === today) return;
  writeStore(key, today);
  void record(userId, 'open');
}

/** The 1:1 view at `/compare/:username`, which is free at every tier. */
export function logComparePair(userId: string): void {
  void record(userId, 'compare_pair');
}

/**
 * A group compare the student actually looked at, sized by friends excluding
 * themselves.
 *
 * Callers are responsible for only firing this once the selection has settled
 * and the grid has rendered — GroupComparePage debounces it. Logging every
 * intermediate state would record 1, then 2, then 3 as a student builds a
 * group of three, and inflate exactly the small sizes the two-friend cap
 * question turns on.
 */
export function logCompareGroup(userId: string, friendCount: number): void {
  if (friendCount < 1) return;
  void record(userId, 'compare_group', friendCount);
}
