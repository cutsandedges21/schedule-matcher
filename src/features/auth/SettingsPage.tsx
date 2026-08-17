// src/features/auth/SettingsPage.tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { DEFAULT_SCHOOL_ID, SCHOOLS } from '@/domain/schools';
import { COSMETICS } from '@/domain/cosmetics';
import { useAuth } from './AuthProvider';
import { deleteAccount } from './deleteAccount';
import Button from '@/components/Button';

export default function SettingsPage() {
  const { profile, patchProfile, signOut } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schoolError, setSchoolError] = useState<string | null>(null);
  const [cosmeticError, setCosmeticError] = useState<string | null>(null);

  const username = profile?.username ?? '';
  const canDelete = typed.trim().toLowerCase() === username && !deleting;
  const selectedSchoolId = profile?.school ?? DEFAULT_SCHOOL_ID;
  const selectedCosmeticId = profile?.cosmetic ?? null;

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

  /**
   * Same optimistic write as chooseSchool, and the same reason: the swatch has
   * to ring under the finger rather than after the round trip.
   *
   * Cosmetics are free to everyone today, and this writes straight from the
   * client through `profiles_update` — the policy lets a student set any
   * column on their own row. Correct while they are free. When they move
   * behind the paid Pass, `profiles.cosmetic` has to stop being client
   * writable: revoke column-level update from `authenticated` and go through a
   * trigger or a security-definer setter that checks the Pass. See the header
   * of migration 0007. Nothing here should be read as an entitlement check.
   */
  async function chooseCosmetic(id: string | null) {
    if (!profile) return;

    const previous = profile.cosmetic;
    if (id === previous) return;

    setCosmeticError(null);
    patchProfile({ cosmetic: id });

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ cosmetic: id })
      .eq('id', profile.id);

    if (updateError) {
      patchProfile({ cosmetic: previous });
      setCosmeticError('Could not save your cosmetic. Check your connection and try again.');
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

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="font-semibold">@{profile?.username}</p>
        {profile?.displayName && <p className="text-sm text-slate-500">{profile.displayName}</p>}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-500">School</h2>
        <p className="mt-1 text-xs text-slate-500">
          Sets the app&rsquo;s colour. Friends can see which school you&rsquo;re at.
        </p>
        <ul
          role="radiogroup"
          aria-label="School"
          className="mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white"
        >
          {SCHOOLS.map((school, index) => {
            const selected = school.id === selectedSchoolId;
            return (
              <li key={school.id} className={index > 0 ? 'border-t border-slate-200' : undefined}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => void chooseSchool(school.id)}
                  className="flex min-h-touch w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium active:bg-slate-100"
                >
                  <span
                    aria-hidden
                    className="h-5 w-5 shrink-0 rounded-full border border-black/10"
                    style={{ backgroundColor: school.accent }}
                  />
                  <span className="flex-1">{school.name}</span>
                  {selected && <span aria-hidden className="font-bold text-accent">✓</span>}
                </button>
              </li>
            );
          })}
        </ul>
        {schoolError && <p className="mt-2 text-sm text-rose-600">{schoolError}</p>}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-500">Card colour</h2>
        <p className="mt-1 text-xs text-slate-500">
          How your name looks on your friends&rsquo; Friends page. Only they see it.
        </p>
        {/* Swatches rather than a list of names: the colour *is* the choice,
            and each one previews the real card — background, border and the
            text drawn on it. The selection ring uses the viewer's own accent,
            which is right here: this is their Settings, not a friend's card. */}
        <ul role="radiogroup" aria-label="Card colour" className="mt-2 grid grid-cols-4 gap-2">
          <li>
            <button
              type="button"
              role="radio"
              aria-checked={selectedCosmeticId === null}
              aria-label="None"
              onClick={() => void chooseCosmetic(null)}
              className="flex w-full flex-col items-center gap-1"
            >
              <span
                className={
                  selectedCosmeticId === null
                    ? 'flex h-12 w-full items-center justify-center rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-400 ring-2 ring-accent ring-offset-2 ring-offset-slate-50'
                    : 'flex h-12 w-full items-center justify-center rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-400'
                }
              >
                Aa
              </span>
              <span className="text-[11px] text-slate-500">None</span>
            </button>
          </li>

          {COSMETICS.map((cosmetic) => {
            const selected = cosmetic.id === selectedCosmeticId;
            return (
              <li key={cosmetic.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={cosmetic.name}
                  onClick={() => void chooseCosmetic(cosmetic.id)}
                  className="flex w-full flex-col items-center gap-1"
                >
                  <span
                    className={
                      selected
                        ? 'flex h-12 w-full items-center justify-center rounded-xl border text-xs font-semibold ring-2 ring-accent ring-offset-2 ring-offset-slate-50'
                        : 'flex h-12 w-full items-center justify-center rounded-xl border text-xs font-semibold'
                    }
                    style={{
                      backgroundColor: cosmetic.background,
                      borderColor: cosmetic.border,
                      color: cosmetic.fg,
                    }}
                  >
                    Aa
                  </span>
                  <span className="text-[11px] text-slate-500">{cosmetic.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
        {cosmeticError && <p className="mt-2 text-sm text-rose-600">{cosmeticError}</p>}
      </section>

      <Button variant="secondary" onClick={() => void signOut()} className="w-full">
        Sign out
      </Button>

      <section>
        <h2 className="text-sm font-semibold text-slate-500">About</h2>
        <ul className="mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <li>
            <Link
              to="/privacy"
              className="flex min-h-touch items-center justify-between px-4 py-3 text-sm font-medium active:bg-slate-100"
            >
              Privacy Policy
              <span aria-hidden className="text-slate-400">›</span>
            </Link>
          </li>
          <li className="border-t border-slate-200">
            <Link
              to="/terms"
              className="flex min-h-touch items-center justify-between px-4 py-3 text-sm font-medium active:bg-slate-100"
            >
              Terms of Service
              <span aria-hidden className="text-slate-400">›</span>
            </Link>
          </li>
        </ul>
      </section>

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
