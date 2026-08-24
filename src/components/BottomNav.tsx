// src/components/BottomNav.tsx
import { NavLink, useLocation } from 'react-router-dom';
import { NAV_TABS, activeNavIndex } from '@/domain/navTabs';

export default function BottomNav() {
  const { pathname } = useLocation();
  const index = activeNavIndex(pathname);

  return (
    <nav className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <ul className="relative flex px-2 py-1.5">
        {/*
          One pill sliding between three fixed slots reads as motion; three
          tabs independently swapping their own background reads as three
          unrelated colour changes that happen to line up. Every <li> below is
          flex-1, so the three slots are exactly equal width — that equality
          is what makes a plain percentage transform correct with no DOM
          measurement: translateX(100%) moves the pill by exactly its own
          width, which is exactly one slot, for any viewport. DesktopNav
          cannot use this trick — its tabs are sized to their text, not
          equal — and measures pixel offsets instead.
        */}
        {index >= 0 && (
          <span
            aria-hidden
            className="absolute inset-y-1.5 left-2 w-[calc((100%-1rem)/3)] rounded-full bg-slate-100 transition-transform duration-200 ease-out motion-reduce:transition-none"
            style={{ transform: `translateX(${index * 100}%)` }}
          />
        )}

        {NAV_TABS.map((tab) => (
          <li key={tab.to} className="relative z-10 flex-1">
            <NavLink
              to={tab.to}
              end={tab.to === '/'}
              className={({ isActive }) =>
                `flex min-h-touch items-center justify-center py-3 text-[15px] font-medium transition-colors ${
                  isActive ? 'text-accent' : 'text-slate-400'
                }`
              }
            >
              {tab.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
