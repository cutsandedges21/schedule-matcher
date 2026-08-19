import { describe, expect, it } from 'vitest';
import {
  ABOUT_BEATS,
  BEAT_DURATION,
  BEAT_TIMING,
  FIRST_POSITION,
  PHASE_ORDER,
  SEQUENCE_DURATION,
  advance,
  type BeatPosition,
} from '../slideshow';

describe('ABOUT_BEATS', () => {
  it('is the four beats the design calls for', () => {
    expect(ABOUT_BEATS).toHaveLength(4);
  });

  it('gives every beat text and at least one image', () => {
    for (const beat of ABOUT_BEATS) {
      expect(beat.text.trim().length).toBeGreaterThan(0);
      expect(beat.images.length).toBeGreaterThan(0);

      for (const image of beat.images) {
        expect(image.src).toMatch(/^\/about\/.+\.(svg|jpg|png)$/);
        // Alt text carries the beat for anyone who cannot see it, and the
        // opening beat's whole content is inside the screenshot.
        expect(image.alt.trim().length).toBeGreaterThan(0);
        // Declared so the browser reserves the right box and does not derive a
        // wrong aspect ratio for the portrait beats.
        expect(image.width).toBeGreaterThan(0);
        expect(image.height).toBeGreaterThan(0);
      }
    }
  });

  // A fan needs distinct files: the same src twice would collide on the React
  // key and render one image where two were intended.
  it('never repeats an image inside one beat', () => {
    for (const beat of ABOUT_BEATS) {
      const sources = beat.images.map((i) => i.src);
      expect(new Set(sources).size, beat.text).toBe(sources.length);
    }
  });
});

describe('advance', () => {
  // The intro has no skip button, so an intro that never reaches null is a
  // student permanently stuck on the first screen of the app.
  it('walks the whole sequence and terminates', () => {
    const visited: BeatPosition[] = [];
    let position: BeatPosition | null = FIRST_POSITION;

    // Bounded so a cyclic advance() fails the test instead of hanging it.
    for (let step = 0; position && step < 100; step += 1) {
      visited.push(position);
      position = advance(position);
    }

    expect(position).toBeNull();
    expect(visited).toHaveLength(ABOUT_BEATS.length * PHASE_ORDER.length);
    expect(visited).toEqual(
      ABOUT_BEATS.flatMap((_, index) => PHASE_ORDER.map((phase) => ({ index, phase })))
    );
  });

  it('ends after the last beat exits', () => {
    expect(advance({ index: ABOUT_BEATS.length - 1, phase: 'exit' })).toBeNull();
  });

  it('moves to the next beat after a non-final exit', () => {
    expect(advance({ index: 0, phase: 'exit' })).toEqual({ index: 1, phase: 'enter' });
  });
});

describe('timing', () => {
  it('sums the phases into one beat', () => {
    expect(BEAT_DURATION).toBe(BEAT_TIMING.enter + BEAT_TIMING.hold + BEAT_TIMING.exit);
    expect(SEQUENCE_DURATION).toBe(BEAT_DURATION * ABOUT_BEATS.length);
  });

  // No skip button means the whole thing is compulsory. Keep it short enough
  // that it stays a pitch rather than a toll booth.
  /**
   * Raised from 12s to 20s when the beats went to 5s each so the opening
   * screenshot could actually be read. The assertion is kept rather than
   * deleted because the risk it guards has not gone anywhere: with no controls
   * on this screen, this number is time a student cannot escape. It exists to
   * make the next increase a decision rather than a drift.
   */
  it('keeps the compulsory sequence within its budget', () => {
    expect(SEQUENCE_DURATION).toBeLessThanOrEqual(20_000);
  });

  it('gives every phase a positive duration', () => {
    for (const phase of PHASE_ORDER) {
      expect(BEAT_TIMING[phase], phase).toBeGreaterThan(0);
    }
  });
});
