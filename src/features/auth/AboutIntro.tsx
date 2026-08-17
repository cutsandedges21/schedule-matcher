// src/features/auth/AboutIntro.tsx
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  ABOUT_BEATS,
  BEAT_DURATION,
  BEAT_TIMING,
  FIRST_POSITION,
  advance,
  type BeatPosition,
} from '@/domain/slideshow';

/**
 * The three-beat intro that opens onboarding. It plays itself and calls
 * `onDone` when the last beat has faded out.
 *
 * There are no controls — no next, no back, no skip — and tapping does
 * nothing. The progress hairline is the only affordance, and its only job is
 * to tell someone with no way out that this is finite.
 */
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
        <img src={beat.image} alt={beat.alt} width={320} height={240} className="w-full max-w-xs" />
        <p className="max-w-xs text-center text-2xl font-bold leading-snug">{beat.text}</p>
      </div>
    </main>
  );
}
