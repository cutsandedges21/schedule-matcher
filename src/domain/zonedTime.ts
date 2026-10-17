// src/domain/zonedTime.ts
//
// Wall-clock time in a named zone <-> absolute instants, with nothing but Intl.
//
// The weekly schedule stores wall-clock times ("Monday 10:00") with no zone
// and no date. Real dates arrive with Spaces — a meeting on Thursday the 23rd
// — so every comparison between the two has to pass through a zone: "Monday
// 10:00 in America/Toronto" is 15:00 UTC in February and 14:00 UTC in April.
//
// Conventions, used everywhere downstream:
//   * A DateKey is a calendar date, 'YYYY-MM-DD', with no zone of its own.
//   * An instant is epoch milliseconds.
//   * A minute-of-day is 0..1440 (1440 = midnight at the END of that date,
//     which the weekly schedule uses for classes that run to midnight).
//
// DST: a wall time that does not exist (the hour skipped in spring) resolves
// FORWARD by the gap, and one that happens twice (the hour repeated in the
// fall) resolves to the EARLIER instant — Temporal's 'compatible' rule, and
// what `new Date(y, m, d, h)` does for the local zone. Using the same rule as
// the platform means a time typed into an <input type="time"> lands where the
// student's own clock would put it.

export type DateKey = string;

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

/** Same check as the spaces/profiles timezone constraints in the migrations. */
export const TIME_ZONE_PATTERN = /^[A-Za-z][A-Za-z0-9_+/-]{0,63}$/;

export const DEFAULT_TIME_ZONE = 'America/Toronto';

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = partsFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    partsFormatters.set(timeZone, formatter);
  }
  return formatter;
}

export function isValidTimeZone(timeZone: string | null | undefined): timeZone is string {
  if (!timeZone || !TIME_ZONE_PATTERN.test(timeZone)) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** The device's zone, or the Montreal default when the platform will not say. */
export function browserTimeZone(fallback = DEFAULT_TIME_ZONE): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return isValidTimeZone(zone) ? zone : fallback;
  } catch {
    return fallback;
  }
}

/** Every zone the platform knows, for a picker; a short list where it cannot say. */
export function supportedTimeZones(): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
  try {
    const zones = intl.supportedValuesOf?.('timeZone');
    if (zones && zones.length > 0) return zones;
  } catch {
    /* fall through */
  }
  return [
    'America/Toronto',
    'America/Halifax',
    'America/St_Johns',
    'America/Winnipeg',
    'America/Edmonton',
    'America/Vancouver',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Paris',
    'Asia/Kolkata',
    'Asia/Tokyo',
    'Australia/Sydney',
    'UTC',
  ];
}

// Offsets are constant within a 15-minute UTC bucket: every transition of a
// modern zone falls on a 15-minute boundary (offsets are whole quarter-hours
// and transitions happen at whole local hours or half hours). Caching per
// bucket turns the availability engine's thousands of conversions into a few
// dozen Intl calls.
const offsetCache = new Map<string, number>();
const OFFSET_BUCKET_MS = 15 * MINUTE_MS;

/** Minutes to add to UTC to read the wall clock in `timeZone` at this instant. */
export function offsetMinutesAt(epochMs: number, timeZone: string): number {
  const key = `${timeZone}|${Math.floor(epochMs / OFFSET_BUCKET_MS)}`;
  const cached = offsetCache.get(key);
  if (cached !== undefined) return cached;

  const parts = partsFormatter(timeZone).formatToParts(new Date(epochMs));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  const wallAsUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  const offset = Math.round((wallAsUtc - Math.floor(epochMs / 1000) * 1000) / MINUTE_MS);

  if (offsetCache.size > 20_000) offsetCache.clear();
  offsetCache.set(key, offset);
  return offset;
}

