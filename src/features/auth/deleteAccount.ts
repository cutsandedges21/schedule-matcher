// src/features/auth/deleteAccount.ts
import { supabase } from '@/lib/supabase';

/**
 * Permanently deletes the signed-in user, then clears the local session.
 *
 * Two server-side routes do the same job, and only one of them needs to exist:
 *  - `delete_account()` (supabase/migrations/0005_delete_account.sql), which
 *    needs nothing but SQL Editor access — tried first for that reason;
 *  - the `delete-account` Edge Function, which needs a management access token
 *    to deploy but uses the supported admin API.
 *
 * Falling through to the second keeps the button working whichever one has
 * been set up, instead of hard-failing on a project that has the other.
 *
 * The sign-out is deliberately local-scope and deliberately swallowed: by the
 * time it runs the user no longer exists, so a server-side sign-out has
 * nothing to revoke and returns an error. Letting that error surface would
 * report a successful deletion as a failure and leave a dead session in
 * localStorage — the worst of both.
 */
export async function deleteAccount(): Promise<void> {
  const viaRpc = await supabase.rpc('delete_account');

  if (viaRpc.error) {
    // Logged for the developer, not the student. During setup the likely
    // causes are "migration 0005 not applied" (PGRST202) or "function owner
    // cannot delete from auth.users" (42501) — neither is distinguishable
    // from a network failure in the message below.
    console.error('delete_account RPC failed, trying the Edge Function:', viaRpc.error);

    const viaFunction = await supabase.functions.invoke('delete-account', { body: {} });
    if (viaFunction.error) {
      console.error('delete-account Edge Function failed:', viaFunction.error);
      throw new Error('We could not delete your account. Check your connection and try again.');
    }
  }

  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch {
    // Already gone server-side; the local session is cleared either way.
  }
}
