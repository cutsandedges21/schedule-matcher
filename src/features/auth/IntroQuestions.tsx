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
 * The four photos that used to be beat 4, copied out of slideshow.ts rather
 * than imported from it: the beat is being deleted, and this screen should not
 * be holding the last reference to a list the next commit removes.
 *
 * Alt text is verbatim from the beat, for the reason in the render below.
 */
const PHOTOS: readonly { src: string; alt: string }[] = [
  { src: '/about/us-1.jpg', alt: 'Me in a car' },
  { src: '/about/us-2.jpg', alt: 'Me on a plane' },
  { src: '/about/us-3.jpg', alt: 'Me in a car wearing a backwards cap' },
  { src: '/about/us-4.jpg', alt: 'Me at work in a black shirt' },
];

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

        {/* Keyed by text, which is only safe while no band repeats a paragraph
            within its own body. Checked: none does. "Making a plan becomes
            opening the app." is in two bands, but only one band ever renders. */}
        {result.body.split('\n\n').map((paragraph) => (
          <p key={paragraph} className="text-base leading-relaxed text-slate-700">
            {paragraph}
          </p>
        ))}

        <p className="text-base leading-relaxed text-slate-700">{result.bridge}</p>

        {/* The old beat 4, now closing the payoff. Four photos rather than one:
            a single photo reads as a headshot, four read as a person.

            Described rather than alt="", because that claim is the whole reason
            they are here — they are the evidence for the signoff, not decoration
            beside it. Hiding them leaves a screen-reader user with "I'm Mossimo"
            and nothing behind it. */}
        <div className="grid w-full max-w-[240px] grid-cols-2 gap-2">
          {PHOTOS.map((photo) => (
            <img
              key={photo.src}
              src={photo.src}
              alt={photo.alt}
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
