// src/components/DesktopNav.tsx
import { NavLink } from 'react-router-dom';

const TABS = [
  { to: '/', label: 'Schedule' },
  { to: '/friends', label: 'Friends' },
  { to: '/settings', label: 'Settings' },
];

/**
 * BottomNav's counterpart above the `lg` breakpoint. A tab bar pinned to the
 * bottom of a 1440px-wide window reads as a mistake, not a design choice —
 * this is the same three destinations in a normal top bar instead.
 */
export default function DesktopNav() {
  return (
    <header className="sticky top-0 z-20 hidden border-b border-slate-200 bg-white/95 backdrop-blur lg:block">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-8 py-3">
        <span className="text-lg font-bold text-slate-900">Schedule Matcher</span>
        <nav>
          <ul className="flex gap-1">
            {TABS.map((tab) => (
              <li key={tab.to}>
                <NavLink
                  to={tab.to}
                  end={tab.to === '/'}
                  className={({ isActive }) =>
                    `rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                      isActive ? 'bg-accent text-accent-fg' : 'text-slate-600 hover:bg-slate-100'
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
