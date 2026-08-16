// src/domain/viewport.ts

/**
 * The widest phone this app is designed for, in CSS pixels. The largest
 * phones in portrait sit around 430px (iPhone Pro Max) to 480px (a few
 * Android flagships); 639px is the last pixel below Tailwind's `sm`
 * breakpoint, so "mobile" here means exactly the range the unprefixed
 * Tailwind classes were written for.
 */
export const MAX_MOBILE_WIDTH = 639;

/**
 * Matches every viewport we consider too big for the app. Kept as a single
 * exported string so the media query and {@link isAboveMobileWidth} can never
 * drift apart — one is the runtime check, the other is what tests assert on.
 */
export const ABOVE_MOBILE_QUERY = `(min-width: ${MAX_MOBILE_WIDTH + 1}px)`;

/**
 * A pure width test, deliberately with no exemption for phones held in
 * landscape: a rotated phone is just as wrong for a portrait-first schedule
 * grid as a laptop is, and the notice tells those students to rotate back.
 */
export function isAboveMobileWidth(width: number): boolean {
  return width > MAX_MOBILE_WIDTH;
}
