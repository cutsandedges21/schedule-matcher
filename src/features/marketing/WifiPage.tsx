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
  // The gaps below are tighter than they look like they want to be, and that
  // is deliberate: at 320x568 — the smallest screen still in circulation — the
  // looser rhythm pushed "ok, show me" 20px below the fold, and a call to
  // action a poster-scanner has to go looking for is a call to action that
  // does not get tapped. Taller screens centre the block in the slack, so they
  // lose nothing by it.
  return (
    <main className="flex min-h-dvh flex-col justify-between gap-6 p-6">
      <div className="flex flex-1 flex-col justify-center gap-5 text-center">
        <div className="flex flex-col gap-1">
          <h1 className="text-4xl font-bold tracking-tight">There is no wifi.</h1>
          {/* slate-500, not slate-400: this is read on a phone in a bright
              hallway, and slate-400 on the slate-50 body is 2.45:1 — under the
              3:1 floor for large text. slate-500 is 4.55:1. */}
          <p className="text-2xl font-bold tracking-tight text-slate-500">I lied.</p>
        </div>

        <p className="mx-auto max-w-xs text-balance text-sm leading-relaxed text-slate-600">
          In my defence: a poster that said &ldquo;check out my app&rdquo; would not have worked
          on you. This did.
        </p>

        {/*
          The lockup stands in for what used to be a plain rule, because this
          is where the page turns from the joke to the pitch and a divider was
          doing nothing but marking the seam.

          Naming the app here is the point. Everything below describes what it
          does without ever saying what it is called, which strands the scanner
          who reads the whole thing, decides not to sign in on a hallway floor,
          and then has nothing to search for later.

          alt="" because the name is right there as text — captioning the image
          too would just make a screen reader say it twice. width/height are
          declared for the same reason slideshow.ts declares them: they reserve
          the box before the file loads so nothing under it jumps.
        */}
        <div className="flex items-center justify-center gap-2.5">
          <img
            src="/icon.svg"
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 rounded-lg"
          />
          <span className="text-lg font-bold tracking-tight">Schedule Matcher</span>
        </div>

        <div className="mx-auto flex max-w-xs flex-col gap-3 text-balance leading-relaxed text-slate-900">
          <p>You screenshot your class schedule. It reads it for you.</p>
          <p>Then you and your friends can see every hour you&rsquo;re all free at the same time.</p>
          <p className="text-slate-600">
            No more sending screenshots to the group chat and doing the math yourself.
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center gap-3">
        <Link to="/login" className={buttonClassName('primary', 'w-full')}>
          Okay, show me! &rarr;
        </Link>

        <p className="text-balance text-center text-xs leading-relaxed text-slate-600">
          Built by a Vanier student. Completely free. No ads. Nothing to buy.
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
          Close it if you want. I&rsquo;m just trying to help people out.
        </p>
      </div>
    </main>
  );
}
