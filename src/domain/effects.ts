// src/domain/effects.ts
import { hueAtLuminance, normaliseHue, parseHueId } from './hue';

/**
 * How an effect's marks behave. The renderer switches on this
 * (features/friends/CardEffect.tsx); the keyframes live in index.css.
 */
export type EffectShape = 'rain' | 'bubbles' | 'sparkles';

export const EFFECT_SHAPES: readonly EffectShape[] = ['rain', 'bubbles', 'sparkles'];

export interface Effect {
  /** Stored verbatim in profiles.effect. Must match EFFECT_ID_PATTERN. */
  id: string;
  name: string;
  shape: EffectShape;
  /** The marks' colour. Must clear 3:1 on every card background. */
  colour: string;
}

/**
 * The same pattern the `profiles_effect_format` check constraint enforces
 * (migration 0008). A test asserts every id here satisfies it, so the code and
 * the schema cannot drift into a state where saving an effect 400s.
 */
export const EFFECT_ID_PATTERN = /^[a-z0-9-]{2,32}$/;

/**
 * Height of the effect band, in pixels.
 *
 * The band is a fixed-height box in **normal flow** that clips its own
 * contents, and the username renders after it and therefore below it. That is
 * the only reason nothing in this file needs a contrast rule against the
 * card's text: a mark cannot reach the username, so there is no pairing to
 * measure. Make the band absolute and that stops being true immediately — the
 * slime this slot used to hold drew `#2B9540` behind `#6B5320` at 2.4:1. It is
 * also what stops an effect spilling onto the friend in the row below.
 *
 * Every travelling animation is tuned to reach opacity 0 by the time it
 * reaches this edge, so marks die by fading rather than by being sliced. Change
 * this number and the `effect-rain` / `effect-bubble` keyframes have to move
 * with it.
 */
export const EFFECT_BAND_PX = 34;

/**
 * A curated list, for the same reasons as the other preset tables: they can be
 * checked in CI, they keep the app looking like one app, and a new one each
 * term keeps the Pass feeling alive after purchase.
 *
 * Shape and colour are baked into one preset rather than being two separate
 * picks. That keeps the picker a flat grid of swatches instead of two coupled
 * dropdowns, and it means no combination ships that nobody has looked at.
 * One colour per shape, deliberately: two rain presets a shade apart are not
 * two products, they are one product and a support question.
 *
 * Every `colour` clears 3:1 against white and against every cosmetic
 * background in `cosmetics.ts` — the WCAG bar for a non-text graphic. These
 * marks are decorative and carry no information, so 3:1 rather than 4.5:1 is
 * the right bar, but something has to stop a preset that is invisible on the
 * card it lands on. effects.test.ts enforces it.
 */
export const EFFECTS: readonly Effect[] = [
  { id: 'downpour', name: 'Downpour', shape: 'rain', colour: '#0E7FBF' },
  { id: 'swamp', name: 'Swamp', shape: 'bubbles', colour: '#2B9540' },
  { id: 'stardust', name: 'Stardust', shape: 'sparkles', colour: '#8B2FD6' },
];

const BY_ID = new Map(EFFECTS.map((effect) => [effect.id, effect]));

/**
 * A student-chosen effect is its shape and its hue together: `rain-210`.
 *
 * Both halves live in one column because they are one choice — an effect with
 * a shape and no colour does not render, and a colour with no shape is not an
 * effect. Splitting them across two columns would make every read a join of
 * two nullable fields with three meaningless combinations out of four.
 *
 * The shape name doubles as the id prefix, so the format stays inside the
 * `^[a-z0-9-]{2,32}$` the check constraint already enforces and no migration
 * is needed to allow custom colours.
 */
export function effectIdFor(shape: EffectShape, hue: number): string {
  return `${shape}-${normaliseHue(hue)}`;
}

/**
 * An effect built from any hue the student picks.
 *
 * The 0.20 luminance target is the load-bearing number: it puts every hue at
 * 3.4:1 or better against white, against all eight preset card backgrounds and
 * against a hue-built background — clear of the 3:1 WCAG bar for a non-text
 * graphic. effects.test.ts walks all 360 hues against all of them, so a hue
 * that would render invisible marks cannot be chosen rather than merely being
 * caught later.
 */
export function effectForHue(shape: EffectShape, hue: number): Effect {
  const h = normaliseHue(hue);
  return {
    id: effectIdFor(shape, h),
    name: `${shape[0].toUpperCase()}${shape.slice(1)} ${h}`,
    shape,
    colour: hueAtLuminance(h, 0.8, 0.2),
  };
}

/** The shape half of a stored effect id, or null if it names no shape. */
export function effectShapeOf(id: string | null | undefined): EffectShape | null {
  const effect = effectById(id);
  return effect ? effect.shape : null;
}

/** The hue half of a stored effect id. Null for the hand-picked presets. */
export function effectHueOf(id: string | null | undefined): number | null {
  if (!id) return null;
  for (const shape of EFFECT_SHAPES) {
    const hue = parseHueId(id, `${shape}-`);
    if (hue !== null) return hue;
  }
  return null;
}

/**
 * Null for "no effect", and null too for an id we no longer ship — which
 * includes every profile still storing one of the retired `slime-*` ids.
 * Callers render the card without a band for both. Never throws: a retired id
 * must not white-screen the Friends page for everyone who is friends with that
 * student.
 */
export function effectById(id: string | null | undefined): Effect | null {
  if (!id) return null;

  const preset = BY_ID.get(id);
  if (preset) return preset;

  for (const shape of EFFECT_SHAPES) {
    const hue = parseHueId(id, `${shape}-`);
    if (hue !== null) return effectForHue(shape, hue);
  }
  return null;
}
