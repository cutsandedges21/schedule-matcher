// src/features/legal/LegalLayout.tsx
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

/**
 * Placeholders, deliberately loud. These documents are not binding until the
 * three markers below are replaced with the real operator, contact address and
 * governing jurisdiction — grep for "[" in this folder before launch.
 */
export const OPERATOR_NAME = '[OPERATOR_NAME]';
export const CONTACT_EMAIL = 'schedulematcher.info@gmail.com';
export const JURISDICTION = '[JURISDICTION]';

export const LAST_UPDATED = 'August 16, 2026';

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-base font-bold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

export function P({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-relaxed text-slate-700">{children}</p>;
}

export function List({ children }: { children: ReactNode }) {
  return (
    <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed text-slate-700">
      {children}
    </ul>
  );
}

interface Props {
  title: string;
  children: ReactNode;
}

/**
 * Legal pages render outside the phone-only wall (see App.tsx) so they are
 * readable from any device — a policy nobody can open on a laptop is not much
 * of a policy. That is also why this layout carries its own header instead of
 * relying on AppShell's bottom nav, which only exists for signed-in users.
 */
export default function LegalLayout({ title, children }: Props) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 p-6 pb-24">
      <header className="flex flex-col gap-1">
        <Link to="/settings" className="text-sm font-medium text-slate-500 underline underline-offset-4">
          ← Back
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{title}</h1>
        <p className="text-xs text-slate-500">Last updated {LAST_UPDATED}</p>
      </header>

      <div className="flex flex-col gap-6">{children}</div>

      <footer className="mt-2 border-t border-slate-200 pt-4">
        <p className="text-xs text-slate-500">
          Questions? Contact {OPERATOR_NAME} at {CONTACT_EMAIL}.
        </p>
      </footer>
    </main>
  );
}
