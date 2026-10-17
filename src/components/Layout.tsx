// src/components/Layout.tsx
//
// The page furniture the original screens write out by hand — a bold page
// title, small grey section headings, white rounded cards, a tinted notice —
// as components, so the new screens match them without re-deriving the
// classes each time.
import type { ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Section({
  title,
  action,
  children,
  className,
}: {
  title: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-500">{title}</h2>
        {action}
      </div>
      <div className="mt-2">{children}</div>
    </section>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={twMerge('rounded-2xl border border-slate-200 bg-white p-4', className)}>{children}</div>;
}

const NOTICE_TONES = {
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  error: 'border-rose-200 bg-rose-50 text-rose-800',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  info: 'border-slate-200 bg-slate-100 text-slate-700',
} as const;

export function Notice({
  tone = 'info',
  children,
  className,
}: {
  tone?: keyof typeof NOTICE_TONES;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : undefined}
      className={twMerge('rounded-xl border p-3 text-sm', NOTICE_TONES[tone], className)}
    >
      {children}
    </div>
  );
}

/** A quiet "nothing here yet" inside a card or section — EmptyState is the full-page version. */
export function InlineEmpty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">{children}</p>;
}

export function Badge({
  children,
  tone = 'slate',
}: {
  children: ReactNode;
  tone?: 'slate' | 'amber' | 'rose' | 'emerald' | 'sky' | 'violet';
}) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700',
    amber: 'bg-amber-100 text-amber-900',
    rose: 'bg-rose-100 text-rose-800',
    emerald: 'bg-emerald-100 text-emerald-900',
    sky: 'bg-sky-100 text-sky-900',
    violet: 'bg-violet-100 text-violet-900',
  } as const;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}
