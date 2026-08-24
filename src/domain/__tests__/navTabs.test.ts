// src/domain/__tests__/navTabs.test.ts
import { describe, it, expect } from 'vitest';
import { activeNavIndex, NAV_TABS } from '../navTabs';

describe('activeNavIndex', () => {
  it('matches each tab exactly', () => {
    expect(activeNavIndex('/')).toBe(0);
    expect(activeNavIndex('/friends')).toBe(1);
    expect(activeNavIndex('/settings')).toBe(2);
  });

  it('matches a subpath of a non-root tab, the same way NavLink without `end` does', () => {
    expect(activeNavIndex('/settings/customization')).toBe(2);
  });

  it('does not match "/" as a prefix of every route', () => {
    expect(activeNavIndex('/friends')).not.toBe(0);
    expect(activeNavIndex('/upload')).not.toBe(0);
  });

  it('does not treat a route that merely starts with a tab name as a match', () => {
    // The bug a naive `pathname.startsWith(to)` would produce.
    expect(activeNavIndex('/settingsx')).toBe(-1);
    expect(activeNavIndex('/friendsomething')).toBe(-1);
  });

  it('returns -1 for a route that is not one of the three nav destinations', () => {
    expect(activeNavIndex('/upload')).toBe(-1);
    expect(activeNavIndex('/compare')).toBe(-1);
  });

  it('exposes exactly three tabs, in nav order', () => {
    expect(NAV_TABS.map((tab) => tab.to)).toEqual(['/', '/friends', '/settings']);
  });
});
