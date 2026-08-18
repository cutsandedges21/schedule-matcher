// src/domain/terms.ts

/**
 * Which academic term a date falls in.
 *
 * Two things need this. The Phase 0 analytics in `supabase/analytics/phase0.sql`
 * bucket extractions and compares per term, and the extraction quota planned
 * for January (3/term free, 15/term on the Pass — see the monetization spec)
 * is meaningless without a definition of "term" that the client and the
 * database agree on.
 *
 * **Local time, deliberately.** Every reader is a student in the same timezone
 * as their college, so a term boundary should tick over at midnight where they
 * are, not at midnight UTC — which in Montreal is 7 or 8pm the previous
 * evening. Reading UTC months would put the evening of August 31st in the wrong
 * term for every user. The SQL side does the same with
 * `at time zone 'America/Toronto'`.
 */

export type TermSeason = 'fall' | 'winter' | 'summer';

export interface Term {
  /** e.g. `fall-2026`. Stable, lowercase, safe in a URL or a text column. */
  id: string;
  season: TermSeason;
  /** The calendar year the term *starts* in. Winter 2027 starts Jan 2027. */
  year: number;
  /** e.g. `Fall 2026`. */
  label: string;
  /** Inclusive. Local midnight. */
  startsAt: Date;
  /** Exclusive — exactly the next term's `startsAt`, no gap, no overlap. */
  endsAt: Date;
}

/**
 * Where each season starts, as a zero-based month, in ascending order.
 *
 * Winter Jan–May, summer Jun–Jul, fall Aug–Dec. The CEGEP calendar only really
 * has two terms; summer exists here so that *every* date maps somewhere and
 * `termForDate` never has to return null. A June extraction is a real event and
 * dropping it on the floor would quietly under-report the total.
 *
 * Duplicated in `supabase/analytics/phase0.sql`, which cannot import it.
 * `terms.test.ts` pins these numbers so an edit here fails loudly rather than
 * letting the two definitions drift.
 */
export const TERM_BOUNDARIES: readonly { season: TermSeason; startMonth: number }[] = [
  { season: 'winter', startMonth: 0 },
  { season: 'summer', startMonth: 5 },
  { season: 'fall', startMonth: 7 },
];

const LABELS: Record<TermSeason, string> = {
  fall: 'Fall',
  winter: 'Winter',
  summer: 'Summer',
};

export function termForDate(date: Date): Term {
  const year = date.getFullYear();
  const month = date.getMonth();

  // Last boundary at or before this month. The list is ascending and starts at
  // month 0, so there is always one.
  let index = 0;
  for (let i = TERM_BOUNDARIES.length - 1; i >= 0; i -= 1) {
    if (month >= TERM_BOUNDARIES[i].startMonth) {
      index = i;
      break;
    }
  }

  const { season, startMonth } = TERM_BOUNDARIES[index];
  const next = TERM_BOUNDARIES[index + 1];

  return {
    id: `${season}-${year}`,
    season,
    year,
    label: `${LABELS[season]} ${year}`,
    startsAt: new Date(year, startMonth, 1),
    // Past the last boundary of the year, the term ends at next January — which
    // is why December stays in fall instead of leaking into the coming winter.
    endsAt: next ? new Date(year, next.startMonth, 1) : new Date(year + 1, 0, 1),
  };
}

export function termId(date: Date): string {
  return termForDate(date).id;
}

/** The term containing "right now". */
export function currentTerm(): Term {
  return termForDate(new Date());
}
