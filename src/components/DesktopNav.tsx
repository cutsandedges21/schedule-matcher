// src/components/DesktopNav.tsx
import { useLayoutEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { NAV_TABS, activeNavIndex } from '@/domain/navTabs';

interface PillRect {
  left: number;
  width: number;
}

/**
 * BottomNav's counterpart above the `lg` breakpoint. A tab bar pinned to the
 * bottom of a 1440px-wide window reads as a mistake, not a design choice —
 * this is the same three destinations in a normal top bar instead.
 */
export default function DesktopNav() {
  const { pathname } = useLocation();
  // One ref per tab, not `list.children[index]`: the pill <span> below is
  // itself a child of the same <ul>, so once it exists it shifts every <li>
  // down one slot in `.children` and every measurement after the first reads
  // the wrong element — the pill drifts, and the active tab's white text is
  // left with nothing behind it. Refs are immune to what else lives in the
  // DOM around them.
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);
  const [pill, setPill] = useState<PillRect | null>(null);

  /**
   * Unlike BottomNav's equal-width tabs, "Schedule"/"Friends"/"Settings" are
   * sized to their own text, so the pill's position and width have to come
   * from the DOM rather than a fixed fraction. useLayoutEffect (not
   * useEffect) so the first paint after a route change already has the
   * pill in the right place — no frame where it lags behind.
   *
   * DesktopNav stays mounted below `lg` (hidden via `display: none`, not
   * unmounted — see the header below), where every offset reads as zero. A
   * resize that crosses the breakpoint needs its own re-measure; the
   * pathname effect alone would miss it.
   */
  useLayoutEffect(() => {
    function measure() {
      const activeEl = itemRefs.current[activeNavIndex(pathname)];
      setPill(activeEl ? { left: activeEl.offsetLeft, width: activeEl.offsetWidth } : null);
    }

    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-20 hidden border-b border-slate-200 bg-white/95 backdrop-blur lg:block">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-8 py-3">
        <span className="text-lg font-bold text-slate-900">Schedule Matcher</span>
        <nav>
          <ul className="relative flex gap-1">
            {pill && (
              <span
                aria-hidden
                className="absolute inset-y-0 rounded-full bg-accent transition-all duration-200 ease-out motion-reduce:transition-none"
                style={{ left: pill.left, width: pill.width }}
              />
            )}

            {/*
              No hover background on an inactive tab — the pill is the only
              background this nav ever shows, on purpose, so it always reads
              as "the one true indicator" rather than one of several
              backgrounds that happen to coincide when it lands on a tab.
            */}
            {NAV_TABS.map((tab, i) => (
              <li
                key={tab.to}
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                className="relative z-10"
              >
                <NavLink
                  to={tab.to}
                  end={tab.to === '/'}
                  className={({ isActive }) =>
                    `block rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                      isActive ? 'text-accent-fg' : 'text-slate-600'
                    }`
                  }
                >
                  {tab.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
