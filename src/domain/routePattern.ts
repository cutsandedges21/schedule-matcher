// src/domain/routePattern.ts

/**
 * Mirrors the routes declared in App.tsx. Kept as a plain list rather than
 * imported from react-router so this stays a pure, framework-free function
 * like the rest of domain/ — this list only needs to change on the same
 * commit that changes App.tsx's routes.
 */
const KNOWN_PATTERNS = [
  '/login',
  '/onboarding',
  '/invite/:code',
  '/',
  '/upload',
  '/friends',
  '/settings',
  '/settings/customization',
  '/profile',
  '/u/:username',
  '/compare',
  '/compare/:username',
  '/privacy',
  '/terms',
] as const;

/**
 * Reduces a URL to its route *pattern* for error logging — "/compare", never
 * "/compare?with=alice,bob" or "/u/some-real-username". A query string or a
 * path param is exactly where a friend graph or a real identity would leak
 * into a table built specifically not to hold one (see
 * supabase/migrations/0009_app_events.sql).
 */
export function routePattern(pathname: string): string {
  const path = pathname.split(/[?#]/)[0];
  const segments = path.split('/').filter(Boolean);

  for (const pattern of KNOWN_PATTERNS) {
    const patternSegments = pattern.split('/').filter(Boolean);
    if (patternSegments.length !== segments.length) continue;
    if (patternSegments.every((seg, i) => seg.startsWith(':') || seg === segments[i])) {
      return pattern;
    }
  }

  return '(unknown route)';
}
