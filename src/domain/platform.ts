// src/domain/platform.ts

/** The two home-screen install flows we can give instructions for. */
export type InstallPlatform = 'ios' | 'android';

/**
 * Which set of "add to home screen" steps to show first.
 *
 * User-agent sniffing is the wrong tool for feature detection, but this is
 * not a feature test — the *steps themselves* differ by OS (a Share sheet
 * versus an overflow menu) and nothing in the DOM tells us which one the
 * student is looking at. Getting it wrong only costs a tap on the other tab.
 *
 * Note iPadOS 13+ reports itself as `Macintosh`, so iPads fall through to
 * `null`. That is fine here: tablets never reach the install step, because
 * anything wider than a phone gets the "use your phone" notice instead.
 */
export function detectInstallPlatform(userAgent: string): InstallPlatform | null {
  if (/android/i.test(userAgent)) return 'android';
  if (/iphone|ipad|ipod/i.test(userAgent)) return 'ios';
  return null;
}

/**
 * The tab to open on. An unrecognised agent defaults to iOS rather than to
 * nothing: a student who has to switch tabs is mildly annoyed, but a student
 * shown no instructions at all is stuck.
 */
export function defaultInstallPlatform(userAgent: string): InstallPlatform {
  return detectInstallPlatform(userAgent) ?? 'ios';
}
