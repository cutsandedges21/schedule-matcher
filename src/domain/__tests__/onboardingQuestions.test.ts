import { describe, expect, it } from 'vitest';
import { ALL_ANSWERS, BANDS, QUESTIONS, payoff } from '../onboardingQuestions';

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

describe('payoff score and band', () => {
  it('sums the three weights', () => {
    expect(payoff({ who: 'one', how: 'sorted', cost: 'minutes' }).score).toBe(0);
    expect(payoff({ who: 'chat', how: 'silence', cost: 'plan' }).score).toBe(6);
    expect(payoff({ who: 'few', how: 'busy', cost: 'halfhour' }).score).toBe(3);
  });

  it('enumerates all 27 combinations', () => {
    expect(ALL_ANSWERS).toHaveLength(27);
  });

  it('gives every combination a score in range and a known band', () => {
    for (const answers of ALL_ANSWERS) {
      const result = payoff(answers);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(6);
      expect(Object.keys(BANDS)).toContain(result.band);
    }
  });

  it('pins the band boundaries', () => {
    const bandForScore = (score: number) =>
      ALL_ANSWERS.map(payoff).find((p) => p.score === score)!.band;
    expect(bandForScore(0)).toBe('clear');
    expect(bandForScore(1)).toBe('edge');
    expect(bandForScore(2)).toBe('edge');
    expect(bandForScore(3)).toBe('manual');
    expect(bandForScore(4)).toBe('manual');
    expect(bandForScore(5)).toBe('core');
    expect(bandForScore(6)).toBe('core');
  });

  it('reaches every band', () => {
    const reached = new Set(ALL_ANSWERS.map((a) => payoff(a).band));
    expect(reached).toEqual(new Set(['clear', 'edge', 'manual', 'core']));
  });

  /**
   * The singular "your friend" in the clear band is only safe because exactly
   * one answer set can reach it. If a future weight change let a group land
   * there, that copy would start lying.
   */
  it('reaches clear only from the all-zero answers', () => {
    for (const answers of ALL_ANSWERS) {
      if (payoff(answers).band !== 'clear') continue;
      expect(answers).toEqual({ who: 'one', how: 'sorted', cost: 'minutes' });
    }
  });

  /** "You just described why this exists" needs two actual failures behind it. */
  it('reaches core only with at least two weight-2 answers', () => {
    for (const answers of ALL_ANSWERS) {
      if (payoff(answers).band !== 'core') continue;
      const twos = [answers.who === 'chat', answers.how === 'silence', answers.cost === 'plan']
        .filter(Boolean).length;
      expect(twos).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('recap', () => {
  it('joins the three chosen fragments in who/how/cost order', () => {
    const result = payoff({ who: 'chat', how: 'silence', cost: 'plan' });
    expect(result.recap).toBe(
      "The whole group chat. Screenshots go in, nothing comes back. The plan doesn't happen."
    );
  });

  it('contains the chosen fragments and none of the unchosen ones', () => {
    for (const answers of ALL_ANSWERS) {
      const { recap } = payoff(answers);
      const chosen = [
        optionLabelFragment('who', answers.who),
        optionLabelFragment('how', answers.how),
        optionLabelFragment('cost', answers.cost),
      ];
      for (const fragment of chosen) expect(recap).toContain(fragment);

      const unchosen = QUESTIONS.flatMap((q) =>
        q.options.map((o) => o.fragment).filter((f) => !chosen.includes(f))
      );
      for (const fragment of unchosen) expect(recap).not.toContain(fragment);
    }
  });
});

function optionLabelFragment(id: 'who' | 'how' | 'cost', value: string): string {
  return QUESTIONS.find((q) => q.id === id)!.options.find((o) => o.value === value)!.fragment;
}

describe('band copy', () => {
  it('keeps the bridge and signoff identical in every band', () => {
    const results = ALL_ANSWERS.map(payoff);
    expect(new Set(results.map((r) => r.bridge)).size).toBe(1);
    expect(new Set(results.map((r) => r.signoff)).size).toBe(1);
  });

  it('leaves no unsubstituted placeholder in any rendered string', () => {
    for (const answers of ALL_ANSWERS) {
      const r = payoff(answers);
      for (const text of [r.recap, r.headline, r.body, r.bridge, r.signoff]) {
        expect(text).not.toContain('{');
      }
    }
  });
});
