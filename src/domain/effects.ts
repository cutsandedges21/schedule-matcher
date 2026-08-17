// src/domain/effects.ts

export interface Effect {
  /** Stored verbatim in profiles.effect. Must match EFFECT_ID_PATTERN. */
  id: string;
  name: string;
  /** The drips, the lip they hang from, and the droplets that fall. */
  drip: string;
}

/**
 * The same pattern the `profiles_effect_format` check constraint enforces
 * (migration 0008). A test asserts every id here satisfies it, so the code and
 * the schema cannot drift into a state where saving an effect 400s.
 */
export const EFFECT_ID_PATTERN = /^[a-z0-9-]{2,32}$/;

/**
 * Height of the drip band, in pixels.
 *
 * This is the reason there is no contrast rule anywhere in this file pairing a
 * drip against the card's text. The band is a fixed-height box in normal flow
 * that clips its own contents, and the username sits *below* it — not
 * underneath it in z-order. A drip therefore cannot pass behind the text, so
 * there is no pairing to measure. Get this wrong — position the band
 * absolutely over the card — and `#6B5320` brown on `#2B9540` green is 2.4:1,
 * well under the 4.5:1 every other surface here holds to.
 */
export const DRIP_BAND_PX = 34;

/**
 * A curated list, for the same reasons as the colour presets: they can be
 * checked in CI, they keep the app looking like one app, and a new one each
 * term keeps the Pass feeling alive after purchase.
 *
 * Every `drip` clears 3:1 against white and against every cosmetic background
 * in `cosmetics.ts` — the WCAG bar for a non-text graphic. Slime is decorative
 * and carries no information, so 3:1 rather than 4.5:1 is the right bar, but
 * something has to stop a preset that is invisible on the card it lands on.
 *
 * Note what is deliberately *not* constrained: how a drip looks against a
 * banner. The two are independent slots and mismatching them is allowed, so a
 * student who wants green slime under a red strip gets green slime under a red
 * strip.
 */
export const EFFECTS: readonly Effect[] = [
  { id: 'slime-green', name: 'Slime', drip: '#2B9540' },
  { id: 'slime-void', name: 'Void', drip: '#8B2FD6' },
  { id: 'slime-magma', name: 'Magma', drip: '#D2540A' },
  { id: 'slime-tide', name: 'Tide', drip: '#0E7FBF' },
];

const BY_ID = new Map(EFFECTS.map((effect) => [effect.id, effect]));

/**
 * Null for "no effect", and null too for an id we no longer ship. Callers
 * render the plain card for both. Never throws: a retired id must not
 * white-screen the Friends page for everyone who is friends with that student.
 */
export function effectById(id: string | null | undefined): Effect | null {
  return (id ? BY_ID.get(id) : undefined) ?? null;
}
