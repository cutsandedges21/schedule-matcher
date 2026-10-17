// src/lib/useAsyncData.ts
import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';
import { messageOf } from './supabaseErrors';

export interface AsyncData<T> {
  data: T | undefined;
  loading: boolean;
  error: string | null;
  /** Re-runs the loader. Resolves once the new data (or error) is in state. */
  reload: () => Promise<void>;
  /**
   * Replace the data locally — for an optimistic update, or to apply a row the
   * server just returned without a second round trip.
   */
  setData: (update: T | ((current: T | undefined) => T)) => void;
}

/**
 * The load / error / reload shape every data hook in features/ repeats,
 * written once.
 *
 * A response that arrives after a newer request was fired is dropped, so a
 * slow first load cannot overwrite a fast reload (the same stale-response
 * guard FriendSearch uses). `reload` keeps the existing data on screen while it
 * runs — `loading` is only true for the first load — so refreshing after an
 * action does not flash a spinner over the page the student is looking at.
 */
export function useAsyncData<T>(
  load: () => Promise<T>,
  deps: DependencyList,
  fallbackMessage = 'Something went wrong. Check your connection and try again.'
): AsyncData<T> {
  const [data, setDataState] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sequence = useRef(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  const run = useCallback(async () => {
    const mine = ++sequence.current;
    try {
      const result = await loadRef.current();
      if (sequence.current !== mine) return;
      setDataState(result);
      setError(null);
    } catch (caught) {
      if (sequence.current !== mine) return;
      setError(messageOf(caught, fallbackMessage));
    } finally {
      if (sequence.current === mine) setLoading(false);
    }
    // `deps` is the caller's: they decide when the loader means something new.
  }, deps);

  useEffect(() => {
    setLoading(true);
    void run();
    return () => {
      // Invalidate in-flight work from the previous deps.
      sequence.current += 1;
    };
  }, [run]);

  const setData = useCallback((update: T | ((current: T | undefined) => T)) => {
    setDataState((current) =>
      typeof update === 'function' ? (update as (c: T | undefined) => T)(current) : update
    );
  }, []);

  return { data, loading, error, reload: run, setData };
}
