// @vitest-environment jsdom
// src/features/auth/__tests__/IntroQuestions.test.tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import IntroQuestions from '../IntroQuestions';
import { QUESTIONS, SIGNOFF } from '@/domain/onboardingQuestions';

afterEach(cleanup);

/** Tap the option with this label. */
function tap(label: string) {
  fireEvent.click(screen.getByRole('button', { name: label }));
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
});
