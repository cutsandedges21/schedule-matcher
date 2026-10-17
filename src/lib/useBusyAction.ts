// src/lib/useBusyAction.ts
import { useCallback, useRef, useState } from 'react';

/**
 * Runs one async action at a time and reports whether one is in flight.
 *
 * `busy` drives the disabled state and the "Saving…" label, but state alone
 * cannot stop a double submit: two taps (or Enter pressed twice) inside one
 * frame both read the old `busy === false` from their closure and both send.
 * The ref is checked synchronously, so the second call is dropped before it
 * reaches the network.
 */
export function useBusyAction() {
  const running = useRef(false);
  const [busy, setBusy] = useState(false);

  const run = useCallback(async <T>(action: () => Promise<T>): Promise<T | undefined> => {
    if (running.current) return undefined;
    running.current = true;
    setBusy(true);
    try {
      return await action();
    } finally {
      running.current = false;
      setBusy(false);
    }
  }, []);

  return { busy, run };
}
