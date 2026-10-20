// src/domain/navTabs.ts

/** A subset of components/Icon's names, kept here so domain/ imports nothing from components/. */
export type NavIcon = 'home' | 'clock' | 'spaces' | 'calendar' | 'tasks' | 'friends' | 'bell' | 'settings';

export interface NavTab {
  to: string;
  label: string;
  icon: NavIcon;
}

/**
 * The bottom tab bar on a phone, and the first five tabs of the desktop
 * header. Five is the most a 320px-wide bar can hold with a label under each
 * icon, so these are the five things a student opens most: what is on, their
 * own week, their groups, the shared calendar, and what they owe someone.
 * Never list a tab whose route is not built: it would 404.
 */
export const NAV_TABS: readonly NavTab[] = [
  { to: '/', label: 'Home', icon: 'home' },
  { to: '/schedule', label: 'Schedule', icon: 'clock' },
  { to: '/spaces', label: 'Spaces', icon: 'spaces' },
  { to: '/calendar', label: 'Calendar', icon: 'calendar' },
  { to: '/tasks', label: 'Tasks', icon: 'tasks' },
];

/**
 * The desktop header has the room for Friends as a sixth tab — on a phone it
 * lives in the top bar instead, next to notifications and settings.
 */
export const DESKTOP_NAV_TABS: readonly NavTab[] = [...NAV_TABS, { to: '/friends', label: 'Friends', icon: 'friends' }];

/** Icon buttons in the phone top bar (all three) and the desktop header (the last two). */
export const UTILITY_LINKS: readonly NavTab[] = [
  { to: '/friends', label: 'Friends', icon: 'friends' },
  { to: '/notifications', label: 'Notifications', icon: 'bell' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
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
 * -1 for a route that is not one of the tabs (compare, a friend's schedule,
 * upload) — those pages have no tab to highlight.
 */
export function activeNavIndex(pathname: string, tabs: readonly NavTab[] = NAV_TABS): number {
  return tabs.findIndex((tab) =>
    tab.to === '/' ? pathname === '/' : pathname === tab.to || pathname.startsWith(`${tab.to}/`)
  );
}
