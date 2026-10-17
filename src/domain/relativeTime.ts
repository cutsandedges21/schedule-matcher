// src/domain/relativeTime.ts

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * "just now", "5 min ago", "3 h ago", "2 days ago", then a plain date. For a
 * feed, where "how long ago" matters more than the timestamp itself; anything
 * older than a week is easier to place as a date.
 */
export function relativeTime(thenMs: number, nowMs: number): string {
  const diff = nowMs - thenMs;
  if (diff < 0) return 'just now';
  if (diff < MINUTE) return 'just now';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} min ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)} h ago`;
  const days = Math.floor(diff / DAY);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(thenMs).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * "in 3 h", "in 2 days", "2 days overdue" — for deadlines and start times.
 * Rounds toward the less alarming side: something due in 23 hours is "in 23 h",
 * not "tomorrow", because "tomorrow" at 11pm means something else.
 */
export function relativeDue(dueMs: number, nowMs: number): string {
  const diff = dueMs - nowMs;
  const abs = Math.abs(diff);
  const amount =
    abs < HOUR
      ? `${Math.max(1, Math.round(abs / MINUTE))} min`
      : abs < DAY
        ? `${Math.floor(abs / HOUR)} h`
        : `${Math.floor(abs / DAY)} ${Math.floor(abs / DAY) === 1 ? 'day' : 'days'}`;
  return diff >= 0 ? `in ${amount}` : `${amount} overdue`;
}
