import { describe, expect, it } from 'vitest';
import { DRIP_BAND_PX, EFFECTS, EFFECT_ID_PATTERN, effectById } from '../effects';
import { COSMETICS } from '../cosmetics';

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

/** Every card background an effect can land on: plain white, or a cosmetic. */
const CARD_BACKGROUNDS = ['#FFFFFF', ...COSMETICS.map((c) => c.background)];

describe('EFFECTS', () => {
  it('has unique ids', () => {
    const ids = EFFECTS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // The same pattern as the profiles_effect_format check constraint in
  // migration 0008. If these drift, the picker offers an effect the database
  // refuses to store and the tap fails with a constraint violation.
  it('has ids the database will accept', () => {
    for (const effect of EFFECTS) {
      expect(effect.id, effect.id).toMatch(EFFECT_ID_PATTERN);
    }
  });

  it('has a well-formed drip colour and a name', () => {
    for (const effect of EFFECTS) {
      expect(effect.drip, effect.id).toMatch(HEX);
      expect(effect.name.length, effect.id).toBeGreaterThan(0);
    }
  });

  /**
   * 3:1 rather than 4.5:1 on purpose. Slime is decorative and carries no
   * information, so the WCAG bar that applies is the non-text one (1.4.11).
   * What this catches is a preset that is simply invisible on the card it
   * lands on — a pale green drip on the `mint` background, say.
   */
  it('keeps every drip visible on every card it can land on', () => {
    for (const effect of EFFECTS) {
      for (const background of CARD_BACKGROUNDS) {
        expect(
          contrastRatio(effect.drip, background),
          `${effect.id} drip on ${background}`
        ).toBeGreaterThanOrEqual(3);
      }
    }
  });

  /**
   * The band is a fixed-height box in normal flow that clips its contents, and
   * the username sits below it — never underneath it in z-order. That geometry
   * is the only reason no test here pairs a drip against the card's text. If
   * the band ever became absolutely positioned, drips would pass behind the
   * username at roughly 2.4:1 and this suite would still be green, so the
   * assertion exists to make the coupling visible to whoever changes it.
   */
  it('reserves a band for the drips to live in', () => {
    expect(DRIP_BAND_PX).toBeGreaterThan(0);
  });
});

describe('effectById', () => {
  it('finds an effect by id', () => {
    expect(effectById('slime-green')?.name).toBe('Slime');
  });

  it.each([null, undefined, '', 'an-effect-we-dropped'])('returns null for %p', (id) => {
    expect(effectById(id)).toBeNull();
  });
});
