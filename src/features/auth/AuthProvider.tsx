import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { PROFILE_COLUMNS, rowToProfile, type ProfileRow } from '@/domain/mappers';
import type { Profile } from '@/domain/types';

interface AuthValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  /**
   * True when the last profile fetch failed (network error, RLS hiccup, or
   * timeout) as opposed to genuinely finding no row. Consumers must not treat
   * this the same as "no profile" — that would send an existing user through
   * onboarding, where their real username collides on the primary key.
   */
  profileError: boolean;
  refreshProfile: () => Promise<void>;
  /**
   * Patch the cached profile with no round trip. Settings uses this so that
   * tapping a school repaints the app immediately instead of after the update
   * lands; the write still goes to the database, and a failure calls this
   * again with the previous value to put it back.
   */
  patchProfile: (patch: Partial<Profile>) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

// A stalled network call (dropped connection, captive portal, an auth-js
// navigator-lock wait when the app is open in several tabs) must never pin
// the app on a spinner forever. Cap how long we wait and treat a timeout the
// same as any other failed fetch: a retryable error, not an empty profile.
const PROFILE_FETCH_TIMEOUT_MS = 15000;

function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out')), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); }
    );
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState(false);
  const [loading, setLoading] = useState(true);

  async function loadProfile(userId: string) {
    try {
      const { data, error } = await withTimeout(
        supabase
          .from('profiles')
          .select(PROFILE_COLUMNS)
          .eq('id', userId)
          .maybeSingle(),
        PROFILE_FETCH_TIMEOUT_MS
      );

      if (error) {
        // A failed query is not the same fact as "this user has no profile
        // row yet" — conflating the two sends an established user into
        // onboarding, where their real username collides on the PK.
        setProfileError(true);
        return;
      }
      setProfileError(false);
      setProfile(data ? rowToProfile(data as ProfileRow) : null);
    } catch {
      setProfileError(true);
    }
  }

  useEffect(() => {
    let cancelled = false;

    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (cancelled) return;
        setSession(data.session);
        if (data.session) await loadProfile(data.session.user.id);
      })
      .catch(() => {
        // getSession() rejected (corrupted localStorage session, navigator-lock
        // timeout across tabs, etc). Fall back to signed-out rather than hang.
        if (!cancelled) setSession(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, next) => {
      setSession(next);
      if (next) {
        await loadProfile(next.user.id);
      } else {
        setProfile(null);
        setProfileError(false);
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value: AuthValue = {
    session,
    profile,
    loading,
    profileError,
    refreshProfile: async () => {
      if (session) await loadProfile(session.user.id);
    },
    patchProfile: (patch) => {
      setProfile((current) => (current ? { ...current, ...patch } : current));
    },
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
