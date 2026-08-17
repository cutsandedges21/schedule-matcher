import { useCallback, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { usernameSchema } from '@/domain/schema';
import { isStandalone } from '@/lib/installPrompt';
import { useAuth } from './AuthProvider';
import { consumeRedirect } from './redirect';
import Button from '@/components/Button';
import InstallInstructions from '@/components/InstallInstructions';
import AboutIntro from './AboutIntro';

/**
 * A 23505 on the profile insert means one of two things: the *username* is
 * taken (unique index), or the profile *row itself* already exists
 * (primary-key collision on `id` — a previous attempt actually succeeded, or
 * another tab finished onboarding first). Blaming the username for the second
 * case is untrue and unrecoverable: the student retypes any username and it
 * reports "taken" every time, with no way out.
 *
 * We ask the database which it was rather than pattern-matching the error
 * text, so this cannot silently break if PostgREST rewords its messages.
 */
async function profileExists(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();
  return data !== null;
}

export default function OnboardingPage() {
  const { session, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<'intro' | 'username' | 'install'>('intro');

  /**
   * Where to go when onboarding finishes — captured the moment the profile is
   * saved, not when the student taps through the install step. `RequireAuth`
   * clears the pending redirect as soon as a profile exists, so reading it
   * later would silently drop the invite link that sent them here.
   */
  const destination = useRef('/');

  function finish() {
    navigate(destination.current, { replace: true });
  }

  // Stable identity: AboutIntro keys its beat timer off this, and a fresh
  // arrow every render would keep restarting the current beat.
  const showUsernameStep = useCallback(() => setStep('username'), []);

  /** Profile saved: show the install step, unless they're already installed. */
  async function afterProfileSaved() {
    destination.current = consumeRedirect();
    await refreshProfile();
    if (isStandalone()) {
      finish();
      return;
    }
    setStep('install');
  }

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
      if (insertError.code === '23505' && (await profileExists(session!.user.id))) {
        // Their profile already exists — not a bad username, just a
        // recoverable state. Pick up the existing profile and continue.
        await afterProfileSaved();
        return;
      }
      setError(
        insertError.code === '23505'
          ? 'That username is taken. Try another.'
          : 'Could not save your username. Try again.'
      );
      return;
    }

    await afterProfileSaved();
  }

  if (step === 'intro') {
    return <AboutIntro onDone={showUsernameStep} />;
  }

  if (step === 'install') {
    return (
      <main className="flex min-h-dvh flex-col p-6">
        <h1 className="mt-8 text-2xl font-bold">Keep it one tap away</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Add Schedule Matcher to your home screen and it opens like a normal app — no
          browser, no typing the address, no hunting through tabs.
        </p>

        <div className="mt-6 flex-1">
          <InstallInstructions />
        </div>

        <Button onClick={finish} className="mt-6 w-full">
          Done
        </Button>
        <button
          type="button"
          onClick={finish}
          className="mt-2 min-h-touch text-sm font-medium text-slate-500"
        >
          Skip for now
        </button>
      </main>
    );
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
