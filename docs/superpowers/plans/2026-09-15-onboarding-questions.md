# Onboarding Questions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace onboarding beats 3 and 4 with three tap-through questions and a payoff screen composed from the answers.

**Architecture:** One pure domain module (`src/domain/onboardingQuestions.ts`) holds the question table, the weights, the answer fragments, the band table, a contradiction table, and a `payoff()` function. One component (`src/features/auth/IntroQuestions.tsx`) holds three answers in state and renders questions then payoff. `OnboardingPage` gains a `'questions'` step between `'intro'` and `'username'`. Nothing is persisted — answers die with the component.

**Tech Stack:** Vite, React 19, TypeScript, Tailwind, vitest. Domain tests run in `environment: 'node'`; component tests opt into jsdom with a `// @vitest-environment jsdom` docblock and use `@testing-library/react`.

**Spec:** `docs/superpowers/specs/2026-09-15-onboarding-questions-design.md`

---

## File Structure

| File | Responsibility |
|---|---|
| `src/domain/onboardingQuestions.ts` | **Create.** Questions, options, weights, fragments, `DENIES`, band table, `payoff()`. Pure — no React, no Supabase. |
| `src/domain/__tests__/onboardingQuestions.test.ts` | **Create.** Exhaustive 3×3×3 coverage. |
| `src/features/auth/IntroQuestions.tsx` | **Create.** Answer state, question rendering, payoff rendering. Owns no copy. |
| `src/features/auth/__tests__/IntroQuestions.test.tsx` | **Create.** jsdom. Tap-through behaviour. |
| `src/domain/slideshow.ts` | **Modify.** `ABOUT_BEATS` drops to 2 entries. |
| `src/domain/__tests__/slideshow.test.ts` | **Modify.** The "four beats" assertion becomes two. |
| `src/features/auth/OnboardingPage.tsx` | **Modify.** Step union gains `'questions'`. |
| `public/about/overlap.svg` | **Delete.** Orphaned when beat 3 goes. |

---

### Task 1: The question table

**Files:**
- Create: `src/domain/onboardingQuestions.ts`
- Test: `src/domain/__tests__/onboardingQuestions.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/__tests__/onboardingQuestions.test.ts`
Expected: FAIL — `Failed to resolve import "../onboardingQuestions"`

- [ ] **Step 3: Write the module**

```ts
// src/domain/onboardingQuestions.ts

/**
 * The three questions that replaced onboarding beats 3 and 4, and the payoff
 * assembled from the answers. See
 * docs/superpowers/specs/2026-09-15-onboarding-questions-design.md.
 *
 * Nothing here is persisted. Answers live in IntroQuestions' state and are
 * discarded when it unmounts — no Supabase, no localStorage, no analytics.
 * That is deliberate: it is why this feature needed no migration and collects
 * no new personal information.
 */

export type QuestionId = 'who' | 'how' | 'cost';
export type WhoValue = 'one' | 'few' | 'chat';
export type HowValue = 'sorted' | 'busy' | 'silence';
export type CostValue = 'minutes' | 'halfhour' | 'plan';

export interface Option {
  value: string;
  /** What the student taps. Kept under 25 characters to survive a 320px phone. */
  label: string;
  /** 0 costs nothing, 1 is friction that resolves, 2 is failure. */
  weight: number;
  /**
   * This answer's contribution to the recap, as a complete sentence.
   *
   * All answer-specific language in the payoff lives here and nowhere else,
   * which is what makes the recap true by construction: it is a verbatim
   * restatement of what the student tapped.
   */
  fragment: string;
  /**
   * Phrases the band copy may not contain when this answer was chosen.
   * Asserted over all 27 combinations — see the DENIES test.
   */
  denies: readonly string[];
}

export interface Question {
  id: QuestionId;
  prompt: string;
  options: readonly Option[];
}

export const QUESTIONS: readonly Question[] = [
  {
    id: 'who',
    // "Three questions." sets a finite expectation the old auto-play never
    // did, for two words. The stem asks literally what the options answer; an
    // earlier draft ("Who has to be free before plans happen?") made you parse
    // a sentence before you could tap.
    prompt: 'Three questions. How many people are you usually making plans with?',
    options: [
      { value: 'one', label: 'Me and one friend', weight: 0, fragment: 'You and one friend.',
        denies: ['five of you', 'the group', 'everyone in the chat'] },
      { value: 'few', label: 'Three or four of us', weight: 1, fragment: 'Three or four of you.',
        denies: [] },
      { value: 'chat', label: 'The whole group chat', weight: 2, fragment: 'The whole group chat.',
        denies: [] },
    ],
  },
  {
    id: 'how',
    prompt: "Someone asks when everyone's free. Then what?",
    options: [
      { value: 'sorted', label: 'We sort it out', weight: 0, fragment: 'You sort it out.',
        denies: ['takes forever', "you're stuck", 'nobody answers'] },
      { value: 'busy', label: "Someone's always busy", weight: 1,
        fragment: 'Someone always turns out to be busy.', denies: [] },
      // Hands beat 2's own scene back as something to tap, so there is no seam
      // between the last slide and the first question.
      { value: 'silence', label: 'Screenshots, then silence', weight: 2,
        fragment: 'Screenshots go in, nothing comes back.', denies: [] },
    ],
  },
  {
    id: 'cost',
    prompt: 'Last one. What does that cost you?',
    options: [
      { value: 'minutes', label: 'Two minutes', weight: 0, fragment: 'Two minutes, tops.',
        denies: ['drowning', 'never happens', 'hours'] },
      { value: 'halfhour', label: 'Half an hour, easy', weight: 1,
        fragment: 'Half an hour, every time.', denies: [] },
      { value: 'plan', label: 'The plan itself', weight: 2, fragment: "The plan doesn't happen.",
        denies: [] },
    ],
  },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domain/__tests__/onboardingQuestions.test.ts`
