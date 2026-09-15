// src/features/auth/IntroQuestions.tsx
import { useRef, useState } from 'react';
import Button from '@/components/Button';
import {
  QUESTIONS,
  payoff,
  type Answers,
  type QuestionId,
} from '@/domain/onboardingQuestions';

/**
 * The photo that closes the payoff, copied out of slideshow.ts rather than
 * imported from it: beat 4 was deleted, and this screen should not have held
 * the last reference to a list that was going away.
 *
 * One photo, not the four the beat used. slideshow.ts argued that four "read
 * as a person with a life" where one reads as a headshot, and that was a fair
 * argument — but whose face it is and how much of it to show is the founder's
 * call, and he made it. A headshot beside a name is the ordinary shape of a
 * sign-off anyway.
 */
const PHOTO = { src: '/about/us-4.jpg', alt: 'Me at work in a black shirt' };

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
/**
 * How long after an answer a second tap is ignored.
 *
 * Every question renders three options into the same three boxes at the same
 * three coordinates, so the screen after a tap looks almost exactly like the
 * screen before it. A student who taps and does not feel it land taps again,
 * and the second tap answers a question they never read — which puts a value
 * into `answers` that they did not choose, and the payoff then confidently
 * describes somebody who does not exist. That is precisely the untrue payoff
 * the fragments and the `denies` table exist to make impossible, arriving
 * through the one door those guards do not watch.
 *
 * 300ms is the 260ms enter animation plus a frame: taps are ignored until the
 * new question has actually finished arriving.
 */
export const CHOICE_LOCKOUT_MS = 300;

/**
 * The first question with no answer yet, or `QUESTIONS.length` when there are
 * none left — which is the payoff.
 *
 * Total by construction: it stops at the first gap, so `index` can only reach
 * `QUESTIONS.length` when every question has an answer. That is what keeps the
 * `as Answers` cast below sound for a seeded start as well as a tapped one.
 */
function firstUnanswered(answers: Partial<Answers>): number {
  const gap = QUESTIONS.findIndex((question) => !(question.id in answers));
  return gap === -1 ? QUESTIONS.length : gap;
}

export default function IntroQuestions({
  onDone,
  initialAnswers = {},
}: {
  onDone: () => void;
  /**
   * Answers to open with, instead of a blank slate.
   *
   * This exists for one caller: the dev-only onboarding preview
   * (OnboardingPreview.tsx, reachable at /__preview-onboarding in dev only).
   * Four payoff bands sit behind 27 answer combinations, so reviewing the copy
   * for one band otherwise means remembering which three options lead there and
   * tapping them again on every reload. Seeding the answers is how the preview
   * shows a band's real payoff — rendered by this component, from the real
   * `payoff()` — rather than a mock-up of it that would quietly go stale.
   *
   * Nothing in the product passes it, and nothing should: a student always
   * starts at question one. It is a harness seam, not a resume feature, and
   * not dead code.
   */
  initialAnswers?: Partial<Answers>;
}) {
  const [answers, setAnswers] = useState<Partial<Answers>>(initialAnswers);
  const [index, setIndex] = useState(() => firstUnanswered(initialAnswers));
  const lastChoiceAt = useRef(0);

  function choose(id: QuestionId, value: string) {
    const now = Date.now();
    if (now - lastChoiceAt.current < CHOICE_LOCKOUT_MS) return;
    lastChoiceAt.current = now;

    setAnswers((current) => ({ ...current, [id]: value }));
    setIndex((current) => current + 1);
  }

  if (index < QUESTIONS.length) {
    const question = QUESTIONS[index];

    return (
      <main className="flex min-h-dvh flex-col p-6">
        {/* Outside the keyed block below, so it does not restart its colour
            transition every time a question mounts. */}
        <div aria-hidden className="flex gap-1 pt-2">
          {QUESTIONS.map((_, i) => (
            <div
              key={i}
              className={`h-0.5 flex-1 rounded-full transition-colors duration-300 ${
                i <= index ? 'bg-accent' : 'bg-slate-200'
              }`}
            />
          ))}
        </div>

        {/* Keyed by index so React remounts on every answer and the enter
            animation actually replays — without the key it is one element
            whose text changed, and CSS animations do not re-fire for that. */}
        <div
          key={index}
          className="question-enter flex flex-1 flex-col justify-center gap-8"
        >
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

  // All three answered, so the cast is safe — see `firstUnanswered`.
  const result = payoff(answers as Answers);

  return (
    <main className="flex min-h-dvh flex-col gap-6 p-6">
      <div className="question-enter flex flex-1 flex-col justify-center gap-5">
        <p className="text-sm leading-relaxed text-slate-500">{result.recap}</p>

        <h1 className="text-2xl font-bold leading-snug">{result.headline}</h1>

        {/* Keyed by index, which is the correct choice for once: this list is
            derived from one static string, is never reordered or filtered, and
            a <p> holds no state. Keying by the text instead would couple React
            correctness to copy content — repeat a short line inside one band
            for rhythm and you get a duplicate key, with no test to catch it. */}
        {result.body.split('\n\n').map((paragraph, i) => (
          <p key={i} className="text-base leading-relaxed text-slate-700">
            {paragraph}
          </p>
        ))}

        <p className="text-base leading-relaxed text-slate-700">{result.bridge}</p>

        {/* The old beat 4, now closing the payoff.

            Described rather than alt="", because the photo is the evidence for
            the signoff rather than decoration beside it. Hiding it leaves a
            screen-reader user with "I'm Mossimo" and nothing behind it, which
            is the anonymous "I built this" the beat existed to avoid. */}
        <img
          src={PHOTO.src}
          alt={PHOTO.alt}
          width={480}
          height={480}
          className="aspect-square w-28 self-center rounded-xl object-cover"
        />

        <p className="text-base font-semibold leading-relaxed">{result.signoff}</p>
      </div>

      <Button onClick={onDone} className="w-full">
        Continue
      </Button>
    </main>
  );
}
