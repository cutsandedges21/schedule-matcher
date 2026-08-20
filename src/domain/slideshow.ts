// src/domain/slideshow.ts
//
// The onboarding intro: four beats of text + image that play themselves and
// hand off to the username step. There are no controls — no next, no back, no
// skip, and tapping does nothing — so the timing table and the termination
// guarantee below are the only things standing between a new student and an
// intro they cannot get out of. slideshow.test.ts asserts the sequence ends.

export type BeatPhase = 'enter' | 'hold' | 'exit';

export interface BeatImage {
  /** Path under public/. */
  src: string;
  alt: string;
  /**
   * Intrinsic pixel size.
   *
   * Declared per image because the beats no longer share a shape: the
   * illustrations are 4:3 and the chat screenshots are portrait. A browser
   * derives `aspect-ratio` from the width and height attributes when CSS sets
   * only a width, so one hard-coded pair would squash the photos into
   * landscape. It also reserves the right box before the file loads, so the
   * caption underneath does not jump.
   */
  width: number;
  height: number;
}

export interface Beat {
  text: string;
  /**
   * One image, or several shown as an overlapping fan.
   *
   * The fan is the point on the opening beat: one screenshot is an anecdote,
   * three stacked on top of each other is the thing that happens every
   * September. Adding another is a line in this file — the layout takes any
   * count.
   */
  images: readonly BeatImage[];
}

export const PHASE_ORDER: readonly BeatPhase[] = ['enter', 'hold', 'exit'];

/**
 * Milliseconds per phase. The whole pace of the intro lives here.
 *
 * Tuned so a beat is exactly 5s end to end (400 + 4250 + 350), which puts the
 * whole sequence at 20s. The fades are unchanged; all of the extra time went
 * into `hold`, because the thing that needed longer was reading — the opening
 * beat is a screenshot of two chat messages, and 2.2s was not enough to finish
 * the second one.
 *
 * **20s is a long time with no way out.** See the note on SEQUENCE_DURATION.
 */
export const BEAT_TIMING: Record<BeatPhase, number> = {
  enter: 400,
  hold: 4250,
  exit: 350,
};

/**
 * The story, in four beats:
 *
 *   1. this really happens, here is the receipt
 *   2. and the thing everyone does about it does not work
 *   3. here is what we do instead
 *   4. and we are the people it happened to
 *
 * Beat 4 closes the loop on beat 1. It used to read "We're students who got
 * tired of that", where "that" pointed at the previous beat — which is the
 * *solution*, so it said we were tired of our own app. "Tired of asking" names
 * beat 1 instead: the asking is the thing in the screenshot, and it is what
 * every student reading this has done themselves.
 */
export const ABOUT_BEATS: readonly Beat[] = [
  {
    text: 'Every semester, this exact conversation.',
    images: [
      {
        src: '/about/real-proof.jpg',
        alt: 'A group chat: "Wait so do u guys know when ull be free when ur skl starts", answered with "if only there was a way to check free time through our schedule"',
        width: 972,
        height: 1104,
      },
    ],
  },
  {
    text: 'Everyone sends a screenshot. Nobody gets an answer.',
    images: [
      {
        src: '/about/problem.svg',
        alt: 'A pile of overlapping schedule screenshots buried under unanswered messages asking when everyone is free',
        width: 320,
        height: 240,
      },
    ],
  },
  {
    text: "Upload your schedule once. See when you're all free.",
    images: [
      {
        src: '/about/overlap.svg',
        alt: 'A week grid with the window both students have free highlighted',
        width: 320,
        height: 240,
      },
    ],
  },
  {
    text: 'We got tired of asking. So we built this.',
    images: [
      {
        src: '/about/intro-us.jpg',
        alt: 'The two students who built Schedule Matcher, on a street outside campus',
        width: 960,
        height: 960,
      },
    ],
  },
];

export interface BeatPosition {
  index: number;
  phase: BeatPhase;
}

export const FIRST_POSITION: BeatPosition = { index: 0, phase: 'enter' };

/** One beat, enter through exit. Drives the progress hairline's fill duration. */
export const BEAT_DURATION = PHASE_ORDER.reduce((total, phase) => total + BEAT_TIMING[phase], 0);

/**
 * How long a new student is held on the intro. Currently 20s.
 *
 * This used to be capped at 12s, and the cap was not arbitrary: there are no
 * controls on this screen, so every second here is a second nobody can escape.
 * Four beats at a readable pace do not fit under that cap, so the cap moved —
 * but the reason for it did not go away, it just stopped being enforced.
 *
 * The right fix is to let a tap advance the beat. That keeps the sequence
 * unskippable while letting a fast reader move on and a slow one linger, and it
 * would make this number a ceiling rather than a sentence. Until then, treat
 * any further growth here as a real cost.
 */
export const SEQUENCE_DURATION = BEAT_DURATION * ABOUT_BEATS.length;

/**
 * The next position, or null when the sequence is over. Walking phases first
 * and beats second means every beat is guaranteed to run enter → hold → exit
 * before the next one starts, and that the walk always reaches null.
 */
export function advance({ index, phase }: BeatPosition): BeatPosition | null {
  const nextPhase = PHASE_ORDER.indexOf(phase) + 1;
  if (nextPhase < PHASE_ORDER.length) return { index, phase: PHASE_ORDER[nextPhase] };
  if (index + 1 < ABOUT_BEATS.length) return { index: index + 1, phase: 'enter' };
  return null;
}