Expected: PASS, 5 tests

- [ ] **Step 5: Commit**

```bash
git add src/domain/onboardingQuestions.ts src/domain/__tests__/onboardingQuestions.test.ts
git commit -m "feat(onboarding): the three-question table"
```

---

### Task 2: Score and band

**Files:**
- Modify: `src/domain/onboardingQuestions.ts`
- Test: `src/domain/__tests__/onboardingQuestions.test.ts`

This task adds types and tables only. It ships no new test, because everything
it adds is consumed by `payoff()` in Task 3 and is tested there — writing tests
here would mean committing a red suite. The gate for this task is the
typechecker.

- [ ] **Step 1: Append the types and tables**

Append to `src/domain/onboardingQuestions.ts`:

```ts
export type BandId = 'clear' | 'edge' | 'manual' | 'core';

export interface Answers {
  who: WhoValue;
  how: HowValue;
  cost: CostValue;
}

export interface Payoff {
  score: number;
  band: BandId;
  recap: string;
  headline: string;
  body: string;
  bridge: string;
  signoff: string;
}

/**
 * Ascending, first match wins. The final `max` equals the highest possible
 * score, so the scan is total and there is no fallback branch left untested.
 *
 * Band sizes follow the trinomial (1 + x + x^2)^3 = [1,3,6,7,6,3,1]:
 * clear 1, edge 9, manual 13, core 4. All four are reachable.
 */
const BAND_TABLE: readonly { max: number; id: BandId }[] = [
  { max: 0, id: 'clear' },
  { max: 2, id: 'edge' },
  { max: 4, id: 'manual' },
  { max: 6, id: 'core' },
];

function optionFor(questionId: QuestionId, value: string): Option {
  const question = QUESTIONS.find((q) => q.id === questionId)!;
  return question.options.find((o) => o.value === value)!;
}

/** Every combination, for exhaustive tests. */
export const ALL_ANSWERS: readonly Answers[] = QUESTIONS[0].options.flatMap((who) =>
  QUESTIONS[1].options.flatMap((how) =>
    QUESTIONS[2].options.map((cost) => ({
      who: who.value as WhoValue,
      how: how.value as HowValue,
      cost: cost.value as CostValue,
    }))
  )
);
```

- [ ] **Step 2: Verify it typechecks and the suite is still green**

Run: `npx vitest run src/domain/__tests__/onboardingQuestions.test.ts`
Expected: Task 1's 5 tests still PASS.

**Do not run `tsc` at this checkpoint.** `tsconfig.app.json` sets
`noUnusedLocals: true`, and `BAND_TABLE` and `optionFor` have no consumer until
Task 3 — so `tsc` fails with TS6133 here by construction. That is expected and
self-resolves the moment Task 3 lands. Do **not** add suppression comments or
alter the code to silence it; the whole point of splitting these tasks is that
Task 2's output is scaffolding for Task 3.

