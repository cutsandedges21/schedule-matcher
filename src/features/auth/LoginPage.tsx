import { Navigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthProvider';
import { consumeRedirect, peekRedirect } from './redirect';
import Button from '@/components/Button';

export default function LoginPage() {
  const { session, loading } = useAuth();
  if (!loading && session) return <Navigate to={consumeRedirect()} replace />;

  async function signIn() {
    // If the student arrived here from a deep link (an invite, a compare
    // link) rather than the app root, send Google straight back to it so the
    // request isn't silently dropped after sign-in.
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}${peekRedirect()}`,
        // Without this, signing out and tapping "Continue with Google" puts
        // you straight back into the account you just left: our session is
        // gone, but *Google's* cookie isn't, so Google silently re-authorises
        // its one signed-in user and bounces back before anything is drawn.
        // On a shared phone — a sibling's, a friend's, a library machine —
        // that makes a second account unreachable, with no way to tell it is
        // even happening. `select_account` always shows the chooser.
        queryParams: { prompt: 'select_account' },
      },
    });
  }

  return (
    <main className="flex min-h-dvh flex-col justify-between p-6">
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <h1 className="text-5xl font-bold tracking-tight">Schedule Matcher</h1>
        <p className="max-w-xs text-balance text-slate-600">
          Upload your schedule once. Stop texting screenshots.
        </p>
      </div>
      <Button onClick={signIn} className="w-full">Continue with Google</Button>
    </main>
  );
}
