// src/domain/__tests__/platform.test.ts
import { describe, it, expect } from 'vitest';
import { defaultInstallPlatform, detectInstallPlatform } from '../platform';

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const IPHONE_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1';
const PIXEL_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const MAC_SAFARI =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';

describe('detectInstallPlatform', () => {
  it('recognises iOS browsers, including non-Safari ones', () => {
    expect(detectInstallPlatform(IPHONE_SAFARI)).toBe('ios');
    expect(detectInstallPlatform(IPHONE_CHROME)).toBe('ios');
  });

  it('recognises Android', () => {
    expect(detectInstallPlatform(PIXEL_CHROME)).toBe('android');
  });

  it('does not claim to know about desktops', () => {
    expect(detectInstallPlatform(MAC_SAFARI)).toBeNull();
    expect(detectInstallPlatform('')).toBeNull();
  });

  it('reads Android first, since Android agents also name Safari and Mobile', () => {
    // A Chrome-on-Android agent contains "Safari" and "Linux"; matching in
    // the wrong order would file these students under iOS.
    expect(detectInstallPlatform(PIXEL_CHROME)).not.toBe('ios');
  });
});

describe('defaultInstallPlatform', () => {
  it('opens on the tab matching the device', () => {
    expect(defaultInstallPlatform(IPHONE_SAFARI)).toBe('ios');
    expect(defaultInstallPlatform(PIXEL_CHROME)).toBe('android');
  });

  it('falls back to iPhone rather than showing nothing', () => {
    expect(defaultInstallPlatform(MAC_SAFARI)).toBe('ios');
  });
});
