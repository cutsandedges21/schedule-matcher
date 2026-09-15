// @vitest-environment jsdom
// src/features/auth/__tests__/OnboardingPreview.test.tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import OnboardingPreview from '../OnboardingPreview';
import { ABOUT_BEATS } from '@/domain/slideshow';
import {
  ALL_ANSWERS,
  BANDS,
  QUESTIONS,
  payoff,
  type Answers,
  type BandId,
} from '@/domain/onboardingQuestions';

/**
 * Fake timers because the preview opens on AboutIntro, which schedules a beat
 * timer the moment it mounts. Nothing here advances them: every assertion is
 * about a screen you reach by tapping, and a beat firing mid-test would move
 * the flow underneath it.
 */
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

const BAND_IDS = Object.keys(BANDS) as BandId[];

/** Derived here as well as in the preview, so the two have to agree. */
function sampleFor(band: BandId): Answers {
  const found = ALL_ANSWERS.find((answers) => payoff(answers).band === band);
  if (!found) throw new Error(`no answer set reaches band "${band}"`);
  return found;
}

function openControls() {
  fireEvent.click(screen.getByRole('button', { name: 'dev' }));
}

function jumpTo(label: string) {
  openControls();
  fireEvent.click(screen.getByRole('button', { name: label }));
}

describe('OnboardingPreview', () => {
  it('opens on the prologue', () => {
    render(<OnboardingPreview />);
    expect(screen.getByText(ABOUT_BEATS[0].text)).toBeDefined();
  });

  /** Requirement one of a review tool: it must not be the thing you review. */
  it('keeps the controls collapsed until asked', () => {
    render(<OnboardingPreview />);
    expect(screen.queryByTestId('preview-controls')).toBeNull();

    openControls();
    expect(screen.getByTestId('preview-controls')).toBeDefined();
  });

  it('offers a jump for every band', () => {
    render(<OnboardingPreview />);
    openControls();

    for (const band of BAND_IDS) {
      expect(screen.getByRole('button', { name: band })).toBeDefined();
    }
  });

  it.each(BAND_IDS)('jumps straight to the %s payoff', (band) => {
    render(<OnboardingPreview />);
    jumpTo(band);

    expect(screen.getByText(BANDS[band].headline)).toBeDefined();
    // The recap is assembled from the answers by the real payoff(), so seeing
    // it proves the preview seeded the component rather than faking a screen.
    expect(screen.getByText(payoff(sampleFor(band)).recap)).toBeDefined();
  });

  it('collapses the controls after a jump', () => {
    render(<OnboardingPreview />);
    jumpTo('core');

    expect(screen.queryByTestId('preview-controls')).toBeNull();
  });

  it('skips to the first question with nothing answered', () => {
    render(<OnboardingPreview />);
    jumpTo('questions');

    expect(screen.getByText(QUESTIONS[0].prompt)).toBeDefined();
  });

  it('restarts from the prologue on demand', () => {
    render(<OnboardingPreview />);
    jumpTo('questions');
    jumpTo('restart');

    expect(screen.getByText(ABOUT_BEATS[0].text)).toBeDefined();
  });

  /** The loop: the point is watching it more than once. */
  it('returns to the prologue when the flow finishes', () => {
    render(<OnboardingPreview />);
    jumpTo('clear');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByText(ABOUT_BEATS[0].text)).toBeDefined();
  });
});
