import type { ComponentProps } from 'react';
import { twMerge } from 'tailwind-merge';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'md' | 'sm';

/**
 * `primary` follows the student's school (src/domain/schools.ts) via the
 * accent custom properties. `disabled` stays slate deliberately: a disabled
 * button tinted with the school colour reads as enabled-but-odd rather than
 * as unavailable.
 */
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg active:bg-accent-strong disabled:bg-slate-400',
  secondary: 'bg-white text-slate-900 border border-slate-300 active:bg-slate-100',
  ghost: 'bg-transparent text-slate-600 active:bg-slate-100',
};

/**
 * `sm` narrows the padding and type, never the height: two side-by-side
 * actions in a list row (Accept / Decline) have to fit next to a username on a
 * 320px screen, but shrinking below the 44px touch target to buy that space
 * would trade a layout problem for a tap-accuracy one.
 */
const SIZES: Record<Size, string> = {
  md: 'px-4 text-base',
  sm: 'px-3 text-sm',
};

/**
 * Shared with any element that needs to look like a Button without being one
 * — e.g. a react-router `<Link>`, which renders an `<a>`. An `<a>` may not
 * contain interactive content, so nesting a real `<button>` inside a `<Link>`
 * is invalid HTML that breaks keyboard/screen-reader semantics; style the
 * link directly with this instead.
 */
export function buttonClassName(
  variant: Variant = 'primary',
  className?: string,
  size: Size = 'md'
): string {
  return twMerge(
    'min-h-touch inline-flex items-center justify-center rounded-xl font-semibold transition-colors disabled:cursor-not-allowed',
    SIZES[size],
    VARIANTS[variant],
    className
  );
}

/**
 * `ComponentProps<'button'>` rather than the attribute interface so `ref`
 * passes straight through — React 19 hands refs to function components as an
 * ordinary prop, and ConfirmDialog focuses its Cancel button through one.
 * `type="button"` by default: inside a form, a bare <button> submits it, and
 * every Cancel, Remove and tab chip in this app would otherwise do that.
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  className,
  type = 'button',
  ...props
}: ComponentProps<'button'> & { variant?: Variant; size?: Size }) {
  return <button type={type} {...props} className={buttonClassName(variant, className, size)} />;
}
