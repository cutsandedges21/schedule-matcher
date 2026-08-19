// src/domain/navigation.ts

/**
 * react-router stamps `idx` onto `window.history.state` on every in-app
 * navigation, so idx > 0 means this page was genuinely reached by clicking
 * through the app and "back" has somewhere real to land. A cold load — a
 * shared link, a bookmark, a typed URL, an invalid route — starts at idx 0
 * (or has no history state at all), and offering "back" there would exit the
 * app rather than land on a real previous screen.
 */
export function canGoBack(historyState: unknown): boolean {
  const idx = (historyState as { idx?: unknown } | null | undefined)?.idx;
  return typeof idx === 'number' && idx > 0;
}
