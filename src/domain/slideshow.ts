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
    text: "Everyone's schedule is a different screenshot.",
    image: '/about/problem.svg',
    alt: 'Three overlapping schedule screenshots buried under messages asking when everyone is free',
  },
  {
    text: 'Upload yours once. See where you overlap.',
    image: '/about/overlap.svg',
    alt: 'A week grid with the window both students have free highlighted',
  },
  {
    text: "We're students who got tired of that.",
    image: '/about/team-placeholder.svg',
    alt: 'Placeholder for a photo of the people who built this',
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
