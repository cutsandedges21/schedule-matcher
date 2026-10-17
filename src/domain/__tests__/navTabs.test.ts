// src/domain/__tests__/navTabs.test.ts
import { describe, it, expect } from 'vitest';
import { activeNavIndex, DESKTOP_NAV_TABS, NAV_TABS, UTILITY_LINKS } from '../navTabs';

describe('activeNavIndex', () => {
  it('matches each tab exactly', () => {
    expect(activeNavIndex('/')).toBe(0);
    expect(activeNavIndex('/schedule')).toBe(1);
    expect(activeNavIndex('/spaces')).toBe(2);
  });

  it('matches a subpath of a non-root tab, the same way NavLink without `end` does', () => {
    expect(activeNavIndex('/schedule/availability')).toBe(1);
    expect(activeNavIndex('/spaces/abc/members')).toBe(2);
  });

  it('does not match "/" as a prefix of every route', () => {
    expect(activeNavIndex('/friends')).not.toBe(0);
    expect(activeNavIndex('/upload')).not.toBe(0);
  });

  it('does not treat a route that merely starts with a tab name as a match', () => {
    // The bug a naive `pathname.startsWith(to)` would produce.
    expect(activeNavIndex('/spacesx')).toBe(-1);
    expect(activeNavIndex('/schedulematcher')).toBe(-1);
  });

  it('returns -1 for a route that is not a bottom tab', () => {
    expect(activeNavIndex('/upload')).toBe(-1);
    expect(activeNavIndex('/compare')).toBe(-1);
    expect(activeNavIndex('/friends')).toBe(-1);
  });

  it('matches Friends as the extra tab on desktop', () => {
    expect(activeNavIndex('/friends', DESKTOP_NAV_TABS)).toBe(3);
    expect(activeNavIndex('/u/alice', DESKTOP_NAV_TABS)).toBe(-1);
  });

  it('lists only built destinations, in nav order', () => {
    expect(NAV_TABS.map((tab) => tab.to)).toEqual(['/', '/schedule', '/spaces']);
  });

  it('keeps every existing destination one tap away: friends, notifications, settings', () => {
    expect(UTILITY_LINKS.map((link) => link.to)).toEqual(['/friends', '/notifications', '/settings']);
  });
});
