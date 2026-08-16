// src/domain/__tests__/viewport.test.ts
import { describe, it, expect } from 'vitest';
import { ABOVE_MOBILE_QUERY, MAX_MOBILE_WIDTH, isAboveMobileWidth } from '../viewport';

describe('isAboveMobileWidth', () => {
  it('lets every phone width through', () => {
    expect(isAboveMobileWidth(320)).toBe(false); // iPhone SE
    expect(isAboveMobileWidth(390)).toBe(false); // iPhone 14
    expect(isAboveMobileWidth(430)).toBe(false); // iPhone 15 Pro Max
    expect(isAboveMobileWidth(480)).toBe(false); // large Android
  });

  it('stops tablets and desktops', () => {
    expect(isAboveMobileWidth(744)).toBe(true);  // iPad mini portrait
    expect(isAboveMobileWidth(820)).toBe(true);  // iPad portrait
    expect(isAboveMobileWidth(1440)).toBe(true); // laptop
  });

  it('switches over exactly at the breakpoint', () => {
    expect(isAboveMobileWidth(MAX_MOBILE_WIDTH)).toBe(false);
    expect(isAboveMobileWidth(MAX_MOBILE_WIDTH + 1)).toBe(true);
  });

  it('agrees with the media query it ships alongside', () => {
    expect(ABOVE_MOBILE_QUERY).toBe('(min-width: 640px)');
  });
});
