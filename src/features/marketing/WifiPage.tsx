// src/features/marketing/WifiPage.tsx
import { Link } from 'react-router-dom';
import { buttonClassName } from '@/components/Button';

/**
 * The landing page for a QR code printed on posters disguised as free-wifi
 * notices. Whoever scanned it wanted a network and got this, so the first
 * line has to admit that before anything else is allowed to happen.
 *
 * Deliberately auth-free. The call to action is a link to /login rather than
 * a signInWithOAuth call, which means no session read, no loading state and
 * no async work anywhere on this page — so the punchline paints on the first
 * frame, which is the entire point on campus 4G. It costs one extra tap, and
 * that is why the button says "ok, show me" instead of impersonating the
 * Google button on the next screen: a page that opens by admitting a lie
 * cannot afford a button that misrepresents what tapping it does. LoginPage
 * already redirects a visitor who turns out to be signed in, so the "they
 * already have the app" case needs nothing here either.
 *
 * The copy decisions are recorded in
 * docs/superpowers/specs/2026-08-25-wifi-poster-landing-design.md. Two that
 * matter if you edit this: the trick is framed as a marketing decision rather
 * than as desperation (an earlier draft read as begging for attention), and
 * nothing is claimed about data handling — schedules go to Supabase and
 * screenshots go to Gemini, so the privacy link carries that weight instead.
 */
export default function WifiPage() {
  return (
    <main className="flex min-h-dvh flex-col justify-between gap-8 p-6">
      <div className="flex flex-1 flex-col justify-center gap-6 text-center">
        <div className="flex flex-col gap-1">
          <h1 className="text-4xl font-bold tracking-tight">there is no wifi.</h1>
          {/* slate-500, not slate-400: this is read on a phone in a bright
              hallway, and slate-400 on the slate-50 body is 2.45:1 — under the
              3:1 floor for large text. slate-500 is 4.55:1. */}
          <p className="text-2xl font-bold tracking-tight text-slate-500">i lied.</p>
        </div>

        <p className="mx-auto max-w-xs text-balance text-sm leading-relaxed text-slate-600">
          in my defence: a poster that said &ldquo;check out my app&rdquo; would not have worked
          on you. this did.
        </p>

        <hr className="mx-auto w-16 border-slate-200" />

        <div className="mx-auto flex max-w-xs flex-col gap-3 text-balance leading-relaxed text-slate-900">
          <p>you screenshot your class schedule. it reads it for you.</p>
          <p>then you and your friends can see every hour you&rsquo;re all free at the same time.</p>
          <p className="text-slate-600">
            no more sending screenshots to the group chat and doing the math yourself.
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center gap-3">
        <Link to="/login" className={buttonClassName('primary', 'w-full')}>
          ok, show me &rarr;
        </Link>

        <p className="text-center text-xs leading-relaxed text-slate-600">
          built by a Vanier student. free, no ads, nothing to buy.
          <br />
          <Link to="/privacy" className="underline underline-offset-2">
            privacy
          </Link>
          {' · '}
          <Link to="/terms" className="underline underline-offset-2">
            terms
          </Link>
        </p>

        {/* One step lighter than the line above it, which keeps the hierarchy
            the old slate-400 gave — but at 4.55:1 rather than 2.45:1, which
            matters more at 12px than the half-shade of contrast does. */}
        <p className="text-center text-xs leading-relaxed text-slate-500">
          close it if you want. i&rsquo;m just trying to help people out.
        </p>
      </div>
    </main>
  );
}
