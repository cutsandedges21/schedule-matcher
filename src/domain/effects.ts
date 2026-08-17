// src/domain/effects.ts

export interface Effect {
  /** Stored verbatim in profiles.effect. Must match EFFECT_ID_PATTERN. */
  id: string;
  name: string;
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
 * Whatever eventually goes in this band, it has to stay a fixed-height box in
 * **normal flow** that clips its own contents. The username renders after the
 * band and therefore below it, which is the only reason nothing in this file
 * needs a contrast rule against the card's text. Make the band absolute and
 * that stops being true — the previous slime effect drew `#2B9540` green
 * behind `#6B5320` brown at 2.4:1, well under the 4.5:1 every other surface in
 * the cosmetics system holds to. It is also what keeps an effect from spilling
 * onto the friend in the row below.
 */
export const EFFECT_BAND_PX = 34;

/**
 * The effect slot, reserved and empty.
 *
 * `blank` renders nothing — it claims the band and draws no content. It is a
 * placeholder for the first real effect rather than something a student would
 * want, so it costs a row of vertical space and gives nothing back. Replace it
 * rather than adding alongside it.
 *
 * Anything added here that draws colour needs the treatment the other preset
 * tables get: a visibility floor against every card background it can land on
 * (`cosmetics.ts` backgrounds plus plain white), asserted in effects.test.ts.
 * Decorative marks are held to the WCAG non-text bar of 3:1, not 4.5:1.
 */
export const EFFECTS: readonly Effect[] = [{ id: 'blank', name: 'Blank' }];

const BY_ID = new Map(EFFECTS.map((effect) => [effect.id, effect]));

/**
 * Null for "no effect", and null too for an id we no longer ship — which now
 * includes every profile still storing one of the retired slime ids. Callers
 * render the card without a band for both. Never throws: a retired id must not
 * white-screen the Friends page for everyone who is friends with that student.
 */
export function effectById(id: string | null | undefined): Effect | null {
  return (id ? BY_ID.get(id) : undefined) ?? null;
}
