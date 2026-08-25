// src/features/auth/signIn.ts
import { supabase } from '@/lib/supabase';
import { peekRedirect } from './redirect';

/**
 * Hand off to Google's account chooser.
 *
 * Lives here rather than inside LoginPage because two screens start a sign-in
 * now: the login screen, and the /wifi poster landing page, where this is the
 * only call to action. That page converts a stranger who scanned a QR code
 * expecting free wifi, and putting the login screen between the pitch and the
 * account chooser costs a tap at the exact moment attention is thinnest.
 *
 * Both callers want identical behaviour, and the `select_account` note below
 * is the kind of hard-won detail that goes stale the moment it exists in two
 * places.
 */
export async function signInWithGoogle(): Promise<void> {
  // If the student arrived from a deep link (an invite, a compare link)
  // rather than the app root, send Google straight back to it so the request
  // isn't silently dropped after sign-in.
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
