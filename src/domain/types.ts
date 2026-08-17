/** One meeting block: a class at one time, repeating on one or more weekdays. */
export interface ClassMeeting {
  id: string;
  name: string;
  instructor: string | null;
  room: string | null;
  courseCode: string | null;
  section: string | null;
  days: number[];
  startMinute: number;
  endMinute: number;
  color: string;
}

/** What the Edge Function returns — no id, no colour, not yet persisted. */
export interface ExtractedClass {
  name: string;
  instructor: string | null;
  room: string | null;
  courseCode: string | null;
  section: string | null;
  days: number[];
  startMinute: number;
  endMinute: number;
}

export interface Interval {
  start: number;
  end: number;
}

export interface AxisRange {
  startMinute: number;
  endMinute: number;
}

export interface Profile {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  inviteCode: string;
  /** School id from `domain/schools`, or null for the default theme. */
  school: string | null;
}
