// src/lib/useMediaQuery.ts
import { useCallback, useSyncExternalStore } from 'react';

/**
 * Subscribes to a CSS media query.
 *
 * `useSyncExternalStore` rather than `useState` + `useEffect` on purpose: the
 * first render already reads the real value, so a desktop visitor never sees
 * a frame of the phone layout before the notice replaces it.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query]
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false
  );
}
