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
