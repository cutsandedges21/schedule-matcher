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
  /**
   * intro → install → username. The install step comes *before* the username
   * so that a student who follows the instructions is running from their home
   * screen by the time they pick a name, rather than typing it into Safari and
   * then being asked to move.
   */
  const [step, setStep] = useState<'intro' | 'install' | 'username'>('intro');

  /**
   * Where to go when onboarding finishes — captured the moment the profile is
   * saved. `RequireAuth` clears the pending redirect as soon as a profile
   * exists, so reading it later would silently drop the invite link that sent
   * them here.
   */
  const destination = useRef('/');

  function finish() {
    navigate(destination.current, { replace: true });
  }

  /**
   * Stable identity: AboutIntro keys its beat timer off this, and a fresh arrow
   * every render would keep restarting the current beat.
   *
   * Anyone already running from a home-screen icon skips straight past the
   * install step — including someone who installed midway through a previous
   * attempt and has come back through the installed app.
   */
  const afterIntro = useCallback(() => setStep(isStandalone() ? 'username' : 'install'), []);

  /** The username is the last step, so saving it ends onboarding. */
  async function afterProfileSaved() {
    destination.current = consumeRedirect();
    await refreshProfile();
    finish();
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
    return <AboutIntro onDone={afterIntro} />;
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

        {/* On iPhone a home-screen app gets its own storage container, separate
            from Safari's, so a student who adds the app here and switches to it
            arrives signed out and picks their username there instead. Saying so
            turns a "wait, it lost me" moment into an expected one. Android
            shares storage with Chrome, hence "might". */}
        <p className="mt-6 rounded-xl bg-slate-100 px-4 py-3 text-xs leading-relaxed text-slate-600">
          Added it? Open Schedule Matcher from your home screen and carry on there — you might
          have to sign in once more.
        </p>

        <Button onClick={() => setStep('username')} className="mt-4 w-full">
          Continue
        </Button>
        <button
          type="button"
          onClick={() => setStep('username')}
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
          {saving ? 'Saving…' : 'Finish'}
        </Button>
      </form>
    </main>
  );
}
