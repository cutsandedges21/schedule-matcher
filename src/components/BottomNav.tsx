// src/components/BottomNav.tsx
import { NavLink, useLocation } from 'react-router-dom';
import { NAV_TABS, activeNavIndex } from '@/domain/navTabs';
import Icon from './Icon';

export default function BottomNav() {
  const { pathname } = useLocation();
  const index = activeNavIndex(pathname);

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="relative flex px-2 py-1.5">
        {/*
          One pill sliding between fixed slots reads as motion; tabs
          independently swapping their own background reads as unrelated
          colour changes that happen to line up. Every <li> below is flex-1, so
          the slots are exactly equal width — that equality is what makes a
          plain percentage transform correct with no DOM measurement:
          translateX(100%) moves the pill by exactly its own width, which is
          exactly one slot, for any viewport. DesktopNav cannot use this trick
          — its tabs are sized to their text, not equal — and measures pixel
          offsets instead.
        */}
        {index >= 0 && (
          <span
            aria-hidden
            data-nav-pill
            className="absolute inset-y-1.5 left-2 w-[calc((100%-1rem)/5)] rounded-2xl bg-slate-100 transition-transform duration-200 ease-out motion-reduce:transition-none"
            style={{ transform: `translateX(${index * 100}%)` }}
          />
        )}

        {NAV_TABS.map((tab) => (
          <li key={tab.to} className="relative z-10 min-w-0 flex-1">
            <NavLink
              to={tab.to}
              end={tab.to === '/'}
              className={({ isActive }) =>
                `flex min-h-touch flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-semibold transition-colors ${
                  isActive ? 'text-accent' : 'text-slate-400'
                }`
              }
            >
              <Icon name={tab.icon} className="h-6 w-6" />
              <span className="max-w-full truncate">{tab.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
