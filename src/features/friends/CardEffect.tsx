// src/features/friends/CardEffect.tsx
import { EFFECT_BAND_PX, type Effect } from '@/domain/effects';
import { STRIP_HEIGHT_PX, bannerGradient, type Banner } from '@/domain/banners';

/**
 * The band at the top of a friend's card: their banner strip, and below it the
 * effect band — currently reserved and empty.
 *
 * Everything here is inline styles, following SchoolChip and FriendCard —
 * these are *another* student's colours, and Tailwind class names must never
 * be built by interpolation (src/domain/color.ts). The one keyframe this needs
 * lives in index.css, because `@keyframes` cannot be expressed inline; the
 * stylesheet carries geometry and timing only, never a colour.
 *
 * Both bands are fixed-height boxes in **normal flow**, not overlays. The
 * username renders after them and therefore below them, so nothing drawn here
 * can pass behind the text. That is load-bearing rather than incidental: the
 * effect band is meant to hold decoration, and decoration behind text is how
 * you end up shipping 2.4:1. It is also what stops an effect spilling onto the
 * friend in the row below.
 */

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

      {/* Reserved and deliberately empty. Draws no content of its own, so on a
          themed card it reads as the cosmetic's background and on a plain one
          as white. Whatever fills it must clip to this box. */}
      {effect && <div className="overflow-hidden" style={{ height: EFFECT_BAND_PX }} />}
    </div>
  );
}
