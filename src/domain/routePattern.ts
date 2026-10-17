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
  '/join/:code',
  '/',
  '/schedule',
  '/schedule/availability',
  '/upload',
  '/friends',
  // Static segments before the dynamic ones they would otherwise match:
  // the first pattern that fits wins.
  '/spaces',
  '/spaces/new',
  '/spaces/:spaceId',
  '/spaces/:spaceId/availability',
  '/spaces/:spaceId/calendar',
  '/spaces/:spaceId/events/new',
  '/spaces/:spaceId/events/:eventId',
  '/spaces/:spaceId/events/:eventId/edit',
  '/spaces/:spaceId/tasks',
  '/spaces/:spaceId/polls',
  '/spaces/:spaceId/polls/new',
  '/spaces/:spaceId/polls/:pollId',
  '/spaces/:spaceId/resources',
  '/spaces/:spaceId/members',
  '/spaces/:spaceId/settings',
  '/calendar',
  '/tasks',
  '/notifications',
  '/settings',
  '/settings/customization',
  '/settings/notifications',
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
