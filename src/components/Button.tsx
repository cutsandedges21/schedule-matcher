import type { ButtonHTMLAttributes } from 'react';
import { twMerge } from 'tailwind-merge';

type Variant = 'primary' | 'secondary' | 'ghost';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-slate-900 text-white active:bg-slate-700 disabled:bg-slate-400',
  secondary: 'bg-white text-slate-900 border border-slate-300 active:bg-slate-100',
  ghost: 'bg-transparent text-slate-600 active:bg-slate-100',
};

/**
 * Shared with any element that needs to look like a Button without being one
 * — e.g. a react-router `<Link>`, which renders an `<a>`. An `<a>` may not
 * contain interactive content, so nesting a real `<button>` inside a `<Link>`
 * is invalid HTML that breaks keyboard/screen-reader semantics; style the
 * link directly with this instead.
 */
export function buttonClassName(variant: Variant = 'primary', className?: string): string {
  return twMerge(
    'min-h-touch inline-flex items-center justify-center rounded-xl px-4 text-base font-semibold transition-colors disabled:cursor-not-allowed',
    VARIANTS[variant],
    className
  );
}

export default function Button({
  variant = 'primary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button {...props} className={buttonClassName(variant, className)} />;
}
