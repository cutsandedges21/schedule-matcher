// src/features/auth/redirect.ts
//
// Preserves the page a signed-out (or not-yet-onboarded) user was trying to
// reach — e.g. an invite link — across the Google OAuth round trip and the
// /onboarding detour. React Router state does not survive the OAuth leg
// (the tab fully navigates to Google and back), so sessionStorage is the
// only mechanism that does.

const KEY = 'schedule-matcher:pending-redirect';

/** Remember `path` as the place to return to once auth/onboarding finishes. */
export function rememberRedirect(path: string) {
  if (path && path !== '/' && path !== '/login' && path !== '/onboarding') {
    sessionStorage.setItem(KEY, path);
  }
}

/** Read the pending redirect without clearing it (safe to call repeatedly). */
export function peekRedirect(): string {
  const path = sessionStorage.getItem(KEY);
  return path && path.startsWith('/') ? path : '/';
}

/** Read and clear the pending redirect — call this once it has been used. */
export function consumeRedirect(): string {
  const path = peekRedirect();
  sessionStorage.removeItem(KEY);
  return path;
}
