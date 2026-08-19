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
  school: string | null;
  cosmetic: string | null;
  banner: string | null;
  effect: string | null;
  shiny_username: boolean;
}

/**
 * The column list for every `profiles` select, in one place. It used to be
 * written out at seven call sites — including twice inside the embedded
 * `requester:profiles!…()` / `addressee:profiles!…()` joins in useFriends,
 * which a grep for `from('profiles')` does not surface. Missing one when a
 * column is added fails silently: that screen just sees `undefined` for the
 * new field, with no error anywhere. Keep this next to ProfileRow — they are
 * the same fact stated twice, and they have to change together.
 */
export const PROFILE_COLUMNS =
  'id, username, display_name, avatar_url, invite_code, school, cosmetic, banner, effect, shiny_username';

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
    school: row.school,
    cosmetic: row.cosmetic,
    banner: row.banner,
    effect: row.effect,
    shinyUsername: row.shiny_username,
  };
}
