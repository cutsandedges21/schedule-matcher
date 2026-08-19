// src/features/legal/LegalLayout.tsx
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { buttonClassName } from '../../components/Button';

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
 * bare "Quebec". `JURISDICTION_FR` completes the equivalent French sentence
 * and is not a literal translation of `JURISDICTION` — the sentence shapes
 * differ, so translate the whole clause, never assemble it from the English
 * fragment.
 *
 * Still open before this is a paid service, and neither is a code change:
 * designating a privacy officer under Law 25, and French availability under the
 * Charter of the French Language. Both are noted in §8.2 of the spec.
 *
 * Bump LAST_UPDATED_EN and LAST_UPDATED_FR together whenever the wording of
 * either document changes, in either language — a language toggle that shows
 * two different "last amended" dates for what is supposed to be one agreement
 * is a bug, not a translation nuance.
 */
export const OPERATOR_NAME = 'Mossimo Bianco';
export const CONTACT_EMAIL = 'schedulematcher.info@gmail.com';
export const JURISDICTION = 'the Province of Quebec and the federal laws of Canada applicable therein';
export const JURISDICTION_FR = "la province de Québec et les lois fédérales du Canada qui s'y appliquent";

export const LAST_UPDATED_EN = 'August 19, 2026';
export const LAST_UPDATED_FR = '19 août 2026';

export type Lang = 'en' | 'fr';

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
 * paragraph was inserted above it — in either language. The English and
 * French bodies of this document must carry identical clause numbers for the
 * same reason: a reader citing "clause 9.2" needs that to mean the same
 * provision regardless of which language they read it in.
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
  titleEn: string;
  titleFr: string;
  /** Render-prop so the page's clause content can switch language too, not just the chrome. */
  children: (lang: Lang) => ReactNode;
}

/**
 * Legal pages render outside the phone-only wall (see App.tsx) so they are
 * readable from any device — a policy nobody can open on a laptop is not much
 * of a policy. That is also why this layout carries its own header instead of
 * relying on AppShell's bottom nav, which only exists for signed-in users.
 *
 * **Defaults to English.** The app's UI is English-only today and its current
 * users are all at English CEGEPs, so opening straight into French would be a
 * language nobody asked for on every other screen. The toggle exists so
 * French is genuinely available, which is what the Charter requires — it does
 * not require French to load first. The choice does not persist across visits
 * by design: each visit re-presents the same default rather than silently
 * remembering a choice made once.
 */
export default function LegalLayout({ titleEn, titleFr, children }: Props) {
  const [lang, setLang] = useState<Lang>('en');
  const isFr = lang === 'fr';

  return (
    <main lang={lang} className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 p-6 pb-24">
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <Link to="/settings" className="text-sm font-medium text-slate-500">
            {isFr ? '← Retour' : '← Back'}
          </Link>
          <button
            type="button"
            onClick={() => setLang(isFr ? 'en' : 'fr')}
            className={buttonClassName('secondary', 'shrink-0 text-xs', 'sm')}
          >
            {isFr ? 'English' : 'Français'}
          </button>
        </div>
        <h1 className="mt-2 text-2xl font-bold">{isFr ? titleFr : titleEn}</h1>
        <p className="text-xs text-slate-500">
          {isFr ? `Dernière mise à jour le ${LAST_UPDATED_FR}` : `Last updated ${LAST_UPDATED_EN}`}
        </p>
      </header>

      <div className="flex flex-col gap-6">{children(lang)}</div>

      <footer className="mt-2 border-t border-slate-200 pt-4">
        <p className="text-xs text-slate-500">
          {isFr ? (
            <>
              Des questions? Communiquez avec {OPERATOR_NAME} à {CONTACT_EMAIL}.
            </>
          ) : (
            <>
              Questions? Contact {OPERATOR_NAME} at {CONTACT_EMAIL}.
            </>
          )}
        </p>
      </footer>
    </main>
  );
}
