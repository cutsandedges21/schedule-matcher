// src/domain/banners.ts

export interface Banner {
  /** Stored verbatim in profiles.banner. Must match BANNER_ID_PATTERN. */
  id: string;
  name: string;
  /**
   * Gradient stops, drawn left to right and animated sideways. First and last
   * should match, or the loop visibly jumps when the animation wraps.
   */
  stops: readonly string[];
}

/**
 * The same pattern the `profiles_banner_format` check constraint enforces
 * (migration 0008). A test asserts every id here satisfies it, so the code and
 * the schema cannot drift into a state where saving a banner 400s.
 */
export const BANNER_ID_PATTERN = /^[a-z0-9-]{2,32}$/;

/** Height of the strip, in pixels. */
export const STRIP_HEIGHT_PX = 36;

/**
 * A curated list, for the same reasons as the colour presets.
 *
 * No contrast bar applies to these. The strip is a solid band with nothing
 * drawn on top of it — the username, the display name and the SchoolChip all
 * sit below it in normal flow — so there is no foreground/background pairing
 * to measure. That is a property of the layout, not luck: putting text on the
 * strip would introduce one, and would need the same 4.5:1 treatment the rest
 * of the cosmetics system gets.
 *
 * Nor is a banner constrained against the effect that hangs off it. They are
 * independent slots and mismatching is allowed on purpose.
 */
export const BANNERS: readonly Banner[] = [
  {
    id: 'ember',
    name: 'Ember',
    stops: ['#C8102E', '#F2994A', '#C8102E', '#7A1020', '#C8102E'],
  },
  {
    id: 'forest',
    name: 'Forest',
    stops: ['#1F7A33', '#5FD973', '#2E9E42', '#166B2A', '#1F7A33'],
  },
  {
    id: 'nebula',
    name: 'Nebula',
    stops: ['#5B1D8E', '#B87BEA', '#7A2DB5', '#45156B', '#5B1D8E'],
  },
  {
    id: 'lagoon',
    name: 'Lagoon',
    stops: ['#0369A1', '#7DD3FC', '#0284C7', '#075985', '#0369A1'],
  },
  {
    id: 'dusk',
    name: 'Dusk',
    stops: ['#312E81', '#F472B6', '#7C3AED', '#1E1B4B', '#312E81'],
  },
  {
    id: 'gold',
    name: 'Gold',
    stops: ['#92400E', '#FCD34D', '#D97706', '#78350F', '#92400E'],
  },
];

const BY_ID = new Map(BANNERS.map((banner) => [banner.id, banner]));

/**
 * Null for "no banner", and null too for an id we no longer ship. Callers
 * render the card without a strip for both. Never throws.
 */
export function bannerById(id: string | null | undefined): Banner | null {
  return (id ? BY_ID.get(id) : undefined) ?? null;
}

/** The `linear-gradient` a banner's strip is painted with. */
export function bannerGradient(banner: Banner): string {
  return `linear-gradient(100deg, ${banner.stops.join(', ')})`;
}
