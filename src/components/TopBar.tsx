// src/components/TopBar.tsx
import { Link } from 'react-router-dom';
import UtilityLinks from './UtilityLinks';

/**
 * The phone's counterpart to the desktop header's right-hand side: the three
 * destinations that did not fit in the five-tab bottom bar.
 *
 * Not sticky, on purpose. The schedule's day chips and week header are
 * `sticky top-0` already, and a second sticky bar would slide them underneath
 * it; this one scrolls away with the page instead.
 */
export default function TopBar() {
  return (
    <header className="flex items-center justify-between px-4 pt-[max(0.5rem,env(safe-area-inset-top))] lg:hidden">
      <Link to="/" className="flex min-h-touch items-center text-base font-bold text-slate-900">
        Schedule Matcher
      </Link>
      <nav aria-label="Account">
        <UtilityLinks />
      </nav>
    </header>
  );
}
