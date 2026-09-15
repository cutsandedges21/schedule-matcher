// src/domain/slideshow.ts
//
// The onboarding prologue: two beats of text + image that play themselves and
// hand off once the last one has faded. There are no controls — no next, no
// back, no skip, and tapping does nothing — so the timing table and the
// termination guarantee below are the only things standing between a new
// student and a prologue they cannot get out of. slideshow.test.ts asserts the
// sequence ends.

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
   * One image, or several laid out as a grid two across.
   *
   * More than one is its own argument: a single photo reads as a headshot,
   * four together read as a person with a life — which is what the closing beat
   * is actually claiming. Adding another is a line in this file.
   */
  images: readonly BeatImage[];
}

export const PHASE_ORDER: readonly BeatPhase[] = ['enter', 'hold', 'exit'];

/**
 * Milliseconds per phase. The whole pace of the intro lives here.
 *
 * Tuned so a beat is exactly 3.5s end to end (400 + 2750 + 350), which puts the
 * two-beat prologue at 7s. Only `hold` moves when the pace changes — the fades
 * are transitions, not reading time, and stretching them makes the intro feel
 * sluggish rather than giving anyone longer to read.
 *
 * 2.75s of hold is the tight end for beat 1, which is a screenshot of two chat
 * messages. It was 2.2s once and the second message did not land; if testing
 * shows people still missing the punchline, that beat is the reason to reach
 * for per-beat timing rather than to push the whole sequence back up.
 */
export const BEAT_TIMING: Record<BeatPhase, number> = {
  enter: 400,
  hold: 2750,
  exit: 350,
};

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
];

export interface BeatPosition {
  index: number;
  phase: BeatPhase;
}

export const FIRST_POSITION: BeatPosition = { index: 0, phase: 'enter' };

/** One beat, enter through exit. Drives the progress hairline's fill duration. */
export const BEAT_DURATION = PHASE_ORDER.reduce((total, phase) => total + BEAT_TIMING[phase], 0);

/**
 * How long a new student is held on the prologue. Currently 7s.
 *
 * There are still no controls on this screen, so every second here is a second
 * nobody can escape, on the first screen after installing. The assertion in
 * slideshow.test.ts exists to make a change to this number deliberate — it has
 * been 11.8s, then 20s, then 14s, and each move was a judgement about how much
 * compulsory time the story is worth. 7s is not that judgement being revisited:
 * it is what two beats cost at an unchanged pace. The budget still binds,
 * because the seconds that cutting beats 3 and 4 freed are exactly the seconds
 * a third beat would quietly take back.
 *
 * The pressure came off from a different direction than this comment once
 * predicted. It argued for letting a tap advance the beat; what happened
 * instead is that the tappable content moved *after* the prologue —
 * IntroQuestions is paced entirely by the student, so what is unescapable now
 * is 7 seconds rather than the whole story. Tap-to-advance is still the right
 * move if even these two beats prove too long, but it is no longer the only
 * thing standing between a fast reader and the rest of the app.
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
