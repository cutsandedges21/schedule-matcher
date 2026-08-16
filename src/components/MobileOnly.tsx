// src/components/MobileOnly.tsx
import { useState, type ReactNode } from 'react';
import { ABOVE_MOBILE_QUERY } from '@/domain/viewport';
import { useMediaQuery } from '@/lib/useMediaQuery';
import DesktopNotice from './DesktopNotice';

/**
 * The dismissal lives in sessionStorage, not localStorage: it is an escape
 * hatch for the one person who needs it right now (someone debugging, or a
 * student with no phone to hand), not a preference that should quietly
 * cancel the notice forever.
 */
const BYPASS_KEY = 'schedule-matcher:allow-desktop';

function readBypass(): boolean {
  try {
    return sessionStorage.getItem(BYPASS_KEY) === '1';
  } catch {
    // Safari in private mode can throw on storage access. A missing escape
    // hatch is survivable; a crash on first paint is not.
    return false;
  }
}

/** Renders the app on phone-sized viewports and the notice on anything wider. */
export default function MobileOnly({ children }: { children: ReactNode }) {
  const tooWide = useMediaQuery(ABOVE_MOBILE_QUERY);
  const [bypassed, setBypassed] = useState(readBypass);

  if (!tooWide || bypassed) return <>{children}</>;

  return (
    <DesktopNotice
      onDismiss={() => {
        try {
          sessionStorage.setItem(BYPASS_KEY, '1');
        } catch {
          // Storage is unavailable — the bypass still holds for this render,
          // it just won't survive a reload.
        }
        setBypassed(true);
      }}
    />
  );
}
