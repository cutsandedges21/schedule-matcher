// src/features/auth/AboutIntro.tsx
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  ABOUT_BEATS,
  BEAT_DURATION,
  BEAT_TIMING,
  FIRST_POSITION,
  advance,
  type Beat,
  type BeatPosition,
} from '@/domain/slideshow';

/**
 * The two-beat prologue that opens onboarding. It plays itself and calls
 * `onDone` when the last beat has faded out, which hands over to
 * IntroQuestions.
 *
 * It said "three-beat" while there were four, and would now say it while there
 * are two. It renders whatever `ABOUT_BEATS` holds, so the count belongs in
 * slideshow.ts and not in this sentence.
 *
 * There are no controls — no next, no back, no skip — and tapping does
 * nothing. The progress hairline is the only affordance, and its only job is
 * to tell someone with no way out that this is finite.
 */
function BeatImages({ beat }: { beat: Beat }) {
  const [first, ...rest] = beat.images;

  // max-h-[52vh] is what keeps a portrait beat from pushing its own caption off
  // the bottom of a short phone; the landscape beats never reach it.
  // object-contain so the crop is never silently changed.
  if (rest.length === 0) {
    return (
      <img
        src={first.src}
        alt={first.alt}
        width={first.width}
        height={first.height}
        className="max-h-[52vh] w-full max-w-xs rounded-xl object-contain"
      />
    );
  }

  /**
   * Several images as a plain grid, two across.
   *
   * Deliberately narrower than a single-image beat (240px against 320px): four
   * photos at full width would tower over the caption and read as four things
   * to look at, where the point is one thing — a set. object-cover rather than
   * contain, because the sources are already square-cropped and cover keeps the
   * cells even if a later one is not.
   */
  return (
    <div className="grid w-full max-w-[240px] grid-cols-2 gap-2">
      {beat.images.map((image) => (
        <img
          key={image.src}
          src={image.src}
          alt={image.alt}
          width={image.width}
          height={image.height}
          className="aspect-square w-full rounded-lg object-cover"
        />
      ))}
    </div>
  );
}

export default function AboutIntro({ onDone }: { onDone: () => void }) {
  const [position, setPosition] = useState<BeatPosition>(FIRST_POSITION);

  /**
   * `onDone` through a ref so the timer effect depends only on `position`. A
   * caller passing an inline arrow — `onDone={() => setStep('username')}` — gives
   * a new identity every render, and with that in the dependency array any
   * unrelated re-render of the parent would clear and restart the current
   * beat's timer, stretching a beat indefinitely. With no skip button, that is
   * a student stuck on the first screen of the app.
   */
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const next = advance(position);
      if (next) setPosition(next);
      else done.current();
    }, BEAT_TIMING[position.phase]);

    return () => clearTimeout(timer);
  }, [position]);

  const beat = ABOUT_BEATS[position.index];

  return (
    <main className="flex min-h-dvh flex-col p-6">
      {/* Progress. aria-hidden: it is feedback, not a control, and the beat
          text below is already the accessible content. */}
      <div aria-hidden className="fixed inset-x-0 top-0 flex gap-1 px-1 pt-1">
        {ABOUT_BEATS.map((_, index) => (
          <div key={index} className="h-0.5 flex-1 overflow-hidden rounded-full bg-slate-200">
            {index < position.index && <div className="h-full bg-accent" />}
            {index === position.index && (
              <div
                className="intro-segment-fill h-full bg-accent"
                style={{ '--intro-duration': `${BEAT_DURATION}ms` } as CSSProperties}
              />
            )}
          </div>
        ))}
      </div>

      {/* Keyed by index so each beat mounts fresh and its animation restarts
          from the beginning rather than being skipped as a no-op. */}
      <div
        key={position.index}
        className={
          position.phase === 'exit'
            ? 'intro-beat-exit flex flex-1 flex-col items-center justify-center gap-8'
            : 'intro-beat-enter flex flex-1 flex-col items-center justify-center gap-8'
        }
        style={
          {
            '--intro-duration': `${BEAT_TIMING[position.phase === 'exit' ? 'exit' : 'enter']}ms`,
          } as CSSProperties
        }
      >
        <BeatImages beat={beat} />
        <p className="max-w-xs text-center text-2xl font-bold leading-snug">{beat.text}</p>
      </div>
    </main>
  );
}
