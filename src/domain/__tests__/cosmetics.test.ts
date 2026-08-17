import { describe, expect, it } from 'vitest';
import { COSMETICS, COSMETIC_ID_PATTERN, cosmeticById } from '../cosmetics';
import { SCHOOLS } from '../schools';

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

/**
 * The floor the chip rule below works out to for the schools we ship today
 * (the binding one is John Abbott's #246337, the lightest `accentStrong`).
 * Asserted separately because "this background is too dark" is a far more
 * useful failure than seven pairwise contrast failures, and because it is a
 * number a future author can eyeball a candidate hex against without running
 * anything.
 */
const MIN_BACKGROUND_LUMINANCE = 0.61;

describe('COSMETICS', () => {
  it('ships a handful of presets, not a colour picker', () => {
    expect(COSMETICS.length).toBeGreaterThanOrEqual(6);
    expect(COSMETICS.length).toBeLessThanOrEqual(10);
  });

  it('has unique ids', () => {
    const ids = COSMETICS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // The same pattern as the profiles_cosmetic_format check constraint in
  // migration 0007. If these drift, the picker offers a cosmetic the database
  // refuses to store and the tap fails with a constraint violation.
  it('has ids the database will accept', () => {
    for (const cosmetic of COSMETICS) {
      expect(cosmetic.id, cosmetic.id).toMatch(COSMETIC_ID_PATTERN);
    }
  });

  it('has three well-formed hex colours each', () => {
    for (const cosmetic of COSMETICS) {
      expect(cosmetic.background, cosmetic.id).toMatch(HEX);
      expect(cosmetic.border, cosmetic.id).toMatch(HEX);
      expect(cosmetic.fg, cosmetic.id).toMatch(HEX);
      expect(cosmetic.name.length, cosmetic.id).toBeGreaterThan(0);
    }
  });

  // The test that catches a pretty-but-illegible preset before it ships: a
  // background that looks fine as a swatch in Settings but renders a friend's
  // username unreadable on their card.
  it('meets WCAG AA for the username drawn on the background', () => {
    for (const cosmetic of COSMETICS) {
      expect(contrastRatio(cosmetic.fg, cosmetic.background), cosmetic.id).toBeGreaterThanOrEqual(
        4.5
      );
    }
  });

  /**
   * A friend card carries a SchoolChip as well as the cosmetic, so the two
   * have to survive each other.
   *
   * The rule is that the *card* must carry the chip's text at AA — every
   * school's `accentStrong` clears 4.5:1 against every cosmetic `background` —
   * rather than the weaker "the chip's own tint must stand out from the card".
   * The weaker rule is unusable: `accentSoft` and these backgrounds are both
   * near-white tints sitting within a shade of each other (all seven chips
   * measure ~1.0:1 against every background here), so the chip's pill shape
   * genuinely does vanish into a themed card. Assuming the chip tint
   * contributes nothing and asking the card itself to carry the dark chip text
   * is the conservative reading, and it is the one that cannot be gamed by
   * nudging a tint.
   *
   * Its practical effect is a luminance floor on backgrounds, which is why a
   * dark cosmetic is out even though dark-card/light-chip would measure fine —
   * it would swallow the chip's tint and take the rest of the card's slate
   * chrome with it.
   */
  it('keeps every school chip legible on every cosmetic background', () => {
    for (const cosmetic of COSMETICS) {
      expect(luminance(cosmetic.background), cosmetic.id).toBeGreaterThanOrEqual(
        MIN_BACKGROUND_LUMINANCE
      );

      for (const school of SCHOOLS) {
        expect(
          contrastRatio(school.accentStrong, cosmetic.background),
          `${school.id} chip on ${cosmetic.id}`
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});

describe('cosmeticById', () => {
  it('finds a cosmetic by id', () => {
    expect(cosmeticById('mint')?.name).toBe('Mint');
  });

  // "No cosmetic" and "a preset we have since removed from the code" both have
  // to render the plain card, not throw on someone else's Friends page.
  it.each([null, undefined, '', 'a-cosmetic-we-dropped'])('returns null for %p', (id) => {
    expect(cosmeticById(id)).toBeNull();
  });
});
