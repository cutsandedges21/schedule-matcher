// src/domain/banners.ts
import { hueAtLuminance, normaliseHue, parseHueId } from './hue';

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

/** Id prefix for a student-chosen hue, e.g. `hue-210`. */
export const BANNER_HUE_PREFIX = 'hue-';

export function bannerIdForHue(hue: number): string {
  return `${BANNER_HUE_PREFIX}${normaliseHue(hue)}`;
}

/**
 * A strip built from any hue the student picks.
 *
 * No contrast bar applies — nothing is drawn on the strip — so these
 * luminances are chosen for looks: dark, bright, mid, darkest, dark. The
 * bright stop is what reads as a sheen travelling across it, and the first and
 * last are identical so the gradient wraps without a visible cut, which
 * banners.test.ts asserts for the hand-picked ones too.
 *
 * The neighbouring hue on the bright stop is a cheap trick that stops a
 * single-hue gradient looking flat: real light picks up a shift as it moves.
 */
export function bannerForHue(hue: number): Banner {
  const h = normaliseHue(hue);
  const dark = hueAtLuminance(h, 0.75, 0.09);
  return {
    id: bannerIdForHue(h),
    name: `Hue ${h}`,
    stops: [
      dark,
      hueAtLuminance(h + 18, 0.8, 0.52),
      hueAtLuminance(h, 0.8, 0.24),
      hueAtLuminance(h, 0.7, 0.04),
      dark,
    ],
  };
}

/**
 * Null for "no banner", and null too for an id we no longer ship. Callers
 * render the card without a strip for both. Never throws.
 */
export function bannerById(id: string | null | undefined): Banner | null {
  if (!id) return null;

  const preset = BY_ID.get(id);
  if (preset) return preset;

  const hue = parseHueId(id, BANNER_HUE_PREFIX);
  return hue === null ? null : bannerForHue(hue);
}

/** The `linear-gradient` a banner's strip is painted with. */
export function bannerGradient(banner: Banner): string {
  return `linear-gradient(100deg, ${banner.stops.join(', ')})`;
}
