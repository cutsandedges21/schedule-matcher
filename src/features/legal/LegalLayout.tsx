// src/features/legal/LegalLayout.tsx
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

/**
 * The operator, the address students can reach them at, and the governing law.
 *
 * **One person, deliberately.** `OPERATOR_NAME` is not a credits line — it
 * names who is legally accountable for the service and for the personal
 * information it holds. Andreas Retsinas is a founder and belongs in About;
 * naming him here would attach Law 25 obligations to someone who does not
 * operate anything. See §8.1 of
 * docs/superpowers/specs/2026-08-17-monetization-design.md.
 *
 * `CONTACT_EMAIL` has to stay monitored. Quebec's Law 25 obliges an actual
 * response to access and deletion requests, and an unread inbox is a breach of
 * it rather than an oversight.
 *
 * Both jurisdiction usages read "governed by the laws of {JURISDICTION}", so
 * the string has to complete that sentence — hence the long form rather than
 * bare "Quebec".
 *
 * Still open before this is a paid service, and neither is a code change:
 * designating a privacy officer under Law 25, and French availability under the
 * Charter of the French Language. Both are noted in §8.2 of the spec.
 *
 * Bump LAST_UPDATED whenever the wording of either document changes.
 */
export const OPERATOR_NAME = 'Mossimo Bianco';
export const CONTACT_EMAIL = 'schedulematcher.info@gmail.com';
export const JURISDICTION = 'the Province of Quebec and the federal laws of Canada applicable therein';

export const LAST_UPDATED = 'August 18, 2026';

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

/**
 * A numbered clause with a hanging indent, so the number sits in its own
 * column and wrapped lines align under the text rather than under the number.
 * Numbering is written out by hand rather than generated: these are cited in
 * correspondence ("clause 9.2"), so a number must never move because a
 * paragraph was inserted above it.
 */
export function Clause({ n, children }: { n: string; children: ReactNode }) {
  return (
    <p className="grid grid-cols-[2.5rem_1fr] text-sm leading-relaxed text-slate-700">
      <span className="font-semibold tabular-nums text-slate-500">{n}</span>
      <span>{children}</span>
    </p>
  );
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
        <Link to="/settings" className="text-sm font-medium text-slate-500">
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
