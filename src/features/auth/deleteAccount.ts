// src/features/auth/deleteAccount.ts
import { supabase } from '@/lib/supabase';

/**
 * Permanently deletes the signed-in user via the `delete-account` Edge
 * Function, then clears the local session.
 *
 * The sign-out is deliberately local-scope and deliberately swallowed: by the
 * time it runs the user no longer exists, so a server-side sign-out has
 * nothing to revoke and returns an error. Letting that error surface would
 * report a successful deletion as a failure and leave a dead session in
 * localStorage — the worst of both.
 */
export async function deleteAccount(): Promise<void> {
  const { error } = await supabase.functions.invoke('delete-account', { body: {} });

  if (error) {
    // Surfaced to the developer, not the student: the most likely cause during
    // setup is that the Edge Function has not been deployed yet (a 404), which
    // is indistinguishable from a network failure in the message below.
    console.error('delete-account invoke failed:', error);
    throw new Error('We could not delete your account. Check your connection and try again.');
  }

  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch {
    // Already gone server-side; the local session is cleared either way.
  }
}
