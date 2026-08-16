import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { usernameSchema } from '@/domain/schema';
import { useAuth } from './AuthProvider';
import { consumeRedirect } from './redirect';
import Button from '@/components/Button';

/**
 * A 23505 on this insert can mean two different things: the *username* is
 * taken (unique constraint), or the profile *row itself* already exists
 * (primary-key collision on `id` — e.g. a previous attempt actually
 * succeeded, or another tab finished onboarding first). Blaming the username
 * for the second case is untrue and unrecoverable: the student can retype
 * any username and it will report "taken" every time.
 */
function isPrimaryKeyCollision(error: PostgrestError): boolean {
  const text = `${error.message} ${error.details ?? ''}`.toLowerCase();
  return text.includes('pkey') || text.includes('(id)');
}

export default function OnboardingPage() {
  const { session, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const parsed = usernameSchema.safeParse(username.trim().toLowerCase());
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    setSaving(true);
    const { error: insertError } = await supabase.from('profiles').insert({
      id: session!.user.id,
      username: parsed.data,
      display_name: session!.user.user_metadata.full_name ?? null,
      avatar_url: session!.user.user_metadata.avatar_url ?? null,
    });
    setSaving(false);

    if (insertError) {
      if (insertError.code === '23505' && isPrimaryKeyCollision(insertError)) {
        // Their profile already exists — this is not a bad username, it's a
        // recoverable state. Pick up the existing profile and continue.
        await refreshProfile();
        navigate(consumeRedirect(), { replace: true });
        return;
      }
      setError(
        insertError.code === '23505'
          ? 'That username is taken. Try another.'
          : 'Could not save your username. Try again.'
      );
      return;
    }

    await refreshProfile();
    navigate(consumeRedirect(), { replace: true });
  }

  return (
    <main className="flex min-h-dvh flex-col p-6">
      <h1 className="mt-8 text-2xl font-bold">Pick a username</h1>
      <p className="mt-2 text-sm text-slate-600">
        This is how friends find you. Lowercase letters, numbers and underscores.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-1 flex-col">
        <label htmlFor="username" className="sr-only">Username</label>
        <div className="flex items-center rounded-xl border border-slate-300 bg-white px-3">
          <span className="text-slate-400">@</span>
          <input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="moss_b21"
            className="min-h-touch w-full bg-transparent px-2 outline-none"
          />
        </div>
        {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}

        <Button type="submit" disabled={saving} className="mt-auto w-full">
          {saving ? 'Saving…' : 'Continue'}
        </Button>
      </form>
    </main>
  );
}
