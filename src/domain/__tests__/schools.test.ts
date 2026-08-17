import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SCHOOL_ID,
  SCHOOLS,
  SCHOOL_ID_PATTERN,
  schoolById,
  themeVariables,
} from '../schools';

const HEX = /^#[0-9A-F]{6}$/;

/** WCAG 2.1 relative luminance. */
function luminance(hex: string): number {
  const value = parseInt(hex.slice(1), 16);
  const channel = (byte: number) => {
    const s = byte / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const r = channel((value >> 16) & 0xff);
  const g = channel((value >> 8) & 0xff);
  const b = channel(value & 0xff);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('SCHOOLS', () => {
  it('ships a default', () => {
    expect(SCHOOLS.some((s) => s.id === DEFAULT_SCHOOL_ID)).toBe(true);
  });

  it('has unique ids', () => {
    const ids = SCHOOLS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // The same pattern as the profiles_school_format check constraint in
  // migration 0006. If these drift, the picker offers a school the database
  // refuses to store and the tap fails with a constraint violation.
  it('has ids the database will accept', () => {
    for (const school of SCHOOLS) {
      expect(school.id, school.id).toMatch(SCHOOL_ID_PATTERN);
    }
  });

  it('has four well-formed hex colours each', () => {
    for (const school of SCHOOLS) {
      expect(school.accent, school.id).toMatch(HEX);
      expect(school.accentStrong, school.id).toMatch(HEX);
      expect(school.accentSoft, school.id).toMatch(HEX);
      expect(school.accentFg, school.id).toMatch(HEX);
      expect(school.name.length, school.id).toBeGreaterThan(0);
    }
  });

  // This is the test that catches a bad hex before it ships: a school colour
  // that looks fine in the picker but renders unreadable button text.
  it('meets WCAG AA for text drawn on the accent', () => {
    for (const school of SCHOOLS) {
      expect(contrastRatio(school.accentFg, school.accent), school.id).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('meets WCAG AA for a school chip (accentStrong on accentSoft)', () => {
    for (const school of SCHOOLS) {
      expect(
        contrastRatio(school.accentStrong, school.accentSoft),
        school.id
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('schoolById', () => {
  it('finds a school by id', () => {
    expect(schoolById('vanier').name).toBe('Vanier College');
  });

  // A profile storing a school we have since removed from the code must
  // degrade to the default theme, not throw on render.
  it.each([null, undefined, '', 'a-school-we-dropped'])('falls back to default for %p', (id) => {
    expect(schoolById(id).id).toBe(DEFAULT_SCHOOL_ID);
  });
});

describe('themeVariables', () => {
  it('maps a school onto the four accent custom properties', () => {
    expect(themeVariables(schoolById('dawson'))).toEqual({
      '--accent': '#005EB8',
      '--accent-strong': '#004A93',
      '--accent-soft': '#E8F1FB',
      '--accent-fg': '#FFFFFF',
    });
  });
});
