// src/components/DesktopNotice.tsx
import { useState } from 'react';
import Button from './Button';

/**
 * A drawing of the app on a phone, in the same palette the schedule grid uses
 * for class blocks. Cheaper and sharper than shipping a screenshot, and it
 * cannot go stale when the grid changes.
 */
function PhoneIllustration() {
  return (
    <svg viewBox="0 0 120 200" role="presentation" className="h-40 w-auto">
      <rect x="10" y="4" width="100" height="192" rx="16" className="fill-slate-900" />
      <rect x="16" y="10" width="88" height="180" rx="11" className="fill-white" />
      <rect x="48" y="14" width="24" height="4" rx="2" className="fill-slate-900" />
      <rect x="24" y="28" width="34" height="5" rx="2.5" className="fill-slate-300" />
      <rect x="24" y="42" width="22" height="26" rx="4" className="fill-indigo-200" />
      <rect x="50" y="42" width="22" height="40" rx="4" className="fill-emerald-200" />
      <rect x="76" y="42" width="22" height="18" rx="4" className="fill-amber-200" />
      <rect x="24" y="74" width="22" height="34" rx="4" className="fill-rose-200" />
      <rect x="50" y="88" width="22" height="22" rx="4" className="fill-sky-200" />
      <rect x="76" y="66" width="22" height="44" rx="4" className="fill-violet-200" />
      <rect x="24" y="114" width="22" height="30" rx="4" className="fill-teal-200" />
      <rect x="76" y="116" width="22" height="26" rx="4" className="fill-indigo-200" />
      <rect x="16" y="164" width="88" height="26" className="fill-slate-100" />
      <circle cx="38" cy="177" r="3" className="fill-slate-900" />
      <circle cx="60" cy="177" r="3" className="fill-slate-300" />
      <circle cx="82" cy="177" r="3" className="fill-slate-300" />
    </svg>
  );
}

type CopyState = 'idle' | 'copied' | 'failed';

/**
 * Shown instead of the app on anything wider than a phone. The point is to
 * move the student to their phone, so the one thing this screen owes them is
 * an easy way to get the address there — hence the copyable URL.
 */
export default function DesktopNotice({ onDismiss }: { onDismiss: () => void }) {
  const [copied, setCopied] = useState<CopyState>('idle');
  const url = `${window.location.origin}${window.location.pathname}`;
  const shownUrl = url.replace(/^https?:\/\//, '').replace(/\/$/, '');

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied('copied');
    } catch {
      // Clipboard access is blocked outside a secure context and in some
      // locked-down browsers. Say so instead of silently doing nothing —
      // the address is on screen and can be typed.
      setCopied('failed');
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-slate-50 p-6">
      <div className="flex w-full max-w-md flex-col items-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <PhoneIllustration />

        <h1 className="mt-6 text-2xl font-bold text-slate-900">
          Schedule Matcher is made for your phone
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          The weekly grid, the day chips and the compare view are all built for a phone
          screen — and your schedule is more use in your pocket than in a browser tab.
          Please open this on your phone.
        </p>

        <div className="mt-6 w-full rounded-xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-700">
          {shownUrl}
        </div>
        <Button variant="secondary" onClick={copyLink} className="mt-3 w-full">
          {copied === 'copied' ? 'Link copied' : 'Copy link'}
        </Button>
        {copied === 'failed' && (
          <p className="mt-2 text-xs text-slate-500">
            Your browser blocked the clipboard — type the address above on your phone.
          </p>
        )}

        <p className="mt-6 text-xs leading-relaxed text-slate-500">
          Once it's open on your phone, add it to your home screen and it opens like an app.
          Already on a phone? Turn it back to portrait.
        </p>

        <button
          type="button"
          onClick={onDismiss}
          className="mt-6 min-h-touch text-xs font-medium text-slate-400 underline underline-offset-4"
        >
          Continue on this screen anyway
        </button>
      </div>
    </main>
  );
}
