import { describe, expect, it } from 'vitest';
import { TERM_BOUNDARIES, termForDate, termId } from '../terms';

/**
 * Every date is built with the local-time constructor `new Date(y, m, d)`
 * rather than an ISO string, because `termForDate` reads local getters on
 * purpose — see the header of terms.ts. An ISO literal would pin these
 * assertions to UTC and make the suite pass or fail depending on the machine's
 * timezone, which is exactly the bug the local getters exist to avoid.
 */
describe('termForDate', () => {
  it.each([
    ['fall', new Date(2026, 7, 1), 'fall-2026'], // Aug 1, first day of fall
    ['fall', new Date(2026, 9, 15), 'fall-2026'],
    ['fall', new Date(2026, 11, 31), 'fall-2026'], // Dec 31, last day of fall
    ['winter', new Date(2027, 0, 1), 'winter-2027'], // Jan 1, first day of winter
    ['winter', new Date(2027, 3, 20), 'winter-2027'],
    ['winter', new Date(2027, 4, 31), 'winter-2027'], // May 31, last day of winter
    ['summer', new Date(2027, 5, 1), 'summer-2027'], // Jun 1, first day of summer
    ['summer', new Date(2027, 6, 31), 'summer-2027'], // Jul 31, last day of summer
  ])('puts a %s date in %s', (_season, date, expected) => {
    expect(termId(date)).toBe(expected);
  });

  /**
   * The rollover that a naive `getFullYear()` gets wrong. Fall 2026 runs past
   * New Year in the sense that it is *followed* by winter 2027 — the winter
   * term carries the new year, and December must not leak into it.
   */
  it('does not let December fall into the next winter', () => {
    expect(termId(new Date(2026, 11, 31))).toBe('fall-2026');
    expect(termId(new Date(2027, 0, 1))).toBe('winter-2027');
  });

  it('numbers each season by the calendar year it starts in', () => {
    expect(termForDate(new Date(2027, 0, 15)).year).toBe(2027);
    expect(termForDate(new Date(2026, 8, 15)).year).toBe(2026);
  });

  it('covers every month of the year', () => {
    const seen = new Set<string>();
    for (let month = 0; month < 12; month += 1) {
      seen.add(termForDate(new Date(2026, month, 15)).season);
    }
    expect(seen).toEqual(new Set(['fall', 'winter', 'summer']));
  });

  it('produces a human label', () => {
    expect(termForDate(new Date(2026, 8, 1)).label).toBe('Fall 2026');
    expect(termForDate(new Date(2027, 0, 1)).label).toBe('Winter 2027');
  });

  /**
   * `startsAt` is inclusive and `endsAt` exclusive, so a term's end is exactly
   * the next term's start with no gap and no overlapping second. Anything else
   * makes an extraction quota either double-count or silently drop a request
   * on a boundary day.
   */
  it('has half-open bounds that abut with no gap', () => {
    const fall = termForDate(new Date(2026, 8, 1));
    const winter = termForDate(new Date(2027, 1, 1));
    expect(fall.endsAt.getTime()).toBe(winter.startsAt.getTime());
    expect(fall.startsAt.getTime()).toBeLessThan(fall.endsAt.getTime());
  });

  it('places its own bounds inside the term they describe', () => {
    for (const month of [0, 3, 6, 9]) {
      const term = termForDate(new Date(2026, month, 15));
      expect(termId(term.startsAt)).toBe(term.id);
      // One millisecond before the exclusive end is still the same term.
      expect(termId(new Date(term.endsAt.getTime() - 1))).toBe(term.id);
    }
  });

  /**
   * The month table is duplicated in supabase/analytics/phase0.sql, which
   * cannot import it. If a boundary moves here it has to move there too, so
   * pin the numbers rather than letting a silent edit drift the two apart.
   */
  it('pins the boundary months the SQL duplicates', () => {
    expect(TERM_BOUNDARIES).toEqual([
      { season: 'winter', startMonth: 0 },
      { season: 'summer', startMonth: 5 },
      { season: 'fall', startMonth: 7 },
    ]);
  });
});
