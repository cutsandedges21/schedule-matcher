import { Navigate, useLocation } from 'react-router-dom';
import { useEffect, type ReactNode } from 'react';
import { useAuth } from './AuthProvider';
import { consumeRedirect, rememberRedirect } from './redirect';
import Spinner from '@/components/Spinner';
import Button from '@/components/Button';

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { session, profile, profileError, loading, refreshProfile } = useAuth();
  const location = useLocation();
  const here = location.pathname + location.search;

  // Once we're fully authenticated and profiled, any pending redirect has
  // already done its job (it steered the OAuth redirectTo, or onboarding
  // consumed it) — clear it so it can't leak into a later, unrelated login.
  useEffect(() => {
    if (session && profile && !profileError) consumeRedirect();
  }, [session, profile, profileError]);

  if (loading) return <Spinner label="Loading" />;

  if (!session) {
    rememberRedirect(here);
    return <Navigate to="/login" replace />;
  }

  if (profileError) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-slate-700">We couldn't load your profile. Check your connection and try again.</p>
        <Button onClick={() => void refreshProfile()}>Try again</Button>
      </div>
    );
  }

  if (!profile && location.pathname !== '/onboarding') {
    rememberRedirect(here);
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
