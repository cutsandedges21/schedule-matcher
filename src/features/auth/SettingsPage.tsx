// src/features/auth/SettingsPage.tsx
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { DEFAULT_SCHOOL_ID } from '@/domain/schools';
import { useAuth } from './AuthProvider';
import { deleteAccount } from './deleteAccount';
import SchoolSelect from './SchoolSelect';
import Button from '@/components/Button';
import NavRow from '@/components/NavRow';

export default function SettingsPage() {
  const { profile, patchProfile, signOut } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schoolError, setSchoolError] = useState<string | null>(null);

  const username = profile?.username ?? '';
  const canDelete = typed.trim().toLowerCase() === username && !deleting;
  const selectedSchoolId = profile?.school ?? DEFAULT_SCHOOL_ID;

  /**
   * Optimistic: patch the cached profile first so the accent flips under the
   * finger, then write. On failure put the old value back and say so — the
   * alternative is a tap that appears to work and silently isn't there after
   * a reload.
   */
  async function chooseSchool(id: string) {
    if (!profile) return;

    const previous = profile.school;
    // `default` is the absence of a school, not a school. Storing the string
    // would make every unthemed profile show a "No school" chip to friends.
    const next = id === DEFAULT_SCHOOL_ID ? null : id;
    if (next === previous) return;

    setSchoolError(null);
    patchProfile({ school: next });

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ school: next })
      .eq('id', profile.id);

    if (updateError) {
      patchProfile({ school: previous });
      setSchoolError('Could not save your school. Check your connection and try again.');
    }
  }

  async function handleDelete() {
    setError(null);
    setDeleting(true);
    try {
      await deleteAccount();
      // deleteAccount clears the local session; AuthProvider's
      // onAuthStateChange drops `session`, and RequireAuth redirects to
      // /login on the next render. No manual navigate needed.
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'We could not delete your account.');
      setDeleting(false);
    }
  }

  return (
    <main className="flex flex-col gap-6 p-4 pb-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <section>
        <h2 className="text-sm font-semibold text-slate-500">School</h2>
        <p className="mt-1 text-xs text-slate-500">
          Sets the app&rsquo;s colour. Friends can see which school you&rsquo;re at.
        </p>

        <SchoolSelect
          selectedId={selectedSchoolId}
          onChoose={(id) => void chooseSchool(id)}
        />

        {schoolError && <p className="mt-2 text-sm text-rose-600">{schoolError}</p>}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-500">Appearance</h2>
        <ul className="mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <li>
            <NavRow to="/settings/customization" label="Customization" />
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-sm font-bold text-slate-900">More from me</h2>
        <p className="mt-1 text-xs text-slate-500">
          I also run a few other things outside of class:
        </p>
        <ul className="mt-2 overflow-hidden rounded-2xl border-2 border-accent bg-white">
          <li>
            <NavRow
              href="https://lifeos-daily.vercel.app"
              label="LifeOS"
              description="Track your goals, health, and money in one place"
            />
          </li>
          <li className="border-t border-slate-200">
            <NavRow
              href="https://summit-sites.vercel.app"
              label="Summit Sites"
              description="Web design for businesses across Canada"
            />
          </li>
          <li className="border-t border-slate-200">
            <NavRow
              href="https://cutsandedges.vercel.app"
              label="Cuts & Edges"
              description="Lawn care in RDP, Anjou & Saint-Léonard"
            />
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-500">Legal</h2>
        <ul className="mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <li>
            <NavRow to="/privacy" label="Privacy Policy" />
          </li>
          <li className="border-t border-slate-200">
            <NavRow to="/terms" label="Terms of Service" />
          </li>
        </ul>
      </section>

      <Button variant="secondary" onClick={() => void signOut()} className="w-full">
        Sign out
      </Button>

      <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
        <h2 className="text-sm font-semibold text-rose-900">Delete account</h2>
        <p className="mt-1 text-sm text-rose-800">
          Permanently deletes your profile, your schedule and your friend connections. This cannot
          be undone.
        </p>

        {error && <p className="mt-2 text-sm font-medium text-rose-700">{error}</p>}

        {confirming ? (
          <div className="mt-3 flex flex-col gap-3">
            <label className="text-sm text-rose-900">
              Type <span className="font-mono font-semibold">{username}</span> to confirm.
              <input
                type="text"
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                disabled={deleting}
                aria-label={`Type ${username} to confirm account deletion`}
                className="mt-1 min-h-touch w-full rounded-xl border border-rose-300 bg-white px-3 disabled:opacity-60"
              />
            </label>

            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={!canDelete}
                onClick={() => void handleDelete()}
                className="flex-1 bg-rose-600 text-white active:bg-rose-700 disabled:bg-rose-300"
              >
                {deleting ? 'Deleting…' : 'Delete forever'}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={deleting}
                onClick={() => {
                  setConfirming(false);
                  setTyped('');
                  setError(null);
                }}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="secondary"
            onClick={() => setConfirming(true)}
            className="mt-3 w-full border-rose-300 text-rose-700"
          >
            Delete my account
          </Button>
        )}
      </section>
    </main>
  );
}