`npm test` runs vitest only and is unaffected, so the Task 2 commit is green by
the gate this repo actually enforces. Run `tsc` at the end of Task 3, where it
must pass clean.

- [ ] **Step 3: Commit**

```bash
git add src/domain/onboardingQuestions.ts
git commit -m "feat(onboarding): band table and answer enumeration"
```

---

### Task 3: Band copy and `payoff()`

**Files:**
- Modify: `src/domain/onboardingQuestions.ts`
- Test: `src/domain/__tests__/onboardingQuestions.test.ts`

- [ ] **Step 1: Write the failing test**

Append to the test file. This covers everything Tasks 2 and 3 add together —
score, band, recap and copy — so the first green run proves the whole payoff.

```ts
import { ALL_ANSWERS, BANDS, payoff } from '../onboardingQuestions';

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/__tests__/onboardingQuestions.test.ts`
Expected: FAIL — `payoff is not a function`

- [ ] **Step 3: Implement**

Append to `src/domain/onboardingQuestions.ts`:

```ts
/**
 * Its "I" is the same "I" as the signoff's, so the founder line arrives as the
 * next sentence of a thought rather than as a credit. Merging the old beat 4
 * into the payoff only works because of this line.
 */
export const BRIDGE = 'You worked that out. I just added it up.';

export const SIGNOFF = "I'm Mossimo. I got tired of asking, so I built this.";

/**
 * Band copy may assert only two things: product facts, and total coordination
 * cost implied by the score. It may never name a failure mechanism belonging
 * to one question, because every band above `clear` is reachable by answer
 * sets that deny that mechanism. The DENIES test enforces this.
 */
export const BANDS: Record<BandId, { headline: string; body: string }> = {
  // Exactly one answer set lands here, which is the only reason the singular
  // "your friend" is safe. Nothing in this band diagnoses a problem.
  clear: {
    headline: 'Nothing about that is broken.',
    body:
      "You've got the easy version, and it still costs you two minutes.\n\n" +
      'Screenshot your schedule once and fix anything it reads wrong. Your friend does the ' +
      "same. After that the hours you're both free are just there. When someone in the chat " +
      "asks, you're the one who already knows.",
  },
  // Names no failure mechanism at all, because it is reachable by answer sets
  // that deny each one — including (chat / sorted / minutes), where a scolding
  // middle band would be flatly wrong.
  edge: {
    headline: "You don't need a system for this.",
    body:
      'You need your week saved somewhere your friends can see it.\n\n' +
      'Screenshot your schedule once and fix anything it reads wrong. They do the same. ' +
      "After that the hours you're all free are already worked out. Nothing to send to the chat.",
  },
  manual: {
    headline: "You've been doing that part by hand.",
    body:
      "None of that is hanging out. It's the part before hanging out.\n\n" +
      'Screenshot your schedule once and fix anything it reads wrong. Everyone you add does ' +
      'the same. After that: every hour all of you are free, and the classes you have in ' +
      'common, on one screen.\n\nMaking a plan becomes opening the app.',
  },
  core: {
    headline: 'You just described why this exists.',
    body:
      "That's not you being bad at planning. It's a pile of schedules and no way to lay them " +
      'on top of each other.\n\nScreenshot yours once and fix anything it reads wrong. Up to ' +
      "five friends do the same. After that there's nothing to work out — the free hours are " +
      'already there, with the classes you share highlighted.\n\n' +
      'Making a plan becomes opening the app.',
  },
};

export function payoff(answers: Answers): Payoff {
  const chosen = [
    optionFor('who', answers.who),
    optionFor('how', answers.how),
    optionFor('cost', answers.cost),
  ];

  const score = chosen.reduce((total, option) => total + option.weight, 0);
  const band = BAND_TABLE.find((entry) => score <= entry.max)!.id;

  return {
    score,
    band,
    // The join is the only string operation performed on fragments.
    recap: chosen.map((option) => option.fragment).join(' '),
    headline: BANDS[band].headline,
    body: BANDS[band].body,
    bridge: BRIDGE,
    signoff: SIGNOFF,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domain/__tests__/onboardingQuestions.test.ts`
Expected: PASS, all tests from Tasks 1–3

- [ ] **Step 5: Commit**

```bash
git add src/domain/onboardingQuestions.ts src/domain/__tests__/onboardingQuestions.test.ts
git commit -m "feat(onboarding): band copy and the payoff function"
```

---

