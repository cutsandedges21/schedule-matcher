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
      // This list began as the bare word 'hours', which the contradiction test
      // immediately caught colliding with the `clear` and `edge` bodies — both
      // say "the hours you're free", a description of what the app surfaces
      // rather than a claim about what coordination costs. A substring check
      // cannot tell "you lose hours" from "your free hours are right there".
      //
      // Narrowed to the phrasings that would actually be a lie to someone who
      // said two minutes. This is a precision fix, not a weakening: the entry
      // was over-broad and would have blocked correct copy forever. Narrowing
      // a `denies` entry to dodge a genuine contradiction would be the
      // opposite, and is never the right move — fix the copy instead.
      { value: 'minutes', label: 'Two minutes', weight: 0, fragment: 'Two minutes, tops.',
        denies: ['drowning', 'never happens', 'takes hours', 'costs you hours', 'spend hours'] },
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
/**
 * One line each, on purpose.
 *
 * Every band used to carry forty to sixty words, and the bulk of it was the
 * same paragraph four times over — screenshot your schedule, your friends do
 * the same, the free hours appear. It explained the app to someone who was one
 * tap from using it, arriving right after they had already tapped three times.
 * Beats 1 and 2 and the questions do the selling; by the time a student reaches
 * this screen the only things left worth saying are that they were heard and
 * who built the thing.
 *
 * What survives is the reframe — the sentence that tells a student what their
 * own answers mean. The product pitch is gone and is not missed.
 */
export const BANDS: Record<BandId, { headline: string; body: string }> = {
  // Exactly one answer set lands here. Nothing in this band diagnoses a
  // problem: it repeats their own number back and stops.
  clear: {
    headline: 'Nothing about that is broken.',
    body: 'It still costs you two minutes.',
  },
  // Names no failure mechanism at all, because it is reachable by answer sets
  // that deny each one — including (chat / sorted / minutes), where a scolding
  // middle band would be flatly wrong. An offer, not a diagnosis.
  edge: {
    headline: "You don't need a system for this.",
    body: 'Just your week, where your friends can see it.',
  },
  manual: {
    headline: "You've been doing that part by hand.",
    body: "None of that is hanging out. It's the part before.",
  },
  core: {
    headline: 'You just described why this exists.',
    body: 'Not bad planning. Just schedules nobody can lay on top of each other.',
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
