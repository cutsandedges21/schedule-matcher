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
