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
import IntroQuestions from './IntroQuestions';

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
   * install → intro → questions → username. Install leads, so that everything
   * after it happens in the app the student is actually going to keep using.
   *
   * On iPhone a home-screen app gets its own storage container, separate from
   * Safari's, so anyone who follows the instructions and switches over arrives
   * signed out and finishes onboarding in the installed app. With the intro
   * first that meant sitting through the prologue and the questions in Safari
   * and then doing both again in the app; leading with install means they see
   * it once, in the right place. Picking a username still happens after the
   * move for the same reason it always did.
   *
   * Anyone already running from an icon starts at the intro — there is nothing
   * to install, and that includes someone who installed midway through a
   * previous attempt and has come back through the installed app.
   */
  const [step, setStep] = useState<'install' | 'intro' | 'questions' | 'username'>(
    isStandalone() ? 'intro' : 'install'
  );

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
   */
  // The prologue now hands off to the questions, not straight to the username.
  const afterIntro = useCallback(() => setStep('questions'), []);

  /** Stable for the same reason afterIntro is. */
  const afterQuestions = useCallback(() => setStep('username'), []);

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

  if (step === 'install') {
    return (
      <main className="flex min-h-dvh flex-col p-6">
        <h1 className="mt-8 text-2xl font-bold">Add it to your home screen</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">
          Schedule Matcher is built to live on your home screen, not in a browser tab. It takes
          about ten seconds and it is worth doing now, before you go any further.
        </p>

        {/*
          Concrete consequences rather than adjectives. "Convenient" persuades
          nobody; "you will stop opening it" is the thing that is actually true
          of a bookmark buried in a tab list, and every student has watched it
          happen to an app they meant to use.

          Both claims are honest. What is deliberately *not* claimed is that
          installing keeps you signed in — on iPhone the opposite is true, and
          the panel below says so.
        */}
        <ul className="mt-4 flex flex-col gap-2 text-sm leading-relaxed text-slate-700">
          <li className="flex gap-2">
            <span aria-hidden className="text-slate-400">
              &bull;
            </span>
            <span>
              One tap to see when everyone is free. A tab you have to hunt for is a tab you stop
              opening.
            </span>
          </li>
          <li className="flex gap-2">
            <span aria-hidden className="text-slate-400">
              &bull;
            </span>
            <span>It opens full screen, so a whole week actually fits on the display.</span>
          </li>
        </ul>

        <div className="mt-6 flex-1">
          <InstallInstructions />
        </div>

        {/* On iPhone a home-screen app gets its own storage container, separate
            from Safari's, so a student who adds the app here and switches to it
            arrives signed out and does the rest — intro and username — there
            instead. Saying so turns a "wait, it lost me" moment into an
            expected one. Android shares storage with Chrome, hence "might". */}
        <p className="mt-6 rounded-xl bg-slate-100 px-4 py-3 text-xs leading-relaxed text-slate-600">
          Once it is added, open Schedule Matcher from your home screen and finish setting up
          there. You might have to sign in once more.
        </p>

        <Button onClick={() => setStep('intro')} className="mt-4 w-full">
          I&rsquo;ve added it
        </Button>

        {/*
          The escape stays, quietly. The app is a PWA and genuinely does work in
          a browser, so a button claiming otherwise would be a lie — and on iOS
          only Safari and Chrome can install at all, so a student in an in-app
          browser (Instagram, Snapchat) physically cannot complete this step.
          Removing the way out would strand exactly those people on the screen
          before they have an account. Naming the cost is the honest way to
          apply pressure; a dead end is not.
        */}
        <button
          type="button"
          onClick={() => setStep('intro')}
          className="mt-3 min-h-touch text-xs font-medium text-slate-400 underline underline-offset-4"
        >
          Skip &mdash; I&rsquo;ll use it in the browser
        </button>
      </main>
    );
  }

  if (step === 'intro') {
    return <AboutIntro onDone={afterIntro} />;
  }

  if (step === 'questions') {
    return <IntroQuestions onDone={afterQuestions} />;
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
