// src/features/friends/CardEffect.tsx
import { DRIP_BAND_PX, type Effect } from '@/domain/effects';
import { STRIP_HEIGHT_PX, bannerGradient, type Banner } from '@/domain/banners';

/**
 * The animated band at the top of a friend's card: their banner strip, and
 * their slime dripping out from under it.
 *
 * Everything here is inline styles, following SchoolChip and FriendCard —
 * these are *another* student's colours, and Tailwind class names must never
 * be built by interpolation (src/domain/color.ts). The keyframes live in
 * index.css because a `@keyframes` rule cannot be expressed inline; only
 * geometry and timing are in the stylesheet, never a colour.
 *
 * The band is a fixed-height box in **normal flow**, not an overlay. The
 * username renders after it and therefore below it, so a drip can never pass
 * behind the text. That is load-bearing: `#6B5320` brown on `#2B9540` green is
 * 2.4:1, and making this absolute would reintroduce exactly the contrast
 * problem the rest of the cosmetics system is tested against.
 */

/** Merges the drips into one another so they read as liquid, not as pills. */
const GOO_FILTER_ID = 'card-effect-goo';

/**
 * Rendered once per page, not once per card — an id has to be unique, and five
 * slimed friends would otherwise emit five identical `<filter id>` nodes.
 */
export function CardEffectDefs() {
  return (
    <svg width="0" height="0" aria-hidden className="absolute">
      <defs>
        <filter id={GOO_FILTER_ID}>
          <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blurred" />
          <feColorMatrix
            in="blurred"
            mode="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -10"
            result="gooey"
          />
          <feBlend in="SourceGraphic" in2="gooey" />
        </filter>
      </defs>
    </svg>
  );
}

/**
 * Where each drip hangs and how fast it runs. Fixed rather than random so a
 * card looks the same on every render, and staggered so the drips never pulse
 * in unison — synchronised bobbing is what makes it read as mechanical rather
 * than liquid.
 */
const DRIPS = [
  { left: 8, duration: 3.4, delay: 0 },
  { left: 28, duration: 4.6, delay: 0.8 },
  { left: 49, duration: 3.9, delay: 1.9 },
  { left: 70, duration: 5.2, delay: 0.3 },
  { left: 89, duration: 4.1, delay: 2.6 },
] as const;

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
        <div
          className="relative overflow-hidden"
          style={{ height: DRIP_BAND_PX, filter: `url(#${GOO_FILTER_ID})` }}
        >
          {/* The lip the drips hang from. Sits flush against the strip's
              bottom edge, or against the top of the card when there is no
              banner, so the slime always has something to come off. */}
          <div
            className="absolute inset-x-0 top-0"
            style={{ height: 7, backgroundColor: effect.drip }}
          />

          {DRIPS.map((drip) => {
            const timing = `${drip.duration}s ease-in-out ${drip.delay}s infinite`;
            return (
              <div key={drip.left} className="absolute top-0" style={{ left: `${drip.left}%` }}>
                <div
                  className="card-drip-stem absolute top-0 origin-top"
                  style={{
                    width: 15,
                    height: 58,
                    marginLeft: -7.5,
                    borderRadius: '0 0 8px 8px',
                    backgroundColor: effect.drip,
                    animation: `card-drip-stem ${timing}`,
                  }}
                />
                <div
                  className="card-drip-bulb absolute top-0 rounded-full"
                  style={{
                    width: 25,
                    height: 25,
                    marginLeft: -12.5,
                    backgroundColor: effect.drip,
                    animation: `card-drip-bulb ${timing}`,
                  }}
                />
                <div
                  className="card-drip-drop absolute top-0 rounded-full"
                  style={{
                    width: 19,
                    height: 19,
                    marginLeft: -9.5,
                    backgroundColor: effect.drip,
                    animation: `card-drip-drop ${drip.duration}s linear ${drip.delay}s infinite`,
                  }}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
