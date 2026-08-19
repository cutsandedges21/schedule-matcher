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

  it('gives every beat text, an image and alt text', () => {
    for (const beat of ABOUT_BEATS) {
      expect(beat.text.trim().length).toBeGreaterThan(0);
      expect(beat.alt.trim().length).toBeGreaterThan(0);
      expect(beat.image).toMatch(/^\/about\/.+\.(svg|jpg|png)$/);
      // Declared so the browser reserves the right box and does not derive a
      // wrong aspect ratio for the portrait beat.
      expect(beat.width).toBeGreaterThan(0);
      expect(beat.height).toBeGreaterThan(0);
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
  it('keeps the compulsory sequence under 12 seconds', () => {
    expect(SEQUENCE_DURATION).toBeLessThanOrEqual(12_000);
  });

  it('gives every phase a positive duration', () => {
    for (const phase of PHASE_ORDER) {
      expect(BEAT_TIMING[phase], phase).toBeGreaterThan(0);
    }
  });
});
