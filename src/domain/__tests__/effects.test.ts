import { describe, expect, it } from 'vitest';
import {
  EFFECTS,
  EFFECT_BAND_PX,
  EFFECT_ID_PATTERN,
  EFFECT_SHAPES,
  effectById,
  effectForHue,
  effectHueOf,
  effectIdFor,
  effectShapeOf,
} from '../effects';
import { COSMETICS, cosmeticForHue } from '../cosmetics';

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

  it('has a name, a known shape and a well-formed colour', () => {
    for (const effect of EFFECTS) {
      expect(effect.name.length, effect.id).toBeGreaterThan(0);
      expect(EFFECT_SHAPES, effect.id).toContain(effect.shape);
      expect(effect.colour, effect.id).toMatch(HEX);
    }
  });

  /**
   * 3:1 rather than 4.5:1 on purpose. These marks are decorative and carry no
   * information, so the WCAG bar that applies is the non-text one (1.4.11).
   * What this catches is a preset that is simply invisible on the card it
   * lands on — pale blue rain on the `sky` background, say.
   */
  it('keeps every mark visible on every card it can land on', () => {
    for (const effect of EFFECTS) {
      for (const background of CARD_BACKGROUNDS) {
        expect(
          contrastRatio(effect.colour, background),
          `${effect.id} on ${background}`
        ).toBeGreaterThanOrEqual(3);
      }
    }
  });

  /**
   * One colour per shape. Two rain presets a shade apart are not two products;
   * they are one product and a support question — which is exactly the note
   * that killed the second rain and the second bubble during design.
   */
  it('ships one preset per shape', () => {
    const shapes = EFFECTS.map((e) => e.shape);
    expect(new Set(shapes).size).toBe(shapes.length);
  });

  /**
   * The band is a fixed-height box in normal flow that clips its contents, and
   * the username sits below it — never underneath it in z-order. That geometry
   * is why no test here pairs a mark against the card's text. The slime this
   * slot used to hold drew green behind brown at 2.4:1 and would have failed AA
   * the moment the band became an overlay, so the assertion exists to make the
   * coupling visible to whoever changes it.
   *
   * The travelling keyframes in index.css are tuned to reach opacity 0 at this
   * edge. Change the number and `effect-rain` / `effect-bubble` must move too,
   * or marks get sliced in half at full opacity instead of fading out.
   */
  it('reserves a band for the marks to live in', () => {
    expect(EFFECT_BAND_PX).toBeGreaterThan(0);
  });
});

/**
 * Students pick a hue freely, so all 360 have to clear the visibility bar on
 * every card they can land on — including a card whose own colour the student
 * also chose. That last combination is the one a preset table could never have
 * covered, because both halves are now free.
 */
describe('effectForHue', () => {
  const HUES = Array.from({ length: 360 }, (_, i) => i);

  it('produces a storable id and a well-formed colour for every hue', () => {
    for (const shape of EFFECT_SHAPES) {
      for (const hue of HUES) {
        const effect = effectForHue(shape, hue);
        expect(effect.id, `${shape} ${hue}`).toMatch(EFFECT_ID_PATTERN);
        expect(effect.colour, `${shape} ${hue}`).toMatch(HEX);
        expect(effect.shape, `${shape} ${hue}`).toBe(shape);
      }
    }
  });

  it('keeps every hue visible on every card, including hue-built ones', () => {
    const backgrounds = [...CARD_BACKGROUNDS, ...HUES.map((h) => cosmeticForHue(h).background)];
    for (const hue of HUES) {
      const { colour } = effectForHue('rain', hue);
      for (const background of backgrounds) {
        expect(
          contrastRatio(colour, background),
          `hue ${hue} on ${background}`
        ).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('round-trips shape and hue through the id', () => {
    for (const shape of EFFECT_SHAPES) {
      for (const hue of HUES) {
        const id = effectIdFor(shape, hue);
        expect(effectById(id), id).toEqual(effectForHue(shape, hue));
        expect(effectShapeOf(id), id).toBe(shape);
        expect(effectHueOf(id), id).toBe(hue);
      }
    }
  });

  // The hand-picked presets name no hue, so callers have to cope with a shape
  // that has no slider position to restore.
  it('reports no hue for a hand-picked preset', () => {
    expect(effectShapeOf('stardust')).toBe('sparkles');
    expect(effectHueOf('stardust')).toBeNull();
  });
});

describe('effectById', () => {
  it('finds an effect by id', () => {
    expect(effectById('stardust')?.shape).toBe('sparkles');
  });

  // 'slime-green' and friends were shipped and then retired. A profile still
  // storing one has to fall back to no effect, not throw on someone else's
  // Friends page.
  it.each([
    null,
    undefined,
    '',
    'slime-green',
    'blank',
    'an-effect-we-dropped',
    'rain-360',
    'rain-007',
    'rain-',
    'mist-210',
  ])('returns null for %p', (id) => {
    expect(effectById(id)).toBeNull();
  });
});
