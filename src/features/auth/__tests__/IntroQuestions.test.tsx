// @vitest-environment jsdom
// src/features/auth/__tests__/IntroQuestions.test.tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import IntroQuestions, { CHOICE_LOCKOUT_MS } from '../IntroQuestions';
import { QUESTIONS, SIGNOFF } from '@/domain/onboardingQuestions';

/**
 * Fake timers because `choose` compares `Date.now()` against the last accepted
 * answer. Without them every test would fire its taps inside the same
 * millisecond, i.e. as a double-tap, and would be testing the lockout rather
 * than the flow.
 */
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

/** Answer at human speed: tap, then wait out the double-tap lockout. */
function tap(label: string) {
  fireEvent.click(screen.getByRole('button', { name: label }));
  act(() => {
    vi.advanceTimersByTime(CHOICE_LOCKOUT_MS);
  });
}

describe('IntroQuestions', () => {
  it('opens on the first question', () => {
    render(<IntroQuestions onDone={() => {}} />);
    expect(screen.getByText(QUESTIONS[0].prompt)).toBeDefined();
  });

  it('advances one question per tap', () => {
    render(<IntroQuestions onDone={() => {}} />);
    tap('Me and one friend');
    expect(screen.getByText(QUESTIONS[1].prompt)).toBeDefined();
    tap('We sort it out');
    expect(screen.getByText(QUESTIONS[2].prompt)).toBeDefined();
  });

  it('shows the payoff after the third tap, not onDone', () => {
    const onDone = vi.fn();
    render(<IntroQuestions onDone={onDone} />);
    tap('Me and one friend');
    tap('We sort it out');
    tap('Two minutes');

    expect(screen.getByText('Nothing about that is broken.')).toBeDefined();
    expect(screen.getByText(SIGNOFF)).toBeDefined();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('plays the answers back in the recap', () => {
    render(<IntroQuestions onDone={() => {}} />);
    tap('The whole group chat');
    tap('Screenshots, then silence');
    tap('The plan itself');

    expect(screen.getByText(/The whole group chat\./)).toBeDefined();
    expect(screen.getByText('You just described why this exists.')).toBeDefined();
  });

  it('calls onDone from the payoff continue button', () => {
    const onDone = vi.fn();
    render(<IntroQuestions onDone={onDone} />);
    tap('Me and one friend');
    tap('We sort it out');
    tap('Two minutes');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(onDone).toHaveBeenCalledTimes(1);
  });

  /**
   * The three options occupy the same three coordinates on every question, so
   * a tap that does not feel like it landed invites a second one — which would
   * otherwise answer a question the student never read and put a value into
   * the payoff that they never chose.
   */
  it('ignores a second tap inside the lockout', () => {
    render(<IntroQuestions onDone={() => {}} />);

    const first = () => screen.getAllByRole('button')[0];
    fireEvent.click(first());
    fireEvent.click(first()); // same spot, same instant

    expect(screen.getByText(QUESTIONS[1].prompt)).toBeDefined();
    expect(screen.queryByText(QUESTIONS[2].prompt)).toBeNull();
  });

  /**
   * `initialAnswers` is there for the dev preview (OnboardingPreview.tsx), but
   * it is still a way into the `as Answers` cast at the payoff, so the two ends
   * of it are pinned here: a complete seed opens on the payoff, and an
   * incomplete one resumes at the first gap instead of skipping it.
   */
  it('opens on the payoff when seeded with a full set of answers', () => {
    render(
      <IntroQuestions
        onDone={() => {}}
        initialAnswers={{ who: 'chat', how: 'silence', cost: 'plan' }}
      />
    );

    expect(screen.getByText('You just described why this exists.')).toBeDefined();
  });

  it('resumes at the first unanswered question', () => {
    render(<IntroQuestions onDone={() => {}} initialAnswers={{ who: 'chat' }} />);

    expect(screen.getByText(QUESTIONS[1].prompt)).toBeDefined();
  });

  it('accepts the next tap once the lockout has passed', () => {
    render(<IntroQuestions onDone={() => {}} />);

    const first = () => screen.getAllByRole('button')[0];
    fireEvent.click(first());
    act(() => {
      vi.advanceTimersByTime(CHOICE_LOCKOUT_MS);
    });
    fireEvent.click(first());

    expect(screen.getByText(QUESTIONS[2].prompt)).toBeDefined();
  });
});
