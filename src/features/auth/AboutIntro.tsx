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
 * The three-beat intro that opens onboarding. It plays itself and calls
 * `onDone` when the last beat has faded out.
 *
 * There are no controls — no next, no back, no skip — and tapping does
 * nothing. The progress hairline is the only affordance, and its only job is
 * to tell someone with no way out that this is finite.
 */
/**
 * Deterministic tilts for a fanned stack, so the pile looks thrown down rather
 * than laid out — and looks the same on every render, because a beat that
 * reshuffles itself mid-fade reads as a glitch.
 */
const FAN_TILT = [-7, 5, -3, 8, -5];

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

  return (
    <div className="flex w-full max-w-xs items-center justify-center">
      {beat.images.map((image, index) => (
        <img
          key={image.src}
          src={image.src}
          alt={image.alt}
          width={image.width}
          height={image.height}
          // Negative margins pull each one over the last so they overlap like a
          // pile of receipts. Later images sit on top, which is what makes the
          // stack read as accumulating rather than as a neat row.
          className="max-h-[46vh] w-3/5 shrink-0 rounded-xl border border-slate-200 bg-white object-contain shadow-md"
          style={{
            transform: `rotate(${FAN_TILT[index % FAN_TILT.length]}deg)`,
            marginLeft: index === 0 ? 0 : '-28%',
            zIndex: index,
          }}
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
