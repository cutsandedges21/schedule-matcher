import { describe, expect, it } from 'vitest';
import {
  HUE_STEPS,
  contrastRatio,
  hslToHex,
  hueAtLuminance,
  normaliseHue,
  parseHueId,
  relativeLuminance,
} from '../hue';

const HEX = /^#[0-9A-F]{6}$/;

describe('hslToHex', () => {
  it.each([
    [0, 1, 0.5, '#FF0000'],
    [120, 1, 0.5, '#00FF00'],
    [240, 1, 0.5, '#0000FF'],
    [0, 0, 1, '#FFFFFF'],
    [0, 0, 0, '#000000'],
  ])('maps h=%p s=%p l=%p', (h, s, l, expected) => {
    expect(hslToHex(h, s, l)).toBe(expected);
  });

  it('wraps hues outside 0..359', () => {
    expect(hslToHex(360, 1, 0.5)).toBe(hslToHex(0, 1, 0.5));
    expect(hslToHex(-120, 1, 0.5)).toBe(hslToHex(240, 1, 0.5));
  });
});

describe('relativeLuminance', () => {
  it('puts white at 1 and black at 0', () => {
    expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1, 5);
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 5);
  });

  it('gives white on black the maximum 21:1', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 1);
  });
});

describe('hueAtLuminance', () => {
  /**
   * The guarantee the whole free-colour feature rests on. If the bisection
   * stopped converging — too few iterations, or a non-monotonic colour space —
   * every derived colour would drift off its contrast target silently, and
   * nothing else in the suite would notice.
   */
  /**
   * The tolerance is quantisation, not slack. The search converges on a
   * continuous lightness but the result is an 8-bit hex, and near the top of
   * the range a single step is worth ~0.008 luminance — so nothing can land
   * closer than that however many iterations run. Every contrast bar in the
   * suite is measured on the quantised colour, so this bound is the honest one.
   */
  const QUANTISATION = 0.01;

  it.each([0.04, 0.2, 0.5, 0.82, 0.95])('hits luminance %p for every hue', (target) => {
    for (let hue = 0; hue < 360; hue += 1) {
      const hex = hueAtLuminance(hue, 0.8, target);
      expect(hex, `hue ${hue}`).toMatch(HEX);
      expect(Math.abs(relativeLuminance(hex) - target), `hue ${hue} → ${hex}`).toBeLessThan(
        QUANTISATION
      );
    }
  });

  // Yellow and blue need very different lightnesses to be equally bright.
  // Asking for a luminance rather than a lightness is what makes every hue
  // behave the same, so the two must land together and look different.
  it('lands yellow and blue on the same luminance at different lightnesses', () => {
    const yellow = hueAtLuminance(60, 0.8, 0.2);
    const blue = hueAtLuminance(240, 0.8, 0.2);
    expect(relativeLuminance(yellow)).toBeCloseTo(relativeLuminance(blue), 2);
    expect(yellow).not.toBe(blue);
  });
});

describe('normaliseHue', () => {
  it.each([
    [0, 0],
    [359, 359],
    [360, 0],
    [-15, 345],
    [720.4, 0],
  ])('normalises %p to %p', (input, expected) => {
    expect(normaliseHue(input)).toBe(expected);
  });

  it.each([NaN, Infinity, -Infinity])('falls back to 0 for %p', (input) => {
    expect(normaliseHue(input)).toBe(0);
  });
});

describe('parseHueId', () => {
  it.each([
    ['hue-0', 0],
    ['hue-210', 210],
    ['hue-359', 359],
  ])('reads %s', (id, expected) => {
    expect(parseHueId(id, 'hue-')).toBe(expected);
  });

  /**
   * These all satisfy the `^[a-z0-9-]{2,32}$` check constraint, so the database
   * will happily store every one of them. Strictness here is what stops a
   * hand-edited or stale row rendering an arbitrary colour.
   */
  it.each(['hue-360', 'hue-999', 'hue-007', 'hue--1', 'hue-', 'hue-12a', 'hue-1-2', 'sand'])(
    'rejects %s',
    (id) => {
      expect(parseHueId(id, 'hue-')).toBeNull();
    }
  );

  it('does not confuse one prefix for another', () => {
    expect(parseHueId('rain-210', 'bubbles-')).toBeNull();
    expect(parseHueId('rain-210', 'rain-')).toBe(210);
  });
});

describe('HUE_STEPS', () => {
  it('walks the wheel evenly and stays in range', () => {
    expect(HUE_STEPS).toHaveLength(24);
    expect(HUE_STEPS[0]).toBe(0);
    expect(Math.max(...HUE_STEPS)).toBeLessThan(360);
    expect(new Set(HUE_STEPS).size).toBe(HUE_STEPS.length);
  });
});