### Task 4: The contradiction test

This is the executable form of the spec's hard constraint. It is what fails when someone later edits a lie into the copy.

**Files:**
- Test: `src/domain/__tests__/onboardingQuestions.test.ts`

- [ ] **Step 1: Write the failing test**

Append:

```ts
describe('the truth constraint', () => {
  /**
   * Band copy must never contain a phrase an answer denies. A student who said
   * "me and one friend" must not be told about "the group"; one who said "two
   * minutes" must not be told they are "drowning".
   *
   * This is the whole reason the copy is band-level rather than per-answer: it
   * is the assertion that makes a lie in onboarding a failing test rather than
   * a thing somebody notices in three months.
   */
  it('never contradicts an answer the student gave', () => {
    for (const answers of ALL_ANSWERS) {
      const result = payoff(answers);
      const rendered = `${result.headline} ${result.body} ${result.bridge}`.toLowerCase();

      const denied = [
        optionFor2('who', answers.who),
        optionFor2('how', answers.how),
        optionFor2('cost', answers.cost),
      ].flatMap((option) => option.denies);

      for (const phrase of denied) {
        expect(
          rendered.includes(phrase.toLowerCase()),
          `band "${result.band}" contains "${phrase}", denied by ${JSON.stringify(answers)}`
        ).toBe(false);
      }
    }
  });
});

function optionFor2(id: 'who' | 'how' | 'cost', value: string) {
  return QUESTIONS.find((q) => q.id === id)!.options.find((o) => o.value === value)!;
}
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run src/domain/__tests__/onboardingQuestions.test.ts`
Expected: PASS. If it FAILS, the message names the band, the offending phrase, and the answer set — fix the **copy**, never the `denies` list. Weakening `denies` to make a test pass defeats the entire mechanism.

- [ ] **Step 3: Add the snapshot**

Append:

```ts
  /**
   * All 27 rendered payoffs. Any later copy edit is then reviewed against
   * every student who can reach it, rather than against the one the author had
   * in mind while editing.
   */
  it('matches the recorded payoff for every combination', () => {
    const rendered = ALL_ANSWERS.map((answers) => {
      const r = payoff(answers);
      return `${answers.who}/${answers.how}/${answers.cost} [${r.score} ${r.band}]\n${r.recap}\n${r.headline}`;
    });
    expect(rendered).toMatchSnapshot();
  });
```

- [ ] **Step 4: Run to create the snapshot**

Run: `npx vitest run src/domain/__tests__/onboardingQuestions.test.ts`
Expected: PASS, and `src/domain/__tests__/__snapshots__/onboardingQuestions.test.ts.snap` is created. Read it — it is the full matrix, and it is worth one careful read before committing.

- [ ] **Step 5: Commit**

```bash
git add src/domain/__tests__/
git commit -m "test(onboarding): contradiction table and the 27-combination snapshot"
```

---

### Task 5: The questions component

**Files:**
- Create: `src/features/auth/IntroQuestions.tsx`
- Test: `src/features/auth/__tests__/IntroQuestions.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/auth/__tests__/IntroQuestions.test.tsx`
Expected: FAIL — `Failed to resolve import "../IntroQuestions"`

- [ ] **Step 3: Implement**

