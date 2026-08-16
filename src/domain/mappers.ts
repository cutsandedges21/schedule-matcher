import type { ClassMeeting, Profile } from './types';

export interface ClassRow {
  id: string;
  user_id: string;
  name: string;
  instructor: string | null;
  room: string | null;
  course_code: string | null;
  section: string | null;
  days: number[];
  start_minute: number;
  end_minute: number;
  color: string;
  sort_order: number;
}

export interface ProfileRow {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  invite_code: string;
}

export function rowToMeeting(row: ClassRow): ClassMeeting {
  return {
    id: row.id,
    name: row.name,
    instructor: row.instructor,
    room: row.room,
    courseCode: row.course_code,
    section: row.section,
    days: row.days,
    startMinute: row.start_minute,
    endMinute: row.end_minute,
    color: row.color,
  };
}

export function rowToProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    inviteCode: row.invite_code,
  };
}
