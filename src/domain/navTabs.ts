// src/domain/navTabs.ts

export interface NavTab {
  to: string;
  label: string;
}

/**
 * The single source for BottomNav and DesktopNav, which used to each carry
 * their own copy of this exact array.
 */
export const NAV_TABS: readonly NavTab[] = [
  { to: '/', label: 'Schedule' },
  { to: '/friends', label: 'Friends' },
  { to: '/settings', label: 'Settings' },
];

/**
 * Mirrors NavLink's own `end`-aware active matching — exact for "/", prefix
 * for everything else — so the sliding pill (positioned from this) and each
 * tab's own text colour (driven by NavLink) can never disagree about which
 * tab is current.
 *
 * Safe to hand-roll rather than pull in react-router's matcher: every `to`
 * above is a fixed string literal, never a dynamic segment, so a prefix
 * check is exactly equivalent — as long as it checks for a trailing slash
 * rather than a bare `startsWith`, which would wrongly match "/settingsx"
 * against "/settings".
 *
 * -1 for a route that is not one of the three nav destinations (compare, a
 * friend's schedule, upload) — those pages have no tab to highlight.
 */
export function activeNavIndex(pathname: string): number {
  return NAV_TABS.findIndex((tab) =>
    tab.to === '/' ? pathname === '/' : pathname === tab.to || pathname.startsWith(`${tab.to}/`)
  );
}