export function parseDateKey(key: DateKey): { year: number; month: number; day: number } {
  const match = DATE_KEY_PATTERN.exec(key);
  if (!match) throw new Error(`Not a date: ${key}`);
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

export function isDateKey(value: string): value is DateKey {
  const match = DATE_KEY_PATTERN.exec(value);
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.getUTCDate() === Number(match[3]) && date.getUTCMonth() === Number(match[2]) - 1;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function dateKeyFromUtc(ms: number): DateKey {
  const date = new Date(ms);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** Calendar arithmetic only — no zone, so no DST to trip over. */
export function addDays(key: DateKey, days: number): DateKey {
  const { year, month, day } = parseDateKey(key);
  return dateKeyFromUtc(Date.UTC(year, month - 1, day + days));
}

/** ISO weekday, 1 = Monday .. 7 = Sunday — the numbering `classes.days` uses. */
export function isoWeekday(key: DateKey): number {
  const { year, month, day } = parseDateKey(key);
  const js = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return js === 0 ? 7 : js;
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: DateKey, to: DateKey): number {
  const a = parseDateKey(from);
  const b = parseDateKey(to);
  return Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / DAY_MS);
}

/** Every date from `from` to `to`, inclusive. Empty when `to` is before `from`. */
export function eachDateKey(from: DateKey, to: DateKey): DateKey[] {
  const count = daysBetween(from, to);
  const out: DateKey[] = [];
  for (let i = 0; i <= count; i += 1) out.push(addDays(from, i));
  return out;
}

/** The Monday on or before `key`. */
export function startOfWeek(key: DateKey): DateKey {
  return addDays(key, 1 - isoWeekday(key));
}

/**
 * The instant at which the wall clock in `timeZone` reads `minuteOfDay` on
 * `date`. See the header for how skipped and repeated times resolve.
 */
export function zonedToEpoch(date: DateKey, minuteOfDay: number, timeZone: string): number {
  const { year, month, day } = parseDateKey(date);
  const wall = Date.UTC(year, month - 1, day) + minuteOfDay * MINUTE_MS;

  // The offsets in force a day either side bracket any transition near this
  // wall time, for every zone within ±14 h of UTC.
  const before = offsetMinutesAt(wall - DAY_MS, timeZone);
  const after = offsetMinutesAt(wall + DAY_MS, timeZone);

  const candidates = before === after ? [wall - before * MINUTE_MS] : [wall - before * MINUTE_MS, wall - after * MINUTE_MS];
  const valid = candidates.filter(
    (instant) => instant + offsetMinutesAt(instant, timeZone) * MINUTE_MS === wall
  );
  if (valid.length > 0) return Math.min(...valid);

  // Skipped wall time: shift forward by the gap, using the pre-transition offset.
  return wall - before * MINUTE_MS;
}

export interface ZonedParts {
  date: DateKey;
  /** 0..1439 */
  minute: number;
  /** ISO weekday, 1..7 */
  weekday: number;
}

export function epochToZoned(epochMs: number, timeZone: string): ZonedParts {
  const wall = epochMs + offsetMinutesAt(epochMs, timeZone) * MINUTE_MS;
  const date = dateKeyFromUtc(wall);
  const asDate = new Date(wall);
  return {
    date,
    minute: asDate.getUTCHours() * 60 + asDate.getUTCMinutes(),
    weekday: isoWeekday(date),
  };
}

export function todayIn(timeZone: string, nowMs: number): DateKey {
  return epochToZoned(nowMs, timeZone).date;
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

const dateFormatters = new Map<string, Intl.DateTimeFormat>();

function dateFormatter(style: 'short' | 'long' | 'weekday'): Intl.DateTimeFormat {
  let formatter = dateFormatters.get(style);
  if (!formatter) {
    const options: Intl.DateTimeFormatOptions =
      style === 'long'
        ? { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric' }
        : style === 'weekday'
          ? { timeZone: 'UTC', weekday: 'short' }
          : { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' };
    formatter = new Intl.DateTimeFormat('en-US', options);
    dateFormatters.set(style, formatter);
  }
  return formatter;
}

/** "Mon, Oct 20" (short), "Monday, October 20" (long), "Mon" (weekday). */
export function formatDateKey(key: DateKey, style: 'short' | 'long' | 'weekday' = 'short'): string {
  const { year, month, day } = parseDateKey(key);
  // Noon UTC, formatted in UTC: the calendar date can never slip a day.
  return dateFormatter(style).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

/** "10:30 AM" on the wall clock of `timeZone`. */
export function formatTimeIn(epochMs: number, timeZone: string): string {
  const { minute } = epochToZoned(epochMs, timeZone);
  const hour24 = Math.floor(minute / 60);
  const meridiem = hour24 < 12 ? 'AM' : 'PM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${pad(minute % 60)} ${meridiem}`;
}

/** "Mon, Oct 20 · 10:30 AM – 12:00 PM", with the end date added when it differs. */
export function formatRangeIn(startMs: number, endMs: number, timeZone: string): string {
  const start = epochToZoned(startMs, timeZone);
  const end = epochToZoned(endMs, timeZone);
  const startText = `${formatDateKey(start.date)} · ${formatTimeIn(startMs, timeZone)}`;
  // An end at exactly midnight belongs to the day it closes, not the next one.
  const endsNextMidnight = end.minute === 0 && daysBetween(start.date, end.date) === 1;
  if (end.date === start.date || endsNextMidnight) {
    return `${startText} – ${formatTimeIn(endMs, timeZone)}`;
  }
  return `${startText} – ${formatDateKey(end.date)} ${formatTimeIn(endMs, timeZone)}`;
}

/** "EDT", "GMT+5:30" — the zone's abbreviation at that instant. */
export function zoneAbbreviation(epochMs: number, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' }).formatToParts(
      new Date(epochMs)
    );
    return parts.find((part) => part.type === 'timeZoneName')?.value ?? timeZone;
  } catch {
    return timeZone;
  }
}

/** "America/Toronto" -> "Toronto"; the city is what people recognise. */
export function timeZoneCity(timeZone: string): string {
  const last = timeZone.split('/').pop() ?? timeZone;
  return last.replace(/_/g, ' ');
}

// ---------------------------------------------------------------------------
// <input type="date"> / <input type="time">
// ---------------------------------------------------------------------------

/** "14:05" -> 845; null for anything an <input type="time"> would not produce. */
export function parseTimeInput(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

export function toTimeInput(minuteOfDay: number): string {
  const clamped = Math.max(0, Math.min(1439, minuteOfDay));
  return `${pad(Math.floor(clamped / 60))}:${pad(clamped % 60)}`;
}
