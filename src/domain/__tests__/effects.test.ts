import { describe, expect, it } from 'vitest';
import { EFFECTS, EFFECT_BAND_PX, EFFECT_ID_PATTERN, effectById } from '../effects';

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

  it('names every effect', () => {
    for (const effect of EFFECTS) {
      expect(effect.name.length, effect.id).toBeGreaterThan(0);
    }
  });

  /**
   * The band is a fixed-height box in normal flow that clips its contents, and
   * the username sits below it — never underneath it in z-order. That geometry
   * is why no test in this file pairs an effect against the card's text. The
   * retired slime effect drew green behind brown at 2.4:1 and would have
   * failed AA the moment the band became an overlay, so the assertion exists
   * to make the coupling visible to whoever fills this slot next.
   */
  it('reserves a band for an effect to live in', () => {
    expect(EFFECT_BAND_PX).toBeGreaterThan(0);
  });
});

describe('effectById', () => {
  it('finds an effect by id', () => {
    expect(effectById('blank')?.name).toBe('Blank');
  });

  // 'slime-green' and friends were shipped and then retired. A profile still
  // storing one has to fall back to no effect, not throw on someone else's
  // Friends page.
  it.each([null, undefined, '', 'slime-green', 'an-effect-we-dropped'])(
    'returns null for %p',
    (id) => {
      expect(effectById(id)).toBeNull();
    }
  );
});
