import { describe, expect, it } from 'vitest';
import { QUESTIONS } from '../onboardingQuestions';

describe('QUESTIONS', () => {
  it('is three questions in who/how/cost order', () => {
    expect(QUESTIONS.map((q) => q.id)).toEqual(['who', 'how', 'cost']);
  });

  it('gives every question three options', () => {
    for (const question of QUESTIONS) {
      expect(question.options).toHaveLength(3);
    }
  });

  // One rubric applied three times: 0 costs nothing, 1 is friction that still
  // resolves, 2 is failure. Summing only means something if the scale is the
  // same everywhere, so pin it.
  it('uses the same 0/1/2 rubric on every question', () => {
    for (const question of QUESTIONS) {
      expect(question.options.map((o) => o.weight)).toEqual([0, 1, 2]);
    }
  });

  // Fragments are joined into one paragraph in any combination, so each has to
  // stand alone as a sentence.
  it('gives every option a self-contained sentence fragment', () => {
    for (const question of QUESTIONS) {
      for (const option of question.options) {
        expect(option.fragment.endsWith('.')).toBe(true);
        expect(option.fragment[0]).toBe(option.fragment[0].toUpperCase());
        expect(/^(And|But|So|Because)\b/.test(option.fragment)).toBe(false);
      }
    }
  });

  // Thumb budget. Anything longer wraps on a 320px phone.
  it('keeps every label tappable', () => {
    for (const question of QUESTIONS) {
      for (const option of question.options) {
        expect(option.label.length).toBeLessThanOrEqual(25);
      }
    }
  });
});
