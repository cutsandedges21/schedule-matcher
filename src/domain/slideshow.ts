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
 * whole sequence at 14s. Only `hold` moves when the pace changes — the fades
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
 * The story, in four beats:
 *
 *   1. this really happens, here is the receipt
 *   2. and the thing everyone does about it does not work
 *   3. here is what we do instead
 *   4. and I am the person it happened to
 *
 * Beat 4 closes the loop on beat 1. It used to read "We're students who got
 * tired of that", where "that" pointed at the previous beat — which is the
 * *solution*, so it said the author was tired of their own app. "Tired of
 * asking" names beat 1 instead: the asking is the thing in the screenshot, and
 * it is what every student reading this has done themselves.
 *
 * First person singular throughout, because that is the truth — one person
 * built this. "We" in a founder story that has no second founder is the kind
 * of small inflation students notice, and it costs the beat exactly the
 * credibility it exists to buy.
 *
 * The name is doing real work rather than being a credit. Beat 1's screenshot
 * tags @moss.bianco, so a student who read it fifteen seconds earlier can see
 * that the person introducing himself here is the person who was tagged in the
 * message — the claim checks out against evidence already on screen. An
 * anonymous "I built this" asks to be believed; this one does not have to.
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
    text: "I'm Mossimo. I got tired of asking, so I built this.",
    images: [
      {
        src: '/about/us-1.jpg',
        alt: 'Me in a car',
        width: 480,
        height: 480,
      },
      {
        src: '/about/us-2.jpg',
        alt: 'Me on a plane',
        width: 480,
        height: 480,
      },
      {
        src: '/about/us-3.jpg',
        alt: 'Me in a car wearing a backwards cap',
        width: 480,
        height: 480,
      },
      {
        src: '/about/us-4.jpg',
        alt: 'Me at work in a black shirt',
        width: 480,
        height: 480,
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
 * How long a new student is held on the intro. Currently 14s.
 *
 * There are no controls on this screen, so every second here is a second
 * nobody can escape, on the first screen after installing. The assertion in
 * slideshow.test.ts exists to make a change to this number deliberate — it has
 * been 11.8s, then 20s, now 14s, and each move was a judgement about how much
 * compulsory time the story is worth.
 *
 * The change that would take the pressure off is letting a tap advance the
 * beat: still unskippable, but a fast reader moves on and a slow one lingers,
 * which turns this into a ceiling rather than a sentence.
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
