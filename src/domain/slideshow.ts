// src/domain/slideshow.ts
//
// The onboarding intro: three beats of text + image that play themselves and
// hand off to the username step. There are no controls — no next, no back, no
// skip, and tapping does nothing — so the timing table and the termination
// guarantee below are the only things standing between a new student and an
// intro they cannot get out of. slideshow.test.ts asserts the sequence ends.

export type BeatPhase = 'enter' | 'hold' | 'exit';

export interface Beat {
  text: string;
  /** Path under public/. */
  image: string;
  alt: string;
  /**
   * Intrinsic pixel size of the image.
   *
   * Carried per beat rather than hard-coded on the `<img>` because the beats no
   * longer share a shape: the illustrations are 4:3 and the screenshot is
   * portrait. A browser derives `aspect-ratio` from the width and height
   * attributes when CSS sets only a width, so a single 320x240 pair would
   * squash the photo into landscape. Declaring the real numbers also reserves
   * the right box before the file loads, so the text below does not jump.
   */
  width: number;
  height: number;
}

export const PHASE_ORDER: readonly BeatPhase[] = ['enter', 'hold', 'exit'];

/** Milliseconds per phase. The whole pace of the intro lives here. */
export const BEAT_TIMING: Record<BeatPhase, number> = {
  enter: 400,
  hold: 2200,
  exit: 350,
};

export const ABOUT_BEATS: readonly Beat[] = [
  {
    // The message this app came out of, opening the sequence because it is the
    // one beat nobody has to be persuaded of — every student has sent it.
    text: 'It started with this message.',
    image: '/about/real-proof.jpg',
    alt: 'A group chat: "Wait so do u guys know when ull be free when ur skl starts", answered with "if only there was a way to check free time through our schedule"',
    width: 972,
    height: 1104,
  },
  {
    text: "Everyone's schedule is a different screenshot.",
    image: '/about/problem.svg',
    alt: 'Three overlapping schedule screenshots buried under messages asking when everyone is free',
    width: 320,
    height: 240,
  },
  {
    text: 'Upload yours once. See where you overlap.',
    image: '/about/overlap.svg',
    alt: 'A week grid with the window both students have free highlighted',
    width: 320,
    height: 240,
  },
  {
    text: "We're students who got tired of that.",
    image: '/about/team-placeholder.svg',
    alt: 'Placeholder for a photo of the people who built this',
    width: 320,
    height: 240,
  },
];

export interface BeatPosition {
  index: number;
  phase: BeatPhase;
}

export const FIRST_POSITION: BeatPosition = { index: 0, phase: 'enter' };

/** One beat, enter through exit. Drives the progress hairline's fill duration. */
export const BEAT_DURATION = PHASE_ORDER.reduce((total, phase) => total + BEAT_TIMING[phase], 0);

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