```tsx
// src/features/auth/IntroQuestions.tsx
import { useState } from 'react';
import Button from '@/components/Button';
import {
  QUESTIONS,
  payoff,
  type Answers,
  type QuestionId,
} from '@/domain/onboardingQuestions';

/**
 * Three questions, then a payoff assembled from the answers. Replaces the old
 * beats 3 and 4 — see
 * docs/superpowers/specs/2026-09-15-onboarding-questions-design.md.
 *
 * Answers live here and nowhere else. They are never written to Supabase, to
 * localStorage, or to app_events; when this component unmounts they are gone.
 *
 * Unlike AboutIntro there is no timer: the student advances on tap, so a fast
 * reader moves immediately and a slow one takes as long as they like. That is
 * the fix slideshow.ts asks for in its own header.
 */
export default function IntroQuestions({ onDone }: { onDone: () => void }) {
  const [answers, setAnswers] = useState<Partial<Answers>>({});
  const [index, setIndex] = useState(0);

  function choose(id: QuestionId, value: string) {
    setAnswers((current) => ({ ...current, [id]: value }));
    setIndex((current) => current + 1);
  }

  if (index < QUESTIONS.length) {
    const question = QUESTIONS[index];

    return (
      <main className="flex min-h-dvh flex-col p-6">
        <div aria-hidden className="flex gap-1 pt-2">
          {QUESTIONS.map((_, i) => (
            <div
              key={i}
              className={`h-0.5 flex-1 rounded-full ${i <= index ? 'bg-accent' : 'bg-slate-200'}`}
            />
          ))}
        </div>

        <div className="flex flex-1 flex-col justify-center gap-8">
          <h1 className="text-2xl font-bold leading-snug">{question.prompt}</h1>

          <div className="flex flex-col gap-3">
            {question.options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => choose(question.id, option.value)}
                className="min-h-touch rounded-xl border border-slate-300 bg-white px-4 py-4 text-left text-base font-medium active:bg-slate-100"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </main>
    );
  }

  // All three answered, so the cast is safe: `index` only reaches
  // QUESTIONS.length after one `choose` per question.
  const result = payoff(answers as Answers);

  return (
    <main className="flex min-h-dvh flex-col gap-6 p-6">
      <div className="flex flex-1 flex-col justify-center gap-5">
        <p className="text-sm leading-relaxed text-slate-500">{result.recap}</p>

        <h1 className="text-2xl font-bold leading-snug">{result.headline}</h1>

        {result.body.split('\n\n').map((paragraph) => (
          <p key={paragraph} className="text-base leading-relaxed text-slate-700">
            {paragraph}
          </p>
        ))}

        <p className="text-base leading-relaxed text-slate-700">{result.bridge}</p>

        {/* The old beat 4, now closing the payoff. Four photos rather than one:
            a single photo reads as a headshot, four read as a person. */}
        <div className="grid w-full max-w-[240px] grid-cols-2 gap-2">
          {['us-1', 'us-2', 'us-3', 'us-4'].map((name) => (
            <img
              key={name}
              src={`/about/${name}.jpg`}
              alt=""
              width={480}
              height={480}
              className="aspect-square w-full rounded-lg object-cover"
            />
          ))}
        </div>

        <p className="text-base font-semibold leading-relaxed">{result.signoff}</p>
      </div>

      <Button onClick={onDone} className="w-full">
        Continue
      </Button>
    </main>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/auth/__tests__/IntroQuestions.test.tsx`
Expected: PASS, 5 tests

- [ ] **Step 5: Commit**

```bash
git add src/features/auth/IntroQuestions.tsx src/features/auth/__tests__/IntroQuestions.test.tsx
git commit -m "feat(onboarding): the questions and payoff screens"
```

---

### Task 6: Trim the slideshow to two beats

**Files:**
- Modify: `src/domain/slideshow.ts`
- Modify: `src/domain/__tests__/slideshow.test.ts:14`
- Delete: `public/about/overlap.svg`

- [ ] **Step 1: Update the failing assertion**

In `src/domain/__tests__/slideshow.test.ts`, replace the "four beats" test:

```ts
  it('is the two beats the design calls for', () => {
    expect(ABOUT_BEATS).toHaveLength(2);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/__tests__/slideshow.test.ts`
Expected: FAIL — expected length 2, received 4

- [ ] **Step 3: Trim the beats**

In `src/domain/slideshow.ts`, delete the third and fourth entries of `ABOUT_BEATS` — the one whose text is `"Upload your schedule once. See when you're all free."` and the one whose text is `"I'm Mossimo. I got tired of asking, so I built this."`. Keep the first two entries exactly as they are.

Then replace the doc comment above `ABOUT_BEATS` with:

```ts
/**
 * The problem, in two beats:
 *
 *   1. this really happens, here is the receipt
 *   2. and the thing everyone does about it does not work
 *
 * It used to be four. Beats 3 and 4 — the solution and the founder — are now
 * IntroQuestions: three questions the student taps through, and a payoff
 * assembled from the answers, which carries the founder line at its end. See
 * docs/superpowers/specs/2026-09-15-onboarding-questions-design.md.
 *
 * What is left here is a prologue, not the whole intro. These two beats still
 * auto-play with no controls, but they are 7 seconds rather than 14, and the
 * student reaches something tappable immediately afterwards.
 */
```

And update the `SEQUENCE_DURATION` comment, replacing "Currently 14s" with:

```ts
 * How long a new student is held on the prologue. Currently 7s.
```

- [ ] **Step 4: Run the whole suite**

