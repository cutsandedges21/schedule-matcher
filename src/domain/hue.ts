// src/domain/hue.ts

/**
 * Free colour choice that cannot produce an illegible card.
 *
 * §5.1 of the monetization design argues against a free hex input, on the
 * grounds that "somebody will pick white-on-white" and drives straight through
 * the contrast guarantees the preset tables are tested for. That objection is
 * correct about hex inputs and wrong about colour choice in general: the part
 * students actually want to control is the **hue**, and hue is the one
 * component that has no bearing on contrast.
 *
 * So the student picks a hue, 0–359, and this module picks the lightness — by
 * searching for the lightness that lands on a target relative luminance. Every
 * derived colour therefore hits its contrast bar for *every* hue, by
 * construction rather than by a test catching a bad one afterwards. White on
 * white is not discouraged here; it is unreachable.
 */

/** HSL with s and l in 0..1, h in 0..359. */
export function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));

  let r = 0;
  let g = 0;
  let b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  const m = l - c / 2;
  const byte = (v: number) =>
    Math.round(Math.min(255, Math.max(0, (v + m) * 255)))
      .toString(16)
      .padStart(2, '0')
      .toUpperCase();

  return `#${byte(r)}${byte(g)}${byte(b)}`;
}

/** WCAG 2.1 relative luminance. */
export function relativeLuminance(hex: string): number {
  const value = parseInt(hex.slice(1), 16);
  const channel = (b: number) => {
    const s = b / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel((value >> 16) & 0xff) +
    0.7152 * channel((value >> 8) & 0xff) +
    0.0722 * channel(value & 0xff)
  );
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * The colour of `hue` at whatever lightness lands on `target` luminance.
 *
 * Relative luminance is monotonic in HSL lightness for a fixed hue and
 * saturation — L=0 is black and L=1 is white whatever else is set — so a
 * bisection always converges, and 24 iterations put it well inside a single
 * 8-bit step. This is the whole mechanism: yellow and blue need very different
 * lightnesses to be equally bright, and asking for a luminance rather than a
 * lightness is what makes every hue behave the same.
 */
export function hueAtLuminance(hue: number, saturation: number, target: number): string {
  let lo = 0;
  let hi = 1;
  let hex = hslToHex(hue, saturation, 0.5);

  for (let i = 0; i < 24; i += 1) {
    const mid = (lo + hi) / 2;
    hex = hslToHex(hue, saturation, mid);
    if (relativeLuminance(hex) < target) lo = mid;
    else hi = mid;
  }

  return hex;
}

/** Hues are stored as integers in a preset id, so keep them whole and in range. */
export function normaliseHue(hue: number): number {
  if (!Number.isFinite(hue)) return 0;
  return ((Math.round(hue) % 360) + 360) % 360;
}

/**
 * Hues offered in the pickers. A wheel rather than a continuum: 24 steps is
 * enough that no two neighbours look alike on a phone, and few enough to tap
 * accurately at 44px. A slider would offer 360 values a student cannot
 * distinguish and cannot hit twice.
 */
export const HUE_STEPS: readonly number[] = Array.from({ length: 24 }, (_, i) => i * 15);

/**
 * Reads the hue out of an id like `hue-210` or `rain-210`.
 *
 * Strict on purpose. These ids come back from the database, where the only
 * guarantee is the `^[a-z0-9-]{2,32}$` check constraint — which happily admits
 * `hue-999`, `hue-007` and `hue--1`. Anything not an exact canonical integer in
 * 0..359 returns null, and callers fall back to no cosmetic rather than
 * rendering something arbitrary.
 */
export function parseHueId(id: string, prefix: string): number | null {
  if (!id.startsWith(prefix)) return null;

  const rest = id.slice(prefix.length);
  if (!/^(0|[1-9][0-9]{0,2})$/.test(rest)) return null;

  const hue = Number(rest);
  return hue >= 0 && hue <= 359 ? hue : null;
}
