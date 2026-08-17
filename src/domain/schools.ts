// src/domain/schools.ts

export interface School {
  /** Stored verbatim in profiles.school. Must match SCHOOL_ID_PATTERN. */
  id: string;
  name: string;
  /** Base accent: primary buttons, active nav tab, intro progress bar. */
  accent: string;
  /** Pressed state, and text colour when drawn on `accentSoft`. */
  accentStrong: string;
  /** Light tint, used as the background of a school chip. */
  accentSoft: string;
  /** Text and icons drawn on top of `accent`. */
  accentFg: string;
}

export const DEFAULT_SCHOOL_ID = 'default';

/**
 * The same pattern the `profiles_school_format` check constraint enforces
 * (migration 0006). A test asserts every id here satisfies it, so the code and
 * the schema cannot drift into a state where saving a school 400s.
 */
export const SCHOOL_ID_PATTERN = /^[a-z0-9-]{2,32}$/;

/**
 * Champlain's teal and LaSalle's orange are deliberately darker than the
 * schools' literal brand colours. #00857D measures 4.51:1 against white —
 * passing WCAG AA only by a rounding error — and #E35205 measures 3.84:1 and
 * genuinely fails. Brand fidelity loses to legibility on a phone outdoors.
 * `schools.test.ts` keeps every pair above 4.5:1.
 */
export const SCHOOLS: readonly School[] = [
  {
    id: DEFAULT_SCHOOL_ID,
    name: 'No school',
    // Exactly today's chrome: bg-slate-900 with active:bg-slate-700.
    accent: '#0F172A',
    accentStrong: '#334155',
    accentSoft: '#F1F5F9',
    accentFg: '#FFFFFF',
  },
  {
    id: 'vanier',
    name: 'Vanier College',
    accent: '#C8102E',
    accentStrong: '#A00D24',
    accentSoft: '#FDECEF',
    accentFg: '#FFFFFF',
  },
  {
    id: 'dawson',
    name: 'Dawson College',
    accent: '#005EB8',
    accentStrong: '#004A93',
    accentSoft: '#E8F1FB',
    accentFg: '#FFFFFF',
  },
  {
    id: 'john-abbott',
    name: 'John Abbott College',
    accent: '#2E7D46',
    accentStrong: '#246337',
    accentSoft: '#E9F4ED',
    accentFg: '#FFFFFF',
  },
  {
    id: 'marianopolis',
    name: 'Marianopolis College',
    accent: '#5B2D8E',
    accentStrong: '#46226E',
    accentSoft: '#F0EAF7',
    accentFg: '#FFFFFF',
  },
  {
    id: 'champlain',
    name: 'Champlain College',
    accent: '#006B65',
    accentStrong: '#00544F',
    accentSoft: '#E5F2F1',
    accentFg: '#FFFFFF',
  },
  {
    id: 'lasalle',
    name: 'LaSalle College',
    accent: '#B84204',
    accentStrong: '#953603',
    accentSoft: '#FCEDE6',
    accentFg: '#FFFFFF',
  },
];

const BY_ID = new Map(SCHOOLS.map((school) => [school.id, school]));

/**
 * Never throws and never returns undefined. An id we no longer ship — a school
 * dropped from this file while someone's profile still stores it — has to
 * degrade to the default theme, not white-screen the app for that student.
 */
export function schoolById(id: string | null | undefined): School {
  return (id ? BY_ID.get(id) : undefined) ?? BY_ID.get(DEFAULT_SCHOOL_ID)!;
}

/** The CSS custom properties every `accent` Tailwind class resolves against. */
export function themeVariables(school: School): Record<string, string> {
  return {
    '--accent': school.accent,
    '--accent-strong': school.accentStrong,
    '--accent-soft': school.accentSoft,
    '--accent-fg': school.accentFg,
  };
}
