// src/domain/time.ts

/**
 * Accepts "10:00 AM", "10:00am", "1:15p", "8 a.m.", "13:00", "08:05".
 * Returns minutes from midnight, or null when the input cannot be trusted.
 * Returning null rather than guessing matters: a wrong time is worse than a
 * blank field the student can fill in.
 */
const TIME_PATTERN = /^(\d{1,2})(?::(\d{2}))?([ap])?\.?m?\.?$/;

export function parseTimeToMinutes(raw: string): number | null {
  const compact = raw.trim().toLowerCase().replace(/\s+/g, '');
  const match = TIME_PATTERN.exec(compact);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  const meridiem = match[3];

  if (minute > 59) return null;

  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    if (meridiem === 'a') hour = hour === 12 ? 0 : hour;
    else hour = hour === 12 ? 12 : hour + 12;
  } else if (hour > 23) {
    return null;
  }

  return hour * 60 + minute;
}

export function formatMinutes(total: number): string {
  const hour24 = Math.floor(total / 60) % 24;
  const minute = total % 60;
  const meridiem = hour24 < 12 ? 'AM' : 'PM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${meridiem}`;
}

export function formatHourLabel(total: number): string {
  const hour24 = Math.floor(total / 60) % 24;
  const meridiem = hour24 < 12 ? 'AM' : 'PM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12} ${meridiem}`;
}

/** For <input type="time">, which requires 24-hour "HH:MM". */
export function toTimeInputValue(total: number): string {
  const hour = Math.floor(total / 60);
  const minute = total % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
