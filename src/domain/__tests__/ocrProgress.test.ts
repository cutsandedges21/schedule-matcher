// src/domain/__tests__/ocrProgress.test.ts
import { describe, it, expect } from 'vitest';
import { ocrProgressFraction, ocrProgressLabel } from '../ocrProgress';

// The statuses tesseract.js actually emits, in the order it emits them.
const SETUP_STATUSES = [
  'loading tesseract core',
  'initializing tesseract',
  'loading language traineddata',
  'initializing api',
];

describe('ocrProgressFraction', () => {
  it('starts visibly above empty, so the bar never looks stuck', () => {
    expect(ocrProgressFraction('loading tesseract core', 0)).toBeGreaterThan(0);
  });

  it('keeps every setup phase below where reading begins', () => {
    for (const status of SETUP_STATUSES) {
      expect(ocrProgressFraction(status, 0)).toBeLessThan(0.35);
      expect(ocrProgressFraction(status, 1)).toBeLessThanOrEqual(0.35);
    }
  });

  it('runs reading from the end of setup to just short of full', () => {
    expect(ocrProgressFraction('recognizing text', 0)).toBe(0.35);
    expect(ocrProgressFraction('recognizing text', 0.5)).toBeCloseTo(0.625);
    expect(ocrProgressFraction('recognizing text', 1)).toBe(0.9);
  });

  it('never reaches 1 on its own — parsing still has to happen', () => {
    expect(ocrProgressFraction('recognizing text', 1)).toBeLessThan(1);
  });

  it('survives values outside 0..1', () => {
    expect(ocrProgressFraction('recognizing text', -3)).toBe(0.35);
    expect(ocrProgressFraction('recognizing text', 42)).toBe(0.9);
    expect(ocrProgressFraction('recognizing text', NaN)).toBe(0.35);
  });

  it('shares one band across the setup phases, so a raw run can step back', () => {
    // Documenting the limitation rather than hiding it: the four setup phases
    // each count 0 → 1 inside the same band, so "initializing tesseract" at 0
    // sits below "loading tesseract core" at 1. This is exactly why the caller
    // keeps a running maximum.
    expect(ocrProgressFraction('initializing tesseract', 0)).toBeLessThan(
      ocrProgressFraction('loading tesseract core', 1)
    );
  });

  it('advances monotonically through a realistic run once the max is kept', () => {
    const raw = [
      ...SETUP_STATUSES.flatMap((status) => [
        ocrProgressFraction(status, 0),
        ocrProgressFraction(status, 1),
      ]),
      ocrProgressFraction('recognizing text', 0),
      ocrProgressFraction('recognizing text', 0.4),
      ocrProgressFraction('recognizing text', 1),
    ];

    let highest = 0;
    for (const value of raw) {
      highest = Math.max(highest, value);
      expect(highest).toBeLessThanOrEqual(0.9);
    }
    expect(highest).toBe(0.9);
  });
});

describe('ocrProgressLabel', () => {
  it('speaks about the schedule, not about tesseract', () => {
    expect(ocrProgressLabel('recognizing text')).toBe('Reading your schedule…');
    for (const status of SETUP_STATUSES) {
      expect(ocrProgressLabel(status)).toBe('Getting the reader ready…');
    }
  });
});