Run: `npm test`
Expected: PASS. The `SEQUENCE_DURATION <= 20_000` assertion still holds at 7s and is worth keeping — it now bounds the prologue.

- [ ] **Step 5: Delete the orphaned asset**

`overlap.svg` was referenced only by the deleted beat 3.

```bash
git rm public/about/overlap.svg
grep -rn "overlap.svg" src/ public/ || echo "no references remain"
```

Expected: `no references remain`

- [ ] **Step 6: Commit**

```bash
git add src/domain/slideshow.ts src/domain/__tests__/slideshow.test.ts
git commit -m "feat(onboarding): cut the intro to the two problem beats"
```

---

### Task 7: Wire the step into onboarding

**Files:**
- Modify: `src/features/auth/OnboardingPage.tsx:54`, `:74`, `:195`

- [ ] **Step 1: Widen the step union**

At line 54, change:

```ts
  const [step, setStep] = useState<'install' | 'intro' | 'username'>(
    isStandalone() ? 'intro' : 'install'
  );
```

to:

```ts
  const [step, setStep] = useState<'install' | 'intro' | 'questions' | 'username'>(
    isStandalone() ? 'intro' : 'install'
  );
```

- [ ] **Step 2: Point the intro at the questions**

At line 74, change:

```ts
  const afterIntro = useCallback(() => setStep('username'), []);
```

to:

```ts
  // The prologue now hands off to the questions, not straight to the username.
  const afterIntro = useCallback(() => setStep('questions'), []);

  /** Stable for the same reason afterIntro is. */
  const afterQuestions = useCallback(() => setStep('username'), []);
```

- [ ] **Step 3: Render the new step**

After the `if (step === 'intro')` block near line 195, add:

```tsx
  if (step === 'questions') {
    return <IntroQuestions onDone={afterQuestions} />;
  }
```

And add the import beside the `AboutIntro` import at line 10:

```ts
import IntroQuestions from './IntroQuestions';
```

- [ ] **Step 4: Verify**

Run: `npm test && npm run build`
Expected: both PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/auth/OnboardingPage.tsx
git commit -m "feat(onboarding): route the prologue into the questions step"
```

---

### Task 8: Run it

**Files:** none

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Reach onboarding**

Onboarding only mounts for a signed-in user with no `profiles` row. Use a test account that has been deleted via Settings → Delete my account, or sign in with an account that has never finished onboarding.

- [ ] **Step 3: Walk it at 390px wide**

Use device emulation. Confirm:
- two beats auto-play, roughly 7 seconds total
- question 1 appears and the three options are tappable without wrapping
- each tap advances, and the progress bar fills one segment per question
- the payoff shows the recap, a headline matching the band, the four photos, and the sign-off
- Continue reaches the username step

- [ ] **Step 4: Check the two extremes**

Run it twice more: all-first-options (expect "Nothing about that is broken.") and all-last-options (expect "You just described why this exists."). These are the two bands whose copy makes the strongest claims, so they are the two worth seeing on a real screen.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix(onboarding): <what you found>"
```

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
|---|---|
| §1 Shape | 6, 7 |
| §2 Questions | 1 |
| §3 Composing the payoff | 2, 3 |
| §4 Payoff copy | 3 |
| §5 Truth rule | 4 |
| §6 Files | all |
| §7 Tests | 1–4, 5, 6 |
| §8 Out of scope | no tasks, correctly |

**Type consistency:** `Answers`, `Payoff`, `BandId`, `Option`, `Question`, `QuestionId` are defined in Tasks 1–3 and used with the same names and shapes in Tasks 5 and 7. `payoff()` returns the same seven fields everywhere. `QUESTIONS`, `BANDS`, `ALL_ANSWERS`, `BRIDGE`, `SIGNOFF` are the only exports consumed outside the module.

**Every task commits green.** Task 2 is the one exception to strict TDD: it adds types and tables with no test of its own, gated by `tsc` instead, because everything it adds is exercised by `payoff()` one task later. Writing its tests in place would have meant committing a red suite — which the first draft of this plan did, and which is worse than the small TDD deviation.

**Snapshot caution (Task 4, Step 4):** if the snapshot file already exists from a previous run, `vitest` compares rather than writes. Delete `src/domain/__tests__/__snapshots__/onboardingQuestions.test.ts.snap` and re-run if you have changed copy deliberately — and read the diff rather than passing `-u` reflexively, since the whole point of that snapshot is to force a human look at all 27 payoffs.
