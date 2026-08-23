// src/lib/useMediaQuery.ts
import { useEffect, useState } from 'react';

/**
 * Subscribe to a CSS media query from JavaScript.
 *
 * Used only where the two breakpoints render structurally different things —
 * the mobile editor shows one class in a sheet, the desktop one shows all of
 * them in a panel. Everywhere the difference is purely visual, this codebase
 * uses Tailwind's `lg:` variants instead, and should keep doing so.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false
  );

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const list = window.matchMedia(query);
    setMatches(list.matches);

    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
