// src/components/InstallInstructions.tsx
import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { defaultInstallPlatform, type InstallPlatform } from '@/domain/platform';
import {
  hasInstallPrompt,
  showInstallPrompt,
  subscribeToInstallPrompt,
} from '@/lib/installPrompt';
import Button from './Button';

/** The iOS Share glyph — a box with an arrow leaving the top. */
function ShareGlyph() {
  return (
    <svg viewBox="0 0 24 24" role="presentation" className="inline h-4 w-4 align-text-bottom">
      <path
        d="M12 3.5v10M12 3.5 8.5 7M12 3.5 15.5 7"
        className="stroke-slate-700"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M6 11H4.75v9.25h14.5V11H18"
        className="stroke-slate-700"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

/** Chrome's overflow menu — three stacked dots. */
function MenuGlyph() {
  return (
    <svg viewBox="0 0 24 24" role="presentation" className="inline h-4 w-4 align-text-bottom">
      <circle cx="12" cy="5" r="1.9" className="fill-slate-700" />
      <circle cx="12" cy="12" r="1.9" className="fill-slate-700" />
      <circle cx="12" cy="19" r="1.9" className="fill-slate-700" />
    </svg>
  );
}

interface Step {
  body: ReactNode;
  detail?: string;
}

const STEPS: Record<InstallPlatform, Step[]> = {
  ios: [
    {
      body: (
        <>
          Tap the Share button <ShareGlyph /> at the bottom of the screen.
        </>
      ),
      detail: 'In Safari it sits in the bar at the bottom. If the bar is hidden, scroll up once.',
    },
    {
      body: <>Scroll down the list and tap “Add to Home Screen”.</>,
    },
    {
      body: <>Tap “Add” in the top right.</>,
      detail: 'Schedule Matcher now sits on your home screen and opens without any browser bars.',
    },
  ],
  android: [
    {
      body: (
        <>
          Tap the menu <MenuGlyph /> in the top right of Chrome.
        </>
      ),
      detail: 'In Samsung Internet the menu is the three lines at the bottom right instead.',
    },
    {
      body: <>Tap “Install app”, or “Add to Home screen” if you don't see it.</>,
    },
    {
      body: <>Confirm with “Install” or “Add”.</>,
      detail: 'Schedule Matcher now sits on your home screen and opens in its own window.',
    },
  ],
};

const TABS: { value: InstallPlatform; label: string }[] = [
  { value: 'ios', label: 'iPhone' },
  { value: 'android', label: 'Android' },
];

/**
 * How to put the app on a home screen, on either platform.
 *
 * Both sets of steps are always reachable rather than only the detected one:
 * a student on a borrowed phone, or one whose browser reports something
 * unexpected, can still find their own instructions.
 */
export default function InstallInstructions() {
  const [platform, setPlatform] = useState<InstallPlatform>(() =>
    defaultInstallPlatform(navigator.userAgent)
  );
  const [prompted, setPrompted] = useState(false);

  const canPromptNatively = useSyncExternalStore(
    subscribeToInstallPrompt,
    hasInstallPrompt,
    () => false
  );

  return (
    <div>
      <div
        role="tablist"
        aria-label="Choose your phone"
        className="flex rounded-xl bg-slate-100 p-1"
      >
        {TABS.map((tab) => {
          const selected = tab.value === platform;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setPlatform(tab.value)}
              className={`min-h-touch flex-1 rounded-lg text-sm font-semibold transition-colors ${
                selected ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Chrome only offers this once the page qualifies as installable, and
          only on the platforms that support it — so it supplements the written
          steps rather than replacing them. */}
      {platform === 'android' && canPromptNatively && (
        <Button
          className="mt-4 w-full"
          onClick={async () => {
            setPrompted(true);
            await showInstallPrompt();
          }}
        >
          Add to home screen
        </Button>
      )}
      {platform === 'android' && prompted && !canPromptNatively && (
        <p className="mt-3 text-sm text-slate-500">
          If nothing happened, or you tapped cancel, use the steps below.
        </p>
      )}

      <ol className="mt-5 space-y-4">
        {STEPS[platform].map((step, index) => (
          <li key={index} className="flex gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
              {index + 1}
            </span>
            <div>
              <p className="text-sm leading-relaxed text-slate-800">{step.body}</p>
              {step.detail && (
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{step.detail}</p>
              )}
            </div>
          </li>
        ))}
      </ol>

      {platform === 'ios' && (
        <p className="mt-5 rounded-xl bg-slate-100 px-4 py-3 text-xs leading-relaxed text-slate-600">
          Only Safari and Chrome on iPhone can do this. If “Add to Home Screen” isn't in the
          Share sheet, open this page in Safari and try again.
        </p>
      )}
    </div>
  );
}
