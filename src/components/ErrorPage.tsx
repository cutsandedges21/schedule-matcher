// src/components/ErrorPage.tsx
import type { ReactNode } from 'react';
import { buttonClassName } from './Button';
import { canGoBack } from '@/domain/navigation';

interface Props {
  title: string;
  body: string;
  /** Rendered before the Home link — e.g. ErrorBoundary's Reload, or a retry. */
  extraAction?: ReactNode;
}

/**
 * Full-screen fallback for a page that cannot show its normal content: an
 * unmatched route, a crashed component tree, a profile that failed to load.
 * Deliberately router-free — ErrorBoundary can catch an error thrown by the
 * router itself, so nothing here may depend on Router context. Both actions
 * therefore use the native History API and a plain `<a href>` rather than
 * react-router's `navigate`/`Link`.
 */
export default function ErrorPage({ title, body, extraAction }: Props) {
  const showBack = canGoBack(window.history.state);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-bold text-slate-900">{title}</h1>
      <p className="max-w-xs text-sm leading-relaxed text-slate-700">{body}</p>
      <div className="flex gap-3">
        {showBack && (
          <button
            type="button"
            onClick={() => window.history.back()}
            className={buttonClassName('secondary')}
          >
            ← Back
          </button>
        )}
        {extraAction}
        <a href="/" className={buttonClassName('primary')}>
          Go home
        </a>
      </div>
    </main>
  );
}
