// src/features/friends/CardEffect.tsx
import type { CSSProperties } from 'react';
import { EFFECT_BAND_PX, type Effect } from '@/domain/effects';
import { STRIP_HEIGHT_PX, bannerGradient, type Banner } from '@/domain/banners';

/**
 * The band at the top of a friend's card: their banner strip, and beneath it
 * their effect.
 *
 * Everything here is inline styles, following SchoolChip and FriendCard —
 * these are *another* student's colours, and Tailwind class names must never
 * be built by interpolation (src/domain/color.ts). Only the keyframes live in
 * index.css, because `@keyframes` cannot be expressed inline; the stylesheet
 * carries geometry and timing, never a colour.
 *
 * Both bands are fixed-height boxes in **normal flow**, not overlays. The
 * username renders after them and therefore below them, so no mark can pass
 * behind the text. That is load-bearing rather than incidental: it is why
 * nothing in effects.ts needs a contrast rule against the card's text, and it
 * is what stops an effect spilling onto the friend in the row below.
 */

/**
 * Fixed layouts rather than random ones, so a card looks the same on every
 * render, and staggered so marks never pulse in unison — synchronised motion
 * is what makes an effect read as mechanical rather than natural.
 *
 * `left` is a percentage so the marks spread with the card instead of
 * clustering on a narrow phone.
 */
const RAIN = [
  { left: 6, size: 12, duration: 1.9, delay: 0 },
  { left: 18, size: 12, duration: 2.4, delay: 0.6 },
  { left: 30, size: 12, duration: 2.1, delay: 1.1 },
  { left: 43, size: 12, duration: 1.7, delay: 0.3 },
  { left: 55, size: 12, duration: 2.6, delay: 1.5 },
  { left: 68, size: 12, duration: 2.0, delay: 0.9 },
  { left: 80, size: 12, duration: 2.3, delay: 1.8 },
  { left: 91, size: 12, duration: 1.8, delay: 0.4 },
] as const;

const BUBBLES = [
  { left: 7, size: 12, duration: 3.4, delay: 0 },
  { left: 21, size: 8, duration: 4.1, delay: 0.9 },
  { left: 36, size: 14, duration: 3.8, delay: 1.7 },
  { left: 51, size: 9, duration: 4.5, delay: 0.4 },
  { left: 66, size: 12, duration: 3.6, delay: 2.2 },
  { left: 81, size: 10, duration: 4.2, delay: 1.2 },
  { left: 92, size: 13, duration: 3.9, delay: 2.8 },
] as const;

const SPARKLES = [
  { left: 6, top: 16, duration: 2.5, delay: 0.4 },
  { left: 19, top: 6, duration: 3.0, delay: 1.2 },
  { left: 32, top: 19, duration: 2.2, delay: 2.0 },
  { left: 45, top: 9, duration: 2.7, delay: 0.1 },
  { left: 58, top: 18, duration: 3.2, delay: 1.6 },
  { left: 72, top: 7, duration: 2.4, delay: 0.8 },
  { left: 86, top: 16, duration: 2.9, delay: 2.3 },
] as const;

/** A four-point star, so sparkles are a shape rather than a square. */
const STAR_CLIP =
  'polygon(50% 0, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0 50%, 39% 39%)';

function marks(effect: Effect) {
  if (effect.shape === 'rain') {
    return RAIN.map(({ left, size, duration, delay }) => {
      const style: CSSProperties = {
        left: `${left}%`,
        top: -size,
        width: 4,
        height: size,
        borderRadius: 2,
        backgroundColor: effect.colour,
        animation: `effect-rain ${duration}s linear ${delay}s infinite`,
      };
      return { key: `${left}`, className: 'effect-mark effect-mark-rain absolute', style };
    });
  }

  if (effect.shape === 'bubbles') {
    return BUBBLES.map(({ left, size, duration, delay }) => {
      const style: CSSProperties = {
        left: `${left}%`,
        bottom: -14,
        width: size,
        height: size,
        borderRadius: '50%',
        // Outlined, not filled: a solid disc at this size reads as a smudge.
        border: `2px solid ${effect.colour}`,
        animation: `effect-bubble ${duration}s linear ${delay}s infinite`,
      };
      return { key: `${left}`, className: 'effect-mark effect-mark-bubble absolute', style };
    });
  }

  return SPARKLES.map(({ left, top, duration, delay }) => {
    const style: CSSProperties = {
      left: `${left}%`,
      top,
      width: 9,
      height: 9,
      clipPath: STAR_CLIP,
      backgroundColor: effect.colour,
      animation: `effect-sparkle ${duration}s ease-in-out ${delay}s infinite`,
    };
    return { key: `${left}`, className: 'effect-mark effect-mark-sparkle absolute', style };
  });
}

interface Props {
  banner: Banner | null;
  effect: Effect | null;
}

export default function CardEffect({ banner, effect }: Props) {
  if (!banner && !effect) return null;

  return (
    <div aria-hidden>
      {banner && (
        <div
          className="card-strip"
          style={{
            height: STRIP_HEIGHT_PX,
            backgroundImage: bannerGradient(banner),
            backgroundSize: '200% 100%',
            animation: 'card-strip-drift 6s linear infinite',
          }}
        />
      )}

      {effect && (
        <div className="relative overflow-hidden" style={{ height: EFFECT_BAND_PX }}>
          {marks(effect).map(({ key, className, style }) => (
            <span key={key} className={className} style={style} />
          ))}
        </div>
      )}
    </div>
  );
}
