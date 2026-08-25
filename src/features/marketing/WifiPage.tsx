// src/features/marketing/WifiPage.tsx
import { Link } from 'react-router-dom';
import Button from '@/components/Button';
import { signInWithGoogle } from '@/features/auth/signIn';

/**
 * The landing page for a QR code printed on posters disguised as free-wifi
 * notices. Whoever scanned it wanted a network and got this, so the first
 * line has to admit that before anything else is allowed to happen.
 *
 * The call to action goes straight to Google's account chooser rather than to
 * the login screen. That screen would only restate the pitch and offer one
 * button, and a stranger reading this on a hallway floor does not have a
 * spare tap to give it.
 *
 * Nothing on the page reads session state even so — there is no loading
 * branch and no await before first paint, so the punchline still lands on the
 * first frame, which is the entire point on campus 4G. The auth code is only
 * reached by tapping.
 *
 * Someone who already has the app and scans a poster out of curiosity gets
 * the Google chooser too, picks the account they are already signed into, and
 * lands back on their schedule. One tap more than they needed, which is the
 * right way round: the page is built for the stranger, not the regular.
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

        <div className="mx-auto flex max-w-xs flex-col gap-3 text-balance leading-relaxed text-slate-900">
          <p>You screenshot your class schedule. It reads it for you.</p>
          <p>Then you and your friends can see every hour you&rsquo;re all free at the same time.</p>
          <p className="text-slate-600">
            No more sending screenshots to the group chat and doing the math yourself.
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center gap-3">
        <Button onClick={() => void signInWithGoogle()} className="w-full">
          Okay, show me! &rarr;
        </Button>

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
