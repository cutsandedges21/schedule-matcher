// src/domain/cosmetics.ts
import { hueAtLuminance, normaliseHue, parseHueId } from './hue';

export interface Cosmetic {
  /** Stored verbatim in profiles.cosmetic. Must match COSMETIC_ID_PATTERN. */
  id: string;
  name: string;
  /** Friend-card background. */
  background: string;
  /** Friend-card border. */
  border: string;
  /** Username and display name drawn on `background`. */
  fg: string;
}

/**
 * The same pattern the `profiles_cosmetic_format` check constraint enforces
 * (migration 0007). A test asserts every id here satisfies it, so the code and
 * the schema cannot drift into a state where saving a cosmetic 400s.
 */
export const COSMETIC_ID_PATTERN = /^[a-z0-9-]{2,32}$/;

/**
 * A curated list, not a colour picker. Presets can be contrast-tested in CI,
 * cannot be set to white-on-white, keep the app looking like one app rather
 * than a hundred, and let us drip-feed a new one each term.
 *
 * Every `background` is deliberately *light*. A friend card also carries a
 * SchoolChip — dark `accentStrong` text on a light `accentSoft` tint — and
 * those two tints sit within a shade of each other, so the chip's own
 * background effectively disappears into a themed card and the card ends up
 * carrying the chip's text itself. cosmetics.test.ts states that as the rule:
 * every school's `accentStrong` must clear 4.5:1 against every `background`
 * here, which in practice floors background luminance around 0.61. A dark
 * cosmetic would swallow the chip entirely.
 *
 * `border` is not held to a contrast bar — it is a hairline edge, not text or
 * a control — but it is picked a few shades down from `background` so a themed
 * card still reads as a card.
 */
export const COSMETICS: readonly Cosmetic[] = [
  {
    id: 'sunrise',
    name: 'Sunrise',
    background: '#FFF1E0',
    border: '#F2C48A',
    fg: '#7A4510',
  },
  {
    id: 'mint',
    name: 'Mint',
    background: '#E4F7EE',
    border: '#94D9BB',
    fg: '#0F5C3C',
  },
  {
    id: 'lavender',
    name: 'Lavender',
    background: '#F1ECFB',
    border: '#C0AAEC',
    fg: '#4B2E83',
  },
  {
    id: 'sky',
    name: 'Sky',
    background: '#E6F1FC',
    border: '#9FCBEE',
    fg: '#17456F',
  },
  {
    id: 'bubblegum',
    name: 'Bubblegum',
    background: '#FDEAF3',
    border: '#F2B2D0',
    fg: '#8A1D53',
  },
  {
    id: 'sand',
    name: 'Sand',
    background: '#F7F1E3',
    border: '#D9C49B',
    fg: '#6B5320',
  },
  {
    id: 'glacier',
    name: 'Glacier',
    background: '#ECF2F7',
    border: '#B5C6D6',
    fg: '#2C3E50',
  },
  {
    id: 'citrus',
    name: 'Citrus',
    background: '#FBF7DA',
    border: '#E2CF63',
    fg: '#63530A',
  },
];

const BY_ID = new Map(COSMETICS.map((cosmetic) => [cosmetic.id, cosmetic]));

/** Id prefix for a student-chosen hue, e.g. `hue-210`. */
export const COSMETIC_HUE_PREFIX = 'hue-';

export function cosmeticIdForHue(hue: number): string {
  return `${COSMETIC_HUE_PREFIX}${normaliseHue(hue)}`;
}

/**
 * A card colour built from any hue the student picks.
 *
 * The luminance targets, not the lightnesses, are the point — see hue.ts. They
 * are chosen so that for *every* hue the derived set clears the same bars the
 * hand-picked presets above are tested against:
 *
 *   background 0.82  comfortably over the ~0.61 floor the SchoolChip needs
 *   fg         0.055 lands at 8.2:1 on that background, well past AA
 *   border     0.50  no contrast bar, it is an edge; dark enough to read as one
 *
 * cosmetics.test.ts walks all 360 hues and asserts exactly that, so this is a
 * guarantee rather than a hope.
 */
export function cosmeticForHue(hue: number): Cosmetic {
  const normalised = normaliseHue(hue);
  return {
    id: cosmeticIdForHue(normalised),
    name: `Hue ${normalised}`,
    background: hueAtLuminance(normalised, 0.6, 0.82),
    border: hueAtLuminance(normalised, 0.55, 0.5),
    fg: hueAtLuminance(normalised, 0.7, 0.055),
  };
}

/**
 * Null for "no cosmetic", and null too for an id we no longer ship — a preset
 * retired from this file while someone's profile still stores it. Callers
 * render the plain card for both, which is the same thing every profile looked
 * like before 0007. Never throws: a stale id must not white-screen the Friends
 * page for everyone who is friends with that student.
 */
export function cosmeticById(id: string | null | undefined): Cosmetic | null {
  if (!id) return null;

  const preset = BY_ID.get(id);
  if (preset) return preset;

  const hue = parseHueId(id, COSMETIC_HUE_PREFIX);
  return hue === null ? null : cosmeticForHue(hue);
}
